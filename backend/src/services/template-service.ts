/**
 * Template Service
 * 
 * Manages PDF test plan templates:
 * - File upload and storage
 * - PDF text extraction
 * - Default template management
 * - CRUD operations
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
import { getDatabase } from '../database/connection';
import logger from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import type { Template, TemplateRow } from '../types';

export interface CreateTemplateData {
  name: string;
  filename: string;
  filepath: string;
  content: string;
  isDefault?: boolean;
}

export class TemplateService {
  private db = getDatabase();
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(process.cwd(), 'templates');
    this.ensureTemplatesDir();
  }

  /**
   * Ensure templates directory exists
   */
  private ensureTemplatesDir(): void {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      logger.info(`Created templates directory: ${this.templatesDir}`);
    }
  }

  /**
   * Create a new template from uploaded PDF
   */
  async createTemplate(file: Express.Multer.File, name?: string): Promise<Template> {
    try {
      // Validate file
      if (!file || !file.buffer) {
        throw Errors.BadRequest('No file uploaded');
      }

      if (file.mimetype !== 'application/pdf') {
        throw Errors.BadRequest('File must be a PDF');
      }

      // Check file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw Errors.BadRequest('File size exceeds 5MB limit');
      }

      logger.info({ filename: file.originalname, size: file.size }, 'Processing PDF upload');

      // Extract text from PDF
      const content = await this.extractText(file.buffer);

      // Generate unique filename
      const uniqueId = uuidv4().slice(0, 8);
      const safeFilename = this.sanitizeFilename(file.originalname);
      const storedFilename = `${uniqueId}_${safeFilename}`;
      const filepath = path.join(this.templatesDir, storedFilename);

      // Save file to disk
      fs.writeFileSync(filepath, file.buffer);
      logger.info({ filepath }, 'PDF saved to disk');

      // Determine if this should be the default
      const isDefault = this.shouldBeDefault();

      // Save to database
      const templateName = name || path.parse(file.originalname).name;
      const templateId = this.insertTemplate({
        name: templateName,
        filename: storedFilename,
        filepath,
        content,
        isDefault,
      });

      logger.info({ id: templateId, name: templateName }, 'Template created');

      return this.getTemplate(templateId)!;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid PDF')) {
        throw Errors.BadRequest('Invalid or corrupted PDF file');
      }
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer
   */
  private async extractText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      
      // Clean up extracted text
      let text = data.text
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
        .trim();

      logger.info({ pages: data.numpages, textLength: text.length }, 'PDF text extracted');

      return text;
    } catch (error) {
      logger.error({ error }, 'Failed to extract text from PDF');
      throw new Error('Invalid PDF structure');
    }
  }

  /**
   * Insert template into database
   */
  private insertTemplate(data: CreateTemplateData): number {
    try {
      // If this is default, unset previous default
      if (data.isDefault) {
        this.db.prepare('UPDATE templates SET is_default = 0 WHERE is_default = 1').run();
      }

      const stmt = this.db.prepare(`
        INSERT INTO templates (name, filename, filepath, content, is_default)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.name,
        data.filename,
        data.filepath,
        data.content,
        data.isDefault ? 1 : 0
      );

      return Number(result.lastInsertRowid);
    } catch (error) {
      logger.error({ error }, 'Failed to insert template');
      throw Errors.Internal('Failed to save template to database');
    }
  }

  /**
   * Get all templates
   */
  getAllTemplates(): Template[] {
    try {
      const rows = this.db.prepare(
        'SELECT * FROM templates ORDER BY is_default DESC, created_at DESC'
      ).all() as TemplateRow[];

      return rows.map(row => this.rowToTemplate(row));
    } catch (error) {
      logger.error({ error }, 'Failed to get templates');
      return [];
    }
  }

  /**
   * Get template by ID
   */
  getTemplate(id: number): Template | null {
    try {
      const row = this.db.prepare(
        'SELECT * FROM templates WHERE id = ?'
      ).get(id) as TemplateRow | undefined;

      if (!row) {
        return null;
      }

      return this.rowToTemplate(row);
    } catch (error) {
      logger.error({ error, id }, 'Failed to get template');
      return null;
    }
  }

  /**
   * Get default template
   */
  getDefaultTemplate(): Template | null {
    try {
      const row = this.db.prepare(
        'SELECT * FROM templates WHERE is_default = 1 LIMIT 1'
      ).get() as TemplateRow | undefined;

      if (!row) {
        // Return first template if no default
        return this.getAllTemplates()[0] || null;
      }

      return this.rowToTemplate(row);
    } catch (error) {
      logger.error({ error }, 'Failed to get default template');
      return null;
    }
  }

  /**
   * Update template
   */
  updateTemplate(id: number, data: Partial<Pick<CreateTemplateData, 'name' | 'isDefault'>>): Template {
    try {
      const template = this.getTemplate(id);
      if (!template) {
        throw Errors.NotFound('Template');
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: (string | number)[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }

      if (data.isDefault !== undefined) {
        // Unset previous default if setting this as default
        if (data.isDefault) {
          this.db.prepare('UPDATE templates SET is_default = 0 WHERE is_default = 1').run();
        }
        updates.push('is_default = ?');
        values.push(data.isDefault ? 1 : 0);
      }

      if (updates.length === 0) {
        throw Errors.BadRequest('No fields to update');
      }

      values.push(id);

      const stmt = this.db.prepare(`
        UPDATE templates SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(...values);

      logger.info({ id }, 'Template updated');

      return this.getTemplate(id)!;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      logger.error({ error, id }, 'Failed to update template');
      throw Errors.Internal('Failed to update template');
    }
  }

  /**
   * Delete template
   */
  deleteTemplate(id: number): void {
    try {
      const template = this.getTemplate(id);
      if (!template) {
        throw Errors.NotFound('Template');
      }

      // Delete file from disk
      if (fs.existsSync(template.filepath)) {
        fs.unlinkSync(template.filepath);
        logger.info({ filepath: template.filepath }, 'Template file deleted');
      }

      // Delete from database
      const result = this.db.prepare('DELETE FROM templates WHERE id = ?').run(id);

      if (result.changes === 0) {
        throw Errors.NotFound('Template');
      }

      logger.info({ id }, 'Template deleted');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      logger.error({ error, id }, 'Failed to delete template');
      throw Errors.Internal('Failed to delete template');
    }
  }

  /**
   * Set template as default
   */
  setAsDefault(id: number): Template {
    return this.updateTemplate(id, { isDefault: true });
  }

  /**
   * Get template count
   */
  getCount(): number {
    try {
      const result = this.db.prepare(
        'SELECT COUNT(*) as count FROM templates'
      ).get() as { count: number };

      return result.count;
    } catch (error) {
      logger.error({ error }, 'Failed to get template count');
      return 0;
    }
  }

  /**
   * Check if any templates exist
   */
  hasTemplates(): boolean {
    return this.getCount() > 0;
  }

  /**
   * Determine if new template should be default
   */
  private shouldBeDefault(): boolean {
    return !this.hasTemplates();
  }

  /**
   * Sanitize filename for safe storage
   */
  private sanitizeFilename(filename: string): string {
    // Remove path components and unsafe characters
    return filename
      .replace(/\\/g, '_')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase();
  }

  /**
   * Convert database row to Template object
   */
  private rowToTemplate(row: TemplateRow): Template {
    return {
      id: row.id,
      name: row.name,
      filename: row.filename,
      filepath: row.filepath,
      content: row.content,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
    };
  }
}

export default TemplateService;
