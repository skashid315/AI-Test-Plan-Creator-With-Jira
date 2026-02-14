/**
 * Test Plan Routes
 * 
 * API endpoints for test plan generation:
 * - Generate test plan (SSE streaming)
 * - Get generation history
 * - Get specific test plan
 * - Delete test plan
 */

import { Router, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import TestPlanService from '../services/testplan-service';
import logger from '../utils/logger';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { generateTestPlanValidator, templateIdValidator, paginationValidator } from '../middleware/validators';
import type { GenerateTestPlanRequest } from '../types';

const router = Router();
const testPlanService = new TestPlanService();

// ============================================
// Helper: Send SSE Event
// ============================================

function sendSSE(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ============================================
// Routes
// ============================================

/**
 * POST /api/testplan/generate
 * Generate a test plan (SSE streaming)
 */
router.post(
  '/generate',
  generateTestPlanValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const { ticketId, templateId, provider }: GenerateTestPlanRequest = req.body;

    logger.info({ ticketId, provider, templateId }, 'Test plan generation requested');

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    try {
      // Start generation
      const generator = testPlanService.generate({
        ticketId,
        templateId,
        provider,
      });

      for await (const event of generator) {
        sendSSE(res, event);

        // If complete or error, end the stream
        if (event.type === 'complete' || event.type === 'error') {
          break;
        }
      }

      // Send final done event
      sendSSE(res, { type: 'done' });
      res.end();

    } catch (error) {
      logger.error({ error, ticketId }, 'Test plan generation route error');
      
      sendSSE(res, {
        type: 'error',
        data: error instanceof Error ? error.message : 'Generation failed',
      });
      
      sendSSE(res, { type: 'done' });
      res.end();
    }
  })
);

/**
 * POST /api/testplan/generate-sync
 * Generate a test plan (synchronous, non-streaming)
 * Use this for simpler clients that don't support SSE
 */
router.post(
  '/generate-sync',
  generateTestPlanValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const { ticketId, templateId, provider }: GenerateTestPlanRequest = req.body;

    logger.info({ ticketId, provider, templateId }, 'Sync test plan generation requested');

    const generator = testPlanService.generate({
      ticketId,
      templateId,
      provider,
    });

    let content = '';
    let error: string | null = null;

    for await (const event of generator) {
      if (event.type === 'content') {
        content += event.data;
      } else if (event.type === 'complete') {
        content = event.data;
      } else if (event.type === 'error') {
        error = event.data;
      }
    }

    if (error) {
      throw Errors.BadGateway(error);
    }

    res.json({
      success: true,
      data: {
        content,
        ticketId,
        provider,
      },
    });
  })
);

/**
 * GET /api/testplan/history
 * Get generation history
 */
router.get(
  '/history',
  paginationValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    
    logger.info({ limit }, 'Fetching test plan history');
    
    const history = testPlanService.getHistory(limit);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  })
);

/**
 * GET /api/testplan/history/:id
 * Get specific test plan from history
 */
router.get(
  '/history/:id',
  templateIdValidator, // Reuse template validator for ID validation
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    const testPlan = testPlanService.getTestPlan(id);
    
    if (!testPlan) {
      throw Errors.NotFound('Test plan');
    }
    
    res.json({
      success: true,
      data: testPlan,
    });
  })
);

/**
 * DELETE /api/testplan/history/:id
 * Delete test plan from history
 */
router.delete(
  '/history/:id',
  templateIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    testPlanService.deleteTestPlan(id);
    
    res.json({
      success: true,
      message: 'Test plan deleted successfully',
    });
  })
);

/**
 * GET /api/testplan/history/:id/export
 * Export test plan as Markdown
 */
router.get(
  '/history/:id/export',
  templateIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    const testPlan = testPlanService.getTestPlan(id);
    
    if (!testPlan) {
      throw Errors.NotFound('Test plan');
    }
    
    // Set headers for file download
    const filename = `test-plan-${testPlan.ticketKey}-${id}.md`;
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(testPlan.generatedContent);
  })
);

export default router;
