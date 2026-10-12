/**
 * VYENFITA AI Service - Entry Point
 * 
 * @version 4.0.0
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
import { createFinOpsRouter } from './routes/finops.routes';
import { createMarketplaceRouter } from './routes/marketplace.routes';
import { createAnalyticsRouter } from './routes/analytics.routes';
import { createGDPRRouter } from './routes/gdpr.routes';

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
import { getSchedulerService } from './lib/workflow/scheduler.service';
import { getRetentionScheduler } from './lib/retention/retention.scheduler';
import { getQueueService, isQueueEnabled } from './lib/queue/queue.service';
import { getWorkerService } from './lib/queue/worker.service';
import { logger } from './lib/observability/logger';

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
// INITIALIZE WORKFLOW ENGINE
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

app.use(ObservabilityMiddleware.instrument);

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

app.use(
  cors({
    origin: process.env.APPSMITH_API_URL ? [process.env.APPSMITH_API_URL] : '*',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

app.use('/', createObservabilityRouter());
app.use('/api/v1/auth', createAuthRouter());
app.use('/api/v1/marketplace', createMarketplaceRouter());

// ============================================================
// PROTECTED ROUTES (auth + tenant isolation)
// ============================================================

const protectedMiddleware = [AuthMiddleware.validate, TenantMiddleware.enforce];

app.use('/api/v1/ai', ...protectedMiddleware, createAIRouter());
app.use('/api/v1/applications', ...protectedMiddleware, createApplicationRouter());
app.use('/api/v1/workflows', ...protectedMiddleware, createWorkflowRouter());
app.use('/api/v1/tenant', ...protectedMiddleware, createTenantRouter());
app.use('/api/v1/advanced', ...protectedMiddleware, createAdvancedRouter());
app.use('/api/v1/enterprise', ...protectedMiddleware, createEnterpriseRouter());
app.use('/api/v1/deployments', ...protectedMiddleware, createDeploymentRouter());
app.use('/api/v1/agents', ...protectedMiddleware, createAgentRouter());
app.use('/api/v1/finops', ...protectedMiddleware, createFinOpsRouter());
app.use('/api/v1/analytics', ...protectedMiddleware, createAnalyticsRouter());
app.use('/api/v1', ...protectedMiddleware, createGDPRRouter());

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

// Module-scope references for graceful shutdown
let queueServiceRef: ReturnType<typeof getQueueService> | undefined;
let workerServiceRef: ReturnType<typeof getWorkerService> | undefined;

const server = app.listen(port, host, () => {
  logger.info('🚀 VYENFITA AI Service started', {
    host,
    port,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || '4.0.0',
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
    finops: '/api/v1/finops',
    marketplace: '/api/v1/marketplace',
    analytics: '/api/v1/analytics',
    gdpr: '/api/v1/users/me/export, /api/v1/users/me, /api/v1/tenants/me/export',
  });

  // Start workflow scheduler
  const scheduler = getSchedulerService();
  scheduler.start();
  logger.info('⏰ Workflow Scheduler started');

  // Start retention scheduler
  const retentionScheduler = getRetentionScheduler();
  retentionScheduler.start();
  logger.info('🧹 Retention scheduler started');

  // Start BullMQ workers (if enabled)
  if (isQueueEnabled()) {
    try {
      queueServiceRef = getQueueService();
      workerServiceRef = getWorkerService();
      workerServiceRef.start();
      logger.info('🔧 BullMQ workers started');
    } catch (error) {
      logger.error('Failed to start BullMQ workers, falling back to legacy schedulers', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      queueServiceRef = undefined;
      workerServiceRef = undefined;
    }
  } else {
    logger.info('ℹ️  BullMQ disabled (USE_BULLMQ != true)');
  }
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

  // Stop workflow scheduler
  try {
    const scheduler = getSchedulerService();
    scheduler.stop();
    logger.info('Workflow scheduler stopped');
  } catch (error) {
    logger.warn('Error stopping workflow scheduler', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Stop retention scheduler
  try {
    const retentionScheduler = getRetentionScheduler();
    retentionScheduler.stop();
    logger.info('Retention scheduler stopped');
  } catch (error) {
    logger.warn('Error stopping retention scheduler', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Stop BullMQ workers
  if (workerServiceRef) {
    try {
      await workerServiceRef.stop();
      logger.info('BullMQ workers stopped');
    } catch (error) {
      logger.warn('Error stopping BullMQ workers', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  if (queueServiceRef) {
    try {
      await queueServiceRef.shutdown();
      logger.info('Queue service shut down');
    } catch (error) {
      logger.warn('Error shutting down queue service', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

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
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// ============================================================
// EXPORTS
// ============================================================

export { app, server, workflowEngine };
