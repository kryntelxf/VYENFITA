/**
 * VYENFITA AI Service - Entry Point
 * 
 * @version 2.0.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { createAIRouter } from './routes';
import { createAuthRouter } from './routes/auth.routes';
import { createApplicationRouter } from './routes/application.routes';
import { createWorkflowRouter } from './routes/workflow.routes';
import { createTenantRouter } from './routes/tenant.routes';
import { createAdvancedRouter } from './routes/advanced.routes';
import { createEnterpriseRouter } from './routes/enterprise.routes';
import { createDeploymentRouter } from './routes/deployment.routes';
import { createObservabilityRouter } from './routes/observability.routes';

import { AuthMiddleware } from './middleware/auth.middleware';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { ObservabilityMiddleware } from './middleware/observability.middleware';

import { ProviderConfigManager } from './config/providers.config';
import { WorkflowEngine } from './core/engine/workflow-engine';
import { logger } from './lib/observability/logger';
import { HealthService } from './lib/observability/health.service';

dotenv.config();

// ============================================================
// INITIALIZE
// ============================================================

try {
  ProviderConfigManager.initialize();
  const configured = ProviderConfigManager.getConfiguredProviders();
  logger.info(`Configured providers: ${configured.join(', ') || 'none'}`);
} catch (error) {
  logger.warn('No AI providers configured');
}

const apiKeys = process.env.AI_API_KEYS?.split(',').filter((k) => k.trim()) || [];
AuthMiddleware.initialize(apiKeys);
logger.info(`Auth: ${apiKeys.length > 0 ? 'enabled' : 'disabled (dev)'}`);

const workflowEngine = new WorkflowEngine(logger);
logger.info('Workflow Engine initialized');

// ============================================================
// EXPRESS
// ============================================================

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001');
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

// ============================================================
// GLOBAL MIDDLEWARE
// ============================================================

// Observability FIRST (so all requests get traced)
app.use(ObservabilityMiddleware.instrument);

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
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
  const limiter = rateLimit({
    windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: process.env.AI_RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
  });
  app.use(limiter);
}

// ============================================================
// OBSERVABILITY ROUTES (public)
// ============================================================

app.use('/', createObservabilityRouter());

// ============================================================
// AUTH ROUTES (public — handles its own auth)
// ============================================================

app.use('/api/v1/auth', createAuthRouter());

// ============================================================
// PROTECTED ROUTES
// ============================================================

// All protected routes require:
// 1. Valid JWT (AuthMiddleware)
// 2. Tenant context (TenantMiddleware)

const protectedMiddleware = [
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
];

app.use('/api/v1/ai', ...protectedMiddleware, createAIRouter());
app.use('/api/v1/applications', ...protectedMiddleware, createApplicationRouter());
app.use('/api/v1/workflows', ...protectedMiddleware, createWorkflowRouter());
app.use('/api/v1/tenant', ...protectedMiddleware, createTenantRouter());
app.use('/api/v1/advanced', ...protectedMiddleware, createAdvancedRouter());
app.use('/api/v1/enterprise', ...protectedMiddleware, createEnterpriseRouter());
app.use('/api/v1/deployments', ...protectedMiddleware, createDeploymentRouter());

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    traceId: req.traceId,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      traceId: req.traceId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      traceId: req.traceId,
      timestamp: new Date().toISOString(),
    });
  }
);

// ============================================================
// START
// ============================================================

const server = app.listen(port, host, () => {
  logger.info('🚀 VYENFITA AI Service started', {
    host,
    port,
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down...`);

  if (workflowEngine) {
    workflowEngine.cleanup();
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
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

export { app, server, workflowEngine };
