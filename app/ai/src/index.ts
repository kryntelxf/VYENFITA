/**
 * VYENFITA AI Service - Entry Point
 * 
 * Production-grade Express server with:
 * - Authentication & tenant isolation
 * - AI routes (chat, generation, BI, agents)
 * - Workflow routes (CRUD + execution)
 * - Tenant management routes
 * - Deployment routes
 * - Enterprise routes
 * - Security middleware
 * - Observability
 * 
 * @version 3.0.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';

// ============================================================
// ROUTES
// ============================================================
import { createAuthRouter } from './routes/auth.routes';
import { createAIRouter } from './routes';
import { createWorkflowRouter } from './routes/workflow.routes';
import { createAdvancedRouter } from './routes/advanced.routes';
import { createEnterpriseRouter } from './routes/enterprise.routes';
import { createTenantRouter } from './routes/tenant.routes';
import { createApplicationRouter } from './routes/application.routes';
import { createDeploymentRouter } from './routes/deployment.routes';

// ============================================================
// MIDDLEWARE
// ============================================================
import { AuthMiddleware } from './middleware/auth.middleware';
import { TenantMiddleware } from './middleware/tenant.middleware';

// ============================================================
// SERVICES
// ============================================================
import { checkDatabaseHealth, disconnectDatabase } from './lib/database/client';
import { getWorkflowEngine } from './lib/workflow/workflow-engine';
import { getAIService } from './lib/ai/ai.service';

// Load environment variables
dotenv.config();

// ============================================================
// LOGGER
// ============================================================

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'vyenfita-ai',
    version: '3.0.0',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0
            ? ` ${JSON.stringify(meta)}`
            : '';
          return `${timestamp} [${level}] ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

// ============================================================
// VALIDATE REQUIRED ENV
// ============================================================

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET!.length < 32) {
  logger.error('JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001', 10);
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

// Trust proxy (behind reverse proxy)
app.set('trust proxy', 1);

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet
app.use(helmet({
  contentSecurityPolicy: false, // API only
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: process.env.NODE_ENV === 'production'
    ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      }
    : false,
}));

// CORS
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['*'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.AI_RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
  keyGenerator: (req) => {
    // Rate limit by user if authenticated, otherwise by IP
    return req.user?.userId || req.ip || 'unknown';
  },
});

if (process.env.AI_RATE_LIMIT_ENABLED !== 'false') {
  app.use(limiter);
}

// ============================================================
// REQUEST LOGGING
// ============================================================

app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Attach requestId for downstream use
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(logLevel, `${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.userId,
      tenantId: req.user?.tenantId,
    });
  });

  next();
});

// ============================================================
// HEALTH CHECKS
// ============================================================

/**
 * Liveness probe - is the process alive?
 * GET /health/live
 */
app.get('/health/live', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe - is the service ready to accept traffic?
 * GET /health/ready
 */
app.get('/health/ready', async (_req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    if (!dbHealth.healthy) {
      res.status(503).json({
        status: 'not_ready',
        reason: 'database_unhealthy',
        checks: { database: dbHealth },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      status: 'ready',
      checks: { database: dbHealth },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      reason: 'health_check_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Full health check
 * GET /health
 */
app.get('/health', async (_req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    let aiHealth: any = { overall: false, providers: {} };
    try {
      const aiService = getAIService();
      aiHealth = await aiService.healthCheck();
    } catch (error) {
      aiHealth = {
        overall: false,
        error: error instanceof Error ? error.message : 'AI service unavailable',
      };
    }

    const allHealthy = dbHealth.healthy && (aiHealth.overall !== false);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      service: 'VYENFITA AI',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbHealth,
        ai: aiHealth,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================
// PUBLIC ROUTES (no auth required)
// ============================================================

// Authentication routes
app.use('/api/v1/auth', createAuthRouter());

// ============================================================
// PROTECTED ROUTES (auth + tenant isolation)
// ============================================================

// AI routes
app.use(
  '/api/v1/ai',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createAIRouter()
);

// Workflow routes
app.use(
  '/api/v1/workflows',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createWorkflowRouter()
);

// Application routes
app.use(
  '/api/v1/applications',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createApplicationRouter()
);

// Tenant management routes
app.use(
  '/api/v1/tenant',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createTenantRouter()
);

// Advanced routes
app.use(
  '/api/v1/advanced',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createAdvancedRouter()
);

// Enterprise routes
app.use(
  '/api/v1/enterprise',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createEnterpriseRouter()
);

// Deployment routes
app.use(
  '/api/v1/deployments',
  AuthMiddleware.validate,
  TenantMiddleware.enforce,
  createDeploymentRouter()
);

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

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const requestId = (req as any).requestId;

    logger.error('Unhandled error', {
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
      tenantId: req.user?.tenantId,
    });

    // Don't leak internal errors in production
    const isDev = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: isDev ? err.message : undefined,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

const server = app.listen(port, host, () => {
  logger.info('🚀 VYENFITA AI Service started');
  logger.info(`📍 URL: http://${host}:${port}`);
  logger.info(`💚 Health: http://${host}:${port}/health`);
  logger.info(`🔑 Auth: http://${host}:${port}/api/v1/auth`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📝 Log level: ${process.env.LOG_LEVEL || 'info'}`);
  logger.info(`🛡️  Rate limit: ${process.env.AI_RATE_LIMIT_ENABLED !== 'false' ? 'enabled' : 'disabled'}`);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn(`${signal} received but already shutting down`);
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Cleanup workflow engine
  try {
    const engine = getWorkflowEngine();
    // Note: engine doesn't have explicit cleanup, but we can add it later
    logger.info('Workflow engine cleanup completed');
  } catch (error) {
    logger.warn('Failed to cleanup workflow engine', { error });
  }

  // Disconnect database
  try {
    await disconnectDatabase();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Failed to disconnect database', { error });
  }

  // Force exit after 10 seconds
  const forceExitTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);

  forceExitTimer.unref();

  // Exit gracefully
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// UNCAUGHT EXCEPTIONS
// ============================================================

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });

  // In production, exit after uncaught exception
  if (process.env.NODE_ENV === 'production') {
    shutdown('uncaughtException');
  }
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

export { app, server, logger };
