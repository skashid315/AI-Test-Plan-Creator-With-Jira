/**
 * Settings Routes
 * 
 * API endpoints for managing application settings:
 * - JIRA configuration (save, get, test)
 * - LLM configuration (save, get, list models)
 */

import { Router, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import SettingsService from '../services/settings-service';
import JiraClient from '../services/jira-client';
import OllamaService from '../services/ollama-service';
import logger from '../utils/logger';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import {
  jiraSettingsValidator,
  llmSettingsValidator,
} from '../middleware/validators';
import type { JiraSettingsRequest, LLMSettingsRequest } from '../types';

const router = Router();
const settingsService = new SettingsService();

// ============================================
// JIRA Settings Routes
// ============================================

/**
 * GET /api/settings/jira
 * Get JIRA connection status and configuration
 */
router.get(
  '/jira',
  asyncHandler(async (_req: Request, res: Response) => {
    const config = settingsService.getJiraConfig();
    
    // Return config without sensitive data
    res.json({
      success: true,
      data: {
        baseUrl: config.baseUrl,
        username: config.username,
        isConnected: config.isConnected,
        hasCredentials: Boolean(config.baseUrl && config.username && config.apiToken),
      },
    });
  })
);

/**
 * POST /api/settings/jira
 * Save JIRA configuration
 */
router.post(
  '/jira',
  jiraSettingsValidator,
  asyncHandler(async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const data: JiraSettingsRequest = req.body;
    
    // Save settings
    settingsService.saveJiraSettings(data);
    
    logger.info({ baseUrl: data.baseUrl }, 'JIRA settings saved');
    
    res.json({
      success: true,
      message: 'JIRA settings saved successfully',
    });
  })
);

/**
 * POST /api/settings/jira/test
 * Test JIRA connection
 */
router.post(
  '/jira/test',
  asyncHandler(async (_req: Request, res: Response) => {
    const config = settingsService.getJiraConfig();
    
    // Validate we have credentials
    if (!config.baseUrl || !config.username || !config.apiToken) {
      throw Errors.BadRequest('JIRA credentials not configured');
    }
    
    // Test connection
    const jiraClient = new JiraClient(config);
    const result = await jiraClient.testConnection();
    
    // Update connection status in database
    settingsService.setJiraConnected(result.success);
    
    res.json({
      success: result.success,
      message: result.message,
      user: result.user,
      connectionStatus: result.success,
    });
  })
);

// ============================================
// LLM Settings Routes
// ============================================

/**
 * GET /api/settings/llm
 * Get LLM configuration
 */
router.get(
  '/llm',
  asyncHandler(async (_req: Request, res: Response) => {
    const config = settingsService.getLLMConfig();
    
    res.json({
      success: true,
      data: {
        provider: config.provider,
        groq: {
          model: config.groq.model,
          temperature: config.groq.temperature,
          hasApiKey: Boolean(config.groq.apiKey),
        },
        ollama: {
          baseUrl: config.ollama.baseUrl,
          model: config.ollama.model,
        },
      },
    });
  })
);

/**
 * POST /api/settings/llm
 * Save LLM configuration
 */
router.post(
  '/llm',
  llmSettingsValidator,
  asyncHandler(async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const data: LLMSettingsRequest = req.body;
    
    // Save settings
    settingsService.saveLLMSettings(data);
    
    logger.info({ provider: data.provider }, 'LLM settings saved');
    
    res.json({
      success: true,
      message: 'LLM settings saved successfully',
    });
  })
);

/**
 * GET /api/settings/llm/models
 * List available Ollama models
 */
router.get(
  '/llm/models',
  asyncHandler(async (_req: Request, res: Response) => {
    const config = settingsService.getLLMConfig();
    
    const ollamaService = new OllamaService(config.ollama.baseUrl);
    const models = await ollamaService.listModels();
    
    res.json({
      success: true,
      data: models,
    });
  })
);

/**
 * POST /api/settings/llm/test
 * Test LLM connection (provider-specific)
 */
router.post(
  '/llm/test',
  asyncHandler(async (req: Request, res: Response) => {
    const { provider } = req.body;
    const config = settingsService.getLLMConfig();
    
    if (provider === 'ollama') {
      const ollamaService = new OllamaService(config.ollama.baseUrl);
      const result = await ollamaService.testConnection();
      
      res.json({
        success: result.success,
        message: result.message,
        models: result.models,
        connectionStatus: result.success,
      });
    } else if (provider === 'groq') {
      // For Groq, we just check if API key is configured
      // A real implementation would make a test API call
      const hasKey = Boolean(config.groq.apiKey);
      
      res.json({
        success: hasKey,
        message: hasKey 
          ? 'Groq API key is configured'
          : 'Groq API key is not configured',
        connectionStatus: hasKey,
      });
    } else {
      throw Errors.BadRequest('Invalid provider. Must be "groq" or "ollama"');
    }
  })
);

export default router;
