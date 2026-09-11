/**
 * VYENFITA AI Service - Entry Point
 * 
 * @version 3.0.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// ============================================================
// ROUTES
// ============================================================
import { createAIRouter } from './routes';
import { createAuthRouter } from './routes/auth.routes';
import { createApplicationRouter } from './routes/application.routes';
import { createWorkflowRouter } from './routes/workflow.routes';
import { createTenantRouter } from './routes/tenant.routes';
import { createAdvancedRouter } from './routes/advanced.routes';
import { createEnterpriseRouter } from './routes/enterprise.routes';
import { createDeploymentRouter } from './routes/deployment.routes';
import { createObservabilityRouter } from './routes/observability.routes';
import { createAgentRouter } from './routes/agent.routes';

// ============================================================
// MIDDLEWARE
// ============================================================
import { AuthMiddleware } from './middleware/auth.middleware';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { ObservabilityMiddleware } from './middleware/observability.middleware';

// ============================================================
// SERVICES
// ============================================================
import { ProviderConfigManager } from './config/providers.config';
import { WorkflowEngine } from './core/engine/workflow-engine';
import { logger } from './lib/observability/logger';
import { HealthService } from './lib/observability/health.service';

// ============================================================
// ENV
// ============================================================
dotenv.config();

// ============================================================
// INITIALIZE PROVIDERS
// ============================================================

try {
  ProviderConfigManager.initialize();
  const configured = ProviderConfigManager.getConfiguredProviders();
  logger.info(`Configured AI providers: ${configured.join(', ') || 'none'}`);
} catch (error) {
  logger.warn('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
}

// ============================================================
// INITIALIZE AUTH
// ============================================================

const apiKeys = process.env.AI_API_KEYS?.split(',').filter((k) => k.trim()) || [];
AuthMiddleware.initialize(apiKeys);
logger.info(`Auth keys: ${apiKeys.length > 0 ? 'enabled' : 'disabled (dev mode)'}`);

// ============================================================
// INITIALIZE WORKFLOW ENGINE (legacy — kept for backward compat)
// ============================================================

const workflowEngine = new WorkflowEngine(logger);
logger.info('Legacy Workflow Engine initialized');

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001', 10);
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

// ============================================================
// GLOBAL MIDDLEWARE
// ============================================================

// Observability FIRST — every request gets a trace ID
app.use(ObservabilityMiddleware.instrument);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts:
      process.env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
  })
);

// CORS
app.use(
  cors({
    origin: process.env.APPSMITH_API_URL ? [process.env.APPSMITH_API_URL] : '*',
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
if (process.env.AI_RATE_LIMIT_ENABLED !== 'false') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '100', 10),
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: process.env.AI_RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
  });
  app.use(limiter);
}

// ============================================================
// PUBLIC ROUTES (no auth)
// ============================================================

// Observability endpoints (/health, /metrics, etc.)
app.use('/', createObservabilityRouter());

// Auth endpoints (/api/v1/auth/*)
app.use('/api/v1/auth', createAuthRouter());

// ============================================================
// PROTECTED ROUTES (auth + tenant isolation)
// ============================================================

const protectedMiddleware = [AuthMiddleware.validate, TenantMiddleware.enforce];

// AI generation and chat
app.use('/api/v1/ai', ...protectedMiddleware, createAIRouter());

// Applications CRUD
app.use('/api/v1/applications', ...protectedMiddleware, createApplicationRouter());

// Workflows CRUD + execution
app.use('/api/v1/workflows', ...protectedMiddleware, createWorkflowRouter());

// Tenant management
app.use('/api/v1/tenant', ...protectedMiddleware, createTenantRouter());

// Advanced features (NL to SQL, Scheduled reports, Code generation)
app.use('/api/v1/advanced', ...protectedMiddleware, createAdvancedRouter());

// Enterprise features (SSO, Audit, RBAC)
app.use('/api/v1/enterprise', ...protectedMiddleware, createEnterpriseRouter());

// Deployments
app.use('/api/v1/deployments', ...protectedMiddleware, createDeploymentRouter());

// AI Agents (Requirement, Architecture, Testing, Code Review)
app.use('/api/v1/agents', ...protectedMiddleware, createAgentRouter());

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
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
// START SERVER
// ============================================================

const server = app.listen(port, host, () => {
  logger.info('🚀 VYENFITA AI Service started', {
    host,
    port,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || '3.0.0',
  });

  logger.info('📍 Endpoints:', {
    health: `http://${host}:${port}/health`,
    metrics: `http://${host}:${port}/metrics`,
    api: `http://${host}:${port}/api/v1`,
  });

  logger.info('📋 API Routes:', {
    auth: '/api/v1/auth',
    ai: '/api/v1/ai',
    applications: '/api/v1/applications',
    workflows: '/api/v1/workflows',
    tenant: '/api/v1/tenant',
    advanced: '/api/v1/advanced',
    enterprise: '/api/v1/enterprise',
    deployments: '/api/v1/deployments',
    agents: '/api/v1/agents',
  });
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully...`);

  // Cleanup workflow engine
  if (workflowEngine) {
    try {
      workflowEngine.cleanup();
      logger.info('Workflow engine cleaned up');
    } catch (error) {
      logger.warn('Error cleaning up workflow engine', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// PROCESS ERROR HANDLERS
// ============================================================

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  // Don't exit — try to keep the service alive
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // Don't exit — try to keep the service alive
});

// ============================================================
// EXPORTS
// ============================================================

export { app, server, workflowEngine };
