#!/usr/bin/env tsx
/**
 * Database Initialization Script
 * 
 * Run this script to create the SQLite database and initialize the schema.
 * Usage: npm run db:init
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { DEFAULT_TEMPLATE_CONTENT } from './default-template';

// Database file path
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'app.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || path.join(process.cwd(), 'templates');

function initializeDatabase(): void {
  try {
    logger.info('Initializing database...');
    
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      logger.info(`Created data directory: ${DATA_DIR}`);
    }
    
    // Ensure templates directory exists
    if (!fs.existsSync(TEMPLATES_DIR)) {
      fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
      logger.info(`Created templates directory: ${TEMPLATES_DIR}`);
    }
    
    // Check if schema file exists
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found: ${SCHEMA_PATH}`);
    }
    
    // Read schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    // Connect to database (creates if doesn't exist)
    const db = new Database(DB_PATH);
    logger.info(`Connected to database: ${DB_PATH}`);
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    logger.info('Enabled WAL mode');
    
    // Execute schema
    db.exec(schema);
    logger.info('Schema executed successfully');
    
    // Verify tables were created
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as Array<{ name: string }>;
    
    logger.info(`Created tables: ${tables.map(t => t.name).join(', ')}`);
    
    // Verify default settings row exists
    const settings = db.prepare('SELECT id FROM settings WHERE id = 1').get() as { id: number } | undefined;
    if (settings) {
      logger.info('Default settings row verified');
    } else {
      throw new Error('Failed to create default settings row');
    }
    
    // Create default template if no templates exist
    createDefaultTemplateIfNeeded(db);
    
    db.close();
    logger.info('Database initialization completed successfully');
    
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Create a default template entry if no templates exist
 */
function createDefaultTemplateIfNeeded(db: Database.Database): void {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number };
    
    if (count.count === 0) {
      logger.info('No templates found. Creating default template...');
      
      // Save default template content to a file
      const defaultFilename = 'default_test_plan_template.txt';
      const defaultFilepath = path.join(TEMPLATES_DIR, defaultFilename);
      fs.writeFileSync(defaultFilepath, DEFAULT_TEMPLATE_CONTENT);
      
      // Insert into database
      const stmt = db.prepare(`
        INSERT INTO templates (name, filename, filepath, content, is_default)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        'Default Test Plan Template',
        defaultFilename,
        defaultFilepath,
        DEFAULT_TEMPLATE_CONTENT,
        1 // is_default = true
      );
      
      logger.info('Default template created successfully');
    } else {
      logger.info(`Found ${count.count} existing template(s), skipping default creation`);
    }
  } catch (error) {
    logger.error({ error }, 'Failed to create default template');
    // Don't throw - this is not critical
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

export default initializeDatabase;
