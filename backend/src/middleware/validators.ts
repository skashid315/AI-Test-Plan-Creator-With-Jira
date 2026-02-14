/**
 * Input Validation Middleware
 * 
 * Validation rules using express-validator for common inputs.
 */

import { body, param, query } from 'express-validator';

// JIRA ID validation: PROJECT-123 format
export const jiraIdValidator = [
  param('ticketId')
    .trim()
    .notEmpty()
    .withMessage('JIRA ticket ID is required')
    .matches(/^[A-Z][A-Z0-9]*-\d+$/)
    .withMessage('Invalid JIRA ticket ID format. Expected: PROJECT-123'),
];

export const jiraIdBodyValidator = [
  body('ticketId')
    .trim()
    .notEmpty()
    .withMessage('JIRA ticket ID is required')
    .matches(/^[A-Z][A-Z0-9]*-\d+$/)
    .withMessage('Invalid JIRA ticket ID format. Expected: PROJECT-123'),
];

// JIRA settings validation
export const jiraSettingsValidator = [
  body('baseUrl')
    .trim()
    .notEmpty()
    .withMessage('JIRA base URL is required')
    .isURL()
    .withMessage('Invalid URL format'),
  
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username/Email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('apiToken')
    .trim()
    .notEmpty()
    .withMessage('API token is required'),
];

// LLM settings validation
export const llmSettingsValidator = [
  body('provider')
    .trim()
    .notEmpty()
    .withMessage('LLM provider is required')
    .isIn(['groq', 'ollama'])
    .withMessage('Provider must be "groq" or "ollama"'),
  
  // Conditional validation based on provider
  body('groqApiKey')
    .if(body('provider').equals('groq'))
    .trim()
    .notEmpty()
    .withMessage('Groq API key is required when using Groq provider'),
  
  body('groqModel')
    .if(body('provider').equals('groq'))
    .optional()
    .trim(),
  
  body('groqTemperature')
    .if(body('provider').equals('groq'))
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Temperature must be between 0 and 1'),
  
  body('ollamaBaseUrl')
    .if(body('provider').equals('ollama'))
    .optional()
    .trim()
    .isURL()
    .withMessage('Invalid Ollama base URL'),
  
  body('ollamaModel')
    .if(body('provider').equals('ollama'))
    .optional()
    .trim(),
];

// Test plan generation validation
export const generateTestPlanValidator = [
  body('ticketId')
    .trim()
    .notEmpty()
    .withMessage('Ticket ID is required')
    .matches(/^[A-Z][A-Z0-9]*-\d+$/)
    .withMessage('Invalid JIRA ticket ID format'),
  
  body('provider')
    .trim()
    .notEmpty()
    .withMessage('LLM provider is required')
    .isIn(['groq', 'ollama'])
    .withMessage('Provider must be "groq" or "ollama"'),
  
  body('templateId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Template ID must be a positive integer'),
];

// Template ID validation
export const templateIdValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Template ID must be a positive integer'),
];

// Pagination validation
export const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

export default {
  jiraIdValidator,
  jiraIdBodyValidator,
  jiraSettingsValidator,
  llmSettingsValidator,
  generateTestPlanValidator,
  templateIdValidator,
  paginationValidator,
};
