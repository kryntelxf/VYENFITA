/**
 * VYENFITA AI Service - Entry Point
 * 
 * Production-grade service with:
 * - Database connection
 * - Authentication (JWT + sessions)
 * - Tenant isolation
 * - Permission enforcement
 * - Audit logging
 * - Rate limiting
 * - Health checks
 * - Graceful shutdown
 * 
 * @version 1.0.0
 * @since 0.1.0
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';

// ============================================================
// LIB
// ============================================================

import { prisma, checkDatabaseHealth, disconnectDatabase } from './lib/database/client';
import { AuthMiddleware } from './middleware/auth.middleware';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { auditService } from './lib/audit/audit.service';

// ============================================================
// CONFIG
// ============================================================

import { ProviderConfigManager } from './config/providers.config';

// ============================================================
// ENGINES
// ============================================================

import { WorkflowEngine } from './core/engine/workflow-engine';
import { AdvancedWorkflowEngine } from './core/engine/advanced-workflow-engine';

// ============================================================
// ROUTES
// ============================================================

import { createAuthRouter } from './routes/auth.routes';
import { createAIRouter } from './routes';
import { createWorkflowRouter } from './routes/workflow.routes';
import { createAdvancedRouter } from './routes/advanced.routes';
import { createEnterpriseRouter } from './routes/enterprise.routes';
import { createApplicationRouter } from './routes/application.routes';

// ============================================================
// ENVIRONMENT
// ============================================================

dotenv.config();

// ============================================================
// STARTUP VALIDATION
// ============================================================

function validateEnvironment(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Set them in .env file or environment');
    process.exit(1);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters');
    process.exit(1);
  }
}

validateEnvironment();

// ============================================================
// LOGGER
// ============================================================

const logger = winston.createLogger({
  level: process.env.AI_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'vyenfita-ai',
    version: '1.0.0',
  },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaStr = Object.keys(meta).length
                  ? ` ${JSON.stringify(meta)}`
                  : '';
                return `${timestamp} [${level}]: ${message}${metaStr}`;
              })
            ),
    }),
  ],
});

// ============================================================
// INITIALIZE SERVICES
// ============================================================

// Initialize AI provider configurations
try {
  ProviderConfigManager.initialize();
  const configured = ProviderConfigManager.getConfiguredProviders();
  logger.info(`AI providers configured: ${configured.join(', ') || 'none'}`);
} catch (error) {
  logger.warn('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
}

// Initialize workflow engines
const workflowEngine = new WorkflowEngine(logger);
logger.info('Workflow Engine initialized');

const advancedWorkflowEngine = new AdvancedWorkflowEngine(logger);
logger.info('Advanced Workflow Engine initialized');

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001', 10);
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

// Trust proxy for accurate IP behind load balancer
app.set('trust proxy', 1);

// Disable etag for security
app.disable('x-powered-by');

// ============================================================
// RATE LIMITING
// ============================================================

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.AI_RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return (req as any).user?.userId || req.ip || 'unknown';
  },
});

// Stricter limiter for auth routes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for API
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  })
);

app.use(
  cors({
    origin: process.env.APPSMITH_API_URL
      ? [process.env.APPSMITH_API_URL]
      : process.env.NODE_ENV === 'production'
      ? false // Block CORS in production without explicit origin
      : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Request-Id'],
    maxAge: 86400,
  })
);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting
if (process.env.AI_RATE_LIMIT_ENABLED !== 'false') {
  app.use(globalLimiter);
}

// ============================================================
// REQUEST ID & LOGGING
// ============================================================

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, `${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.userId,
      tenantId: (req as any).user?.tenantId,
    });
  });

  next();
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const dbHealth = await checkDatabaseHealth();

    const healthy = dbHealth.healthy;
    const status = healthy ? 'ok' : 'degraded';

    res.status(healthy ? 200 : 503).json({
      status,
      service: 'vyenfita-ai',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: {
          healthy: dbHealth.healthy,
          latency: dbHealth.latency,
          error: dbHealth.error,
        },
      },
      providers: ProviderConfigManager.getConfiguredProviders(),
      authentication: 'enabled',
      endpoints: {
        auth: 6,
        applications: 8,
        workflows: 5,
        ai: 13,
        advanced: 26,
        enterprise: 14,
      },
      responseTime: Date.now() - startTime,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'vyenfita-ai',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

// ============================================================
// READINESS & LIVENESS PROBES (Kubernetes)
// ============================================================

app.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    if (!dbHealth.healthy) {
      res.status(503).json({
        ready: false,
        reason: 'Database not available',
      });
      return;
    }

    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/live', (req: Request, res: Response) => {
  res.json({ alive: true, uptime: process.uptime() });
});

// ============================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================

// Authentication routes (with stricter rate limiting)
app.use('/api/v1/auth', authLimiter, createAuthRouter());

// ============================================================
// PROTECTED ROUTES (Authentication + Tenant Isolation Required)
// ============================================================

// Core AI routes
app.use(
  '/api/v1/ai',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createAIRouter()
);

// Application CRUD routes
app.use(
  '/api/v1/applications',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createApplicationRouter()
);

// Workflow CRUD routes (new, plural)
app.use(
  '/api/v1/workflows',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createWorkflowRouter()
);

// Advanced features (NL-to-SQL, scheduled reports, code gen)
app.use(
  '/api/v1/advanced',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createAdvancedRouter()
);

// Enterprise features (SSO, audit, RBAC, analytics)
app.use(
  '/api/v1/enterprise',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createEnterpriseRouter()
);

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    message: `${req.method} ${req.path} does not exist`,
    requestId: (req as any).requestId,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId;

    logger.error('Unhandled error', {
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    // Don't leak internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (res.headersSent) {
      return next(err);
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: isDevelopment ? err.message : undefined,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

const server = app.listen(port, host, () => {
  logger.info('🚀 VYENFITA AI Service started', {
    url: `http://${host}:${port}`,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid,
  });

  logger.info(`📍 Health check: http://${host}:${port}/health`);
  logger.info(`🔑 Auth: enabled`);
  logger.info(`🏢 Tenant isolation: enforced`);
  logger.info(`🤖 AI providers: ${ProviderConfigManager.getConfiguredProviders().join(', ') || 'none'}`);
  logger.info(`📊 Total endpoints: 72+`);
});

// Set server timeouts
server.keepAliveTimeout = 65000; // > load balancer idle timeout
server.headersTimeout = 66000;

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

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Cleanup workflow engines
      if (workflowEngine) {
        workflowEngine.cleanup();
        logger.info('Workflow engine cleaned up');
      }

      // Disconnect from database
      await disconnectDatabase();
      logger.info('Database disconnected');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// UNCAUGHT EXCEPTIONS
// ============================================================

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });

  // Attempt graceful shutdown
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// ============================================================
// PERIODIC TASKS
// ============================================================

// Cleanup expired sessions every hour
setInterval(
  async () => {
    try {
      const { SessionService } = await import('./lib/auth/session.service');
      const count = await SessionService.cleanupExpired();
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired sessions`);
      }
    } catch (error) {
      logger.error('Session cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
  60 * 60 * 1000 // 1 hour
);

// Cleanup old audit events daily
setInterval(
  async () => {
    try {
      const count = await auditService.cleanup();
      if (count > 0) {
        logger.info(`Cleaned up ${count} old audit events`);
      }
    } catch (error) {
      logger.error('Audit cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
  24 * 60 * 60 * 1000 // 24 hours
);

// ============================================================
// EXPORTS
// ============================================================

export {
  app,
  server,
  logger,
  workflowEngine,
  advancedWorkflowEngine,
};

export default app;
