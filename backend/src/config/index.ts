/**
 * Application Configuration
 * 
 * Loads configuration from environment variables with sensible defaults.
 * Provides type-safe access to configuration values.
 */

import dotenv from 'dotenv';
import path from 'path';
import logger from '../utils/logger';

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

// ============================================
// Configuration Schema
// ============================================

interface Config {
  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  corsOrigin: string;
  
  // Database
  databasePath: string;
  
  // File Storage
  templatesDir: string;
  
  // JIRA (fallback values from env)
  jira: {
    baseUrl: string;
    username: string;
    apiToken: string;
  };
  
  // LLM Providers (fallback values from env)
  llm: {
    provider: 'groq' | 'ollama';
    groq: {
      apiKey: string;
      model: string;
      temperature: number;
    };
    ollama: {
      baseUrl: string;
      model: string;
    };
  };
  
  // Security
  encryptionKey: string;
  
  // Logging
  logLevel: string;
}

// ============================================
// Configuration Loader
// ============================================

function loadConfig(): Config {
  const config: Config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: (process.env.NODE_ENV as Config['nodeEnv']) || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    
    // Database
    databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db'),
    
    // File Storage
    templatesDir: process.env.TEMPLATES_DIR || path.join(process.cwd(), 'templates'),
    
    // JIRA
    jira: {
      baseUrl: process.env.JIRA_BASE_URL || '',
      username: process.env.JIRA_USERNAME || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
    },
    
    // LLM
    llm: {
      provider: (process.env.LLM_PROVIDER as 'groq' | 'ollama') || 'groq',
      groq: {
        apiKey: process.env.GROQ_API_KEY || '',
        model: process.env.GROQ_MODEL || 'llama3-70b-8192',
        temperature: parseFloat(process.env.GROQ_TEMPERATURE || '0.7'),
      },
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3',
      },
    },
    
    // Security
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
  };
  
  // Validate required configurations in production
  if (config.nodeEnv === 'production') {
    const required = [
      { key: 'ENCRYPTION_KEY', value: config.encryptionKey },
    ];
    
    const missing = required.filter(item => !item.value);
    
    if (missing.length > 0) {
      const missingKeys = missing.map(item => item.key).join(', ');
      logger.error(`Missing required environment variables: ${missingKeys}`);
      throw new Error(`Missing required configuration: ${missingKeys}`);
    }
  }
  
  logger.info(`Configuration loaded (environment: ${config.nodeEnv})`);
  
  return config;
}

// ============================================
// Export Configuration
// ============================================

export const config = loadConfig();

export default config;
