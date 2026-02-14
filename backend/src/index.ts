/**
 * Test Plan Generator - Backend Entry Point
 * 
 * Express server with:
 * - CORS configuration
 * - JSON body parsing
 * - Request logging
 * - API routes
 * - Error handling
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import { config } from './config';
import logger from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getDatabase, closeDatabase } from './database/connection';

// Import routes
import settingsRoutes from './routes/settings';
import jiraRoutes from './routes/jira';
import templateRoutes from './routes/templates';
import testplanRoutes from './routes/testplan';

// ============================================
// Initialize Application
// ============================================

const app = express();

// Ensure required directories exist
function ensureDirectories(): void {
  const dirs = [
    path.dirname(config.databasePath),
    config.templatesDir,
    path.join(process.cwd(), 'logs'),
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

// ============================================
// Middleware
// ============================================

// CORS - Restrict to configured origin in production
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// JSON body parsing
app.use(express.json({ limit: '10mb' }));

// URL-encoded body parsing
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }, 'Incoming request');
  next();
});

// ============================================
// Health Check
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  const db = getDatabase();
  const dbHealthy = db.open;
  
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// ============================================
// API Routes
// ============================================

// Settings routes (JIRA & LLM configuration)
app.use('/api/settings', settingsRoutes);

// JIRA routes (ticket fetching)
app.use('/api/jira', jiraRoutes);

// Template routes (PDF template management)
app.use('/api/templates', templateRoutes);

// Test plan routes (generation and history)
app.use('/api/testplan', testplanRoutes);

// API info endpoint
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Test Plan Generator API',
    version: '1.0.0',
    status: 'Phase 6: LLM Integration Complete - Backend API Ready',
    endpoints: {
      settings: {
        jira: {
          get: 'GET /api/settings/jira',
          save: 'POST /api/settings/jira',
          test: 'POST /api/settings/jira/test',
        },
        llm: {
          get: 'GET /api/settings/llm',
          save: 'POST /api/settings/llm',
          test: 'POST /api/settings/llm/test',
          models: 'GET /api/settings/llm/models',
        },
      },
      jira: {
        fetch: 'GET/POST /api/jira/fetch/:ticketId',
        get: 'GET /api/jira/ticket/:ticketId',
        recent: 'GET /api/jira/recent',
        search: 'GET /api/jira/search?q=query',
        delete: 'DELETE /api/jira/ticket/:ticketId',
      },
      templates: {
        list: 'GET /api/templates',
        get: 'GET /api/templates/:id',
        getDefault: 'GET /api/templates/default',
        upload: 'POST /api/templates/upload',
        update: 'PUT /api/templates/:id',
        setDefault: 'POST /api/templates/:id/default',
        delete: 'DELETE /api/templates/:id',
        download: 'GET /api/templates/:id/download',
      },
      testplan: {
        generate: 'POST /api/testplan/generate (SSE streaming)',
        generateSync: 'POST /api/testplan/generate-sync',
        history: 'GET /api/testplan/history',
        get: 'GET /api/testplan/history/:id',
        delete: 'DELETE /api/testplan/history/:id',
        export: 'GET /api/testplan/history/:id/export',
      },
    },
  });
});

// ============================================
// Static Files (Templates)
// ============================================

app.use('/templates', express.static(config.templatesDir));

// ============================================
// Error Handling
// ============================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// Server Startup
// ============================================

function startServer(): void {
  try {
    // Ensure directories exist
    ensureDirectories();
    
    // Initialize database connection
    getDatabase();
    
    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   Test Plan Generator Server                           ║
║   - Environment: ${config.nodeEnv.padEnd(33)}║
║   - Port: ${config.port.toString().padEnd(42)}║
║   - CORS Origin: ${config.corsOrigin.padEnd(33)}║
║   - Database: ${config.databasePath.padEnd(36)}║
║                                                        ║
║   Backend API is READY!                                ║
║                                                        ║
║   Settings:                                            ║
║   - GET/POST /api/settings/jira                        ║
║   - POST     /api/settings/jira/test                   ║
║   - GET/POST /api/settings/llm                         ║
║   - GET      /api/settings/llm/models                  ║
║                                                        ║
║   JIRA:                                                ║
║   - GET/POST /api/jira/fetch/:ticketId                 ║
║   - GET      /api/jira/recent                          ║
║   - GET      /api/jira/search                          ║
║                                                        ║
║   Templates:                                           ║
║   - GET      /api/templates                            ║
║   - POST     /api/templates/upload                     ║
║                                                        ║
║   Test Plan:                                           ║
║   - POST     /api/testplan/generate (SSE)              ║
║   - GET      /api/testplan/history                     ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
    });
    
    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function gracefulShutdown(server: ReturnType<typeof app.listen>): void {
  logger.info('Received shutdown signal. Closing server gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connection
    closeDatabase();
    
    logger.info('Cleanup complete. Exiting.');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
}

// Start the server
startServer();

export default app;
