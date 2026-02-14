/**
 * Template Routes
 * 
 * API endpoints for PDF template management:
 * - Upload PDF templates
 * - List templates
 * - Get template by ID
 * - Set default template
 * - Delete templates
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import TemplateService from '../services/template-service';
import logger from '../utils/logger';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { templateIdValidator } from '../middleware/validators';
import { validationResult } from 'express-validator';

const router = Router();
const templateService = new TemplateService();

// ============================================
// Multer Configuration
// ============================================

// Use memory storage to process file before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Only accept PDFs
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// ============================================
// Routes
// ============================================

/**
 * GET /api/templates
 * List all templates
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const templates = templateService.getAllTemplates();
    
    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  })
);

/**
 * GET /api/templates/default
 * Get default template
 */
router.get(
  '/default',
  asyncHandler(async (_req: Request, res: Response) => {
    const template = templateService.getDefaultTemplate();
    
    if (!template) {
      throw Errors.NotFound('Default template');
    }
    
    res.json({
      success: true,
      data: template,
    });
  })
);

/**
 * GET /api/templates/:id
 * Get template by ID
 */
router.get(
  '/:id',
  templateIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    const template = templateService.getTemplate(id);
    
    if (!template) {
      throw Errors.NotFound('Template');
    }
    
    res.json({
      success: true,
      data: template,
    });
  })
);

/**
 * POST /api/templates/upload
 * Upload a new PDF template
 */
router.post(
  '/upload',
  upload.single('template'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw Errors.BadRequest('No file uploaded');
    }

    const name = req.body.name as string | undefined;
    
    logger.info({
      filename: req.file.originalname,
      size: req.file.size,
      name,
    }, 'Uploading template');
    
    const template = await templateService.createTemplate(req.file, name);
    
    res.status(201).json({
      success: true,
      message: 'Template uploaded successfully',
      data: template,
    });
  })
);

/**
 * PUT /api/templates/:id
 * Update template (name, isDefault)
 */
router.put(
  '/:id',
  templateIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    const { name, isDefault } = req.body;
    
    // Validate at least one field provided
    if (name === undefined && isDefault === undefined) {
      throw Errors.BadRequest('At least one field (name or isDefault) must be provided');
    }
    
    const template = templateService.updateTemplate(id, { name, isDefault });
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      data: template,
    });
  })
);

/**
 * POST /api/templates/:id/default
 * Set template as default
 */
router.post(
  '/:id/default',
  templateIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    const template = templateService.setAsDefault(id);
    
    res.json({
      success: true,
      message: 'Template set as default',
      data: template,
    });
  })
);

/**
 * DELETE /api/templates/:id
 * Delete a template
 */
router.delete(
  '/:id',
  templateIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    templateService.deleteTemplate(id);
    
    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  })
);

/**
 * GET /api/templates/:id/download
 * Download template PDF file
 */
router.get(
  '/:id/download',
  templateIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    const template = templateService.getTemplate(id);
    
    if (!template) {
      throw Errors.NotFound('Template');
    }
    
    // Send file
    res.download(template.filepath, template.filename, (err) => {
      if (err) {
        logger.error({ err, id }, 'Failed to download template');
        // Don't throw here as response may already be sent
      }
    });
  })
);

// Error handler for multer
router.use((err: Error, _req: Request, res: Response, next: Function) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'File size exceeds 5MB limit',
          code: 'FILE_TOO_LARGE',
          status: 400,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(400).json({
      success: false,
      error: {
        message: err.message,
        code: 'UPLOAD_ERROR',
        status: 400,
      },
      timestamp: new Date().toISOString(),
    });
  }
  
  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      error: {
        message: err.message,
        code: 'INVALID_FILE_TYPE',
        status: 400,
      },
      timestamp: new Date().toISOString(),
    });
  }
  
  next(err);
});

export default router;
