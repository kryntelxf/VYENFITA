/**
 * VYENFITA AI Service - Entry Point
 * 
 * @version 1.0.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';

import { createAIRouter } from './routes';
import { createWorkflowRouter } from './routes/workflow.routes';
import { createAdvancedRouter } from './routes/advanced.routes';
import { AuthMiddleware } from './middleware/auth.middleware';
import { ProviderConfigManager } from './config/providers.config';
import { WorkflowEngine } from './core/engine/workflow-engine';

dotenv.config();

// ============================================================
// LOGGER
// ============================================================

const logger = winston.createLogger({
  level: process.env.AI_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.prettyPrint()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: process.env.AI_LOG_FILE_PATH || 'ai-service.log',
      format: winston.format.json(),
    }),
  ],
});

// ============================================================
// INITIALIZE SERVICES
// ============================================================

try {
  ProviderConfigManager.initialize();
  const configured = ProviderConfigManager.getConfiguredProviders();
  logger.info(`Configured providers: ${configured.join(', ') || 'none'}`);
} catch (error) {
  logger.warn('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
}

const apiKeys = process.env.AI_API_KEYS?.split(',').filter((k) => k.trim()) || [];
AuthMiddleware.initialize(apiKeys);
logger.info(`Authentication: ${apiKeys.length > 0 ? 'Enabled' : 'Disabled (development mode)'}`);

const workflowEngine = new WorkflowEngine(logger);
logger.info('Workflow Engine initialized');

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001');
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

// ============================================================
// RATE LIMITING
// ============================================================

const limiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.AI_RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
});

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(helmet({
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.use(cors({
  origin: process.env.APPSMITH_API_URL ? [process.env.APPSMITH_API_URL] : '*',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.AI_RATE_LIMIT_ENABLED !== 'false') {
  app.use(limiter);
}

// ============================================================
// REQUEST LOGGING
// ============================================================

app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });
  next();
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'VYENFITA AI',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    providers: ProviderConfigManager.getConfiguredProviders(),
    authentication: apiKeys.length > 0 ? 'enabled' : 'disabled',
    workflows: {
      engine: 'active',
      executions: workflowEngine ? 'available' : 'unavailable',
    },
    endpoints: {
      ai: 13,
      workflow: 8,
      advanced: 26,
      total: 47,
    },
  });
});

// ============================================================
// ROUTES
// ============================================================

app.use('/api/v1/ai', createAIRouter());
app.use('/api/v1/workflow', createWorkflowRouter());
app.use('/api/v1/advanced', createAdvancedRouter());

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Route ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// START SERVER
// ============================================================

const server = app.listen(port, host, () => {
  logger.info('🚀 VYENFITA AI Service started');
  logger.info(`📍 URL: http://${host}:${port}`);
  logger.info(`💚 Health check: http://${host}:${port}/health`);
  logger.info(`🔑 Authentication: ${apiKeys.length > 0 ? 'Enabled' : 'Disabled'}`);
  logger.info(`🤖 Providers: ${ProviderConfigManager.getConfiguredProviders().join(', ') || 'none'}`);
  logger.info(`📊 Total Endpoints: 47+`);
  logger.info(`📝 Log level: ${process.env.AI_LOG_LEVEL || 'info'}`);
});

// ============================================================
// SHUTDOWN
// ============================================================

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  if (workflowEngine) {
    workflowEngine.cleanup();
    logger.info('Workflow engine cleaned up');
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

export { app, server, logger, workflowEngine };
