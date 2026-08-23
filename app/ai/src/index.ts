/**
 * VYENFITA AI Service - Entry Point
 * 
 * This is the main entry point for the VYENFITA AI Service.
 * It initializes all routes, middleware, and services.
 * 
 * @version 1.0.0
 * @since 0.1.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';

// Import routes
import { createAIRouter } from './routes';
import { createWorkflowRouter } from './routes/workflow.routes';

// Import middleware
import { AuthMiddleware } from './middleware/auth.middleware';

// Import config
import { ProviderConfigManager } from './config/providers.config';

// Import workflow engine for health check
import { WorkflowEngine } from './core/engine/workflow-engine';

// Load environment variables
dotenv.config();

// ============================================================
// LOGGER CONFIGURATION
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

// Initialize provider configurations
try {
  ProviderConfigManager.initialize();
  const configured = ProviderConfigManager.getConfiguredProviders();
  logger.info(`Configured providers: ${configured.join(', ') || 'none'}`);
} catch (error) {
  logger.warn('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
}

// Initialize authentication
const apiKeys = process.env.AI_API_KEYS?.split(',').filter((k) => k.trim()) || [];
AuthMiddleware.initialize(apiKeys);
logger.info(`Authentication: ${apiKeys.length > 0 ? 'Enabled' : 'Disabled (development mode)'}`);

// Initialize Workflow Engine for health checks
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

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS
app.use(cors({
  origin: process.env.APPSMITH_API_URL ? [process.env.APPSMITH_API_URL] : '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
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
      contentLength: req.headers['content-length'],
    });
  });
  next();
});

// ============================================================
// HEALTH CHECK ENDPOINT (PUBLIC)
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
  });
});

// ============================================================
// API ROUTES
// ============================================================

// AI Routes (chat, generate, validate, repair, etc.)
app.use('/api/v1/ai', createAIRouter());

// Workflow Routes (execute, generate-and-execute, executions)
app.use('/api/v1/workflow', createWorkflowRouter());

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ============================================================
// ERROR HANDLING MIDDLEWARE
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
  });
});

// ============================================================
// START SERVER
// ============================================================

const server = app.listen(port, host, () => {
  logger.info('🚀 VYENFITA AI Service started');
  logger.info(`📍 URL: http://${host}:${port}`);
  logger.info(`💚 Health check: http://${host}:${port}/health`);
  logger.info(`🔑 Authentication: ${apiKeys.length > 0 ? 'Enabled' : 'Disabled (dev mode)'}`);
  logger.info(`🤖 Available providers: ${ProviderConfigManager.getConfiguredProviders().join(', ') || 'none'}`);
  logger.info(`⚡ Workflow Engine: Active`);
  logger.info(`📝 Log level: ${process.env.AI_LOG_LEVEL || 'info'}`);
  
  // Log all routes for debugging
  const routes: string[] = [];
  app._router?.stack.forEach((layer: any) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
      routes.push(`${methods} ${layer.route.path}`);
    }
  });
  logger.info(`📋 Available routes: ${routes.length} endpoints`);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  // Cleanup workflow engine
  if (workflowEngine) {
    workflowEngine.cleanup();
    logger.info('Workflow engine cleaned up');
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// UNCAUGHT EXCEPTIONS
// ============================================================

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  // Don't exit immediately, try to recover
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

// ============================================================
// EXPORTS
// ============================================================

export { app, server, logger, workflowEngine };
