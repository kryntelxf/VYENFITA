/**
 * VYENFITA AI Service - Entry Point
 * 
 * Production-grade entry point with:
 * - Real authentication
 * - Tenant isolation
 * - Database persistence
 * - Graceful shutdown
 * - Health checks
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
import { auditService } from './lib/audit/audit.service';

// ============================================================
// ROUTES
// ============================================================

import { createAuthRouter } from './routes/auth.routes';
import { createAIRouter } from './routes';
import { createWorkflowRouter } from './routes/workflow.routes';
import { createAdvancedRouter } from './routes/advanced.routes';
import { createEnterpriseRouter } from './routes/enterprise.routes';

// ============================================================
// MIDDLEWARE
// ============================================================

import { AuthMiddleware } from './middleware/auth.middleware';
import { TenantMiddleware } from './middleware/tenant.middleware';

// ============================================================
// CONFIG
// ============================================================

import { ProviderConfigManager } from './config/providers.config';

// ============================================================
// ENGINE
// ============================================================

import { WorkflowEngine } from './core/engine/workflow-engine';

// ============================================================
// ENVIRONMENT
// ============================================================

dotenv.config();

// ============================================================
// STARTUP VALIDATION
// ============================================================

function validateStartup(): void {
  const required: string[] = ['DATABASE_URL', 'JWT_SECRET'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Service cannot start.`
    );
  }

  if ((process.env.JWT_SECRET || '').length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long for security.'
    );
  }
}

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
    version: '1.0.0',
  },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
    }),
    ...(process.env.LOG_FILE_PATH
      ? [
          new winston.transports.File({
            filename: process.env.LOG_FILE_PATH,
            format: winston.format.json(),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

// ============================================================
// STARTUP
// ============================================================

async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting VYENFITA AI Service...');

    // Validate environment
    validateStartup();
    logger.info('✅ Environment validation passed');

    // Initialize AI providers
    try {
      ProviderConfigManager.initialize();
      const configured = ProviderConfigManager.getConfiguredProviders();
      logger.info(`✅ AI providers initialized: ${configured.join(', ') || 'none'}`);
    } catch (error) {
      logger.warn('⚠️  No AI providers configured. AI features will not work.', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Check database
    const dbHealth = await checkDatabaseHealth();
    if (!dbHealth.healthy) {
      throw new Error(`Database connection failed: ${dbHealth.error}`);
    }
    logger.info(`✅ Database connected (latency: ${dbHealth.latency}ms)`);

    // Create Express app
    const app = createApp();

    // Start server
    const port = parseInt(process.env.AI_SERVICE_PORT || '3001', 10);
    const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

    const server = app.listen(port, host, () => {
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('🎉 VYENFITA AI Service started successfully');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info(`📍 URL:            http://${host}:${port}`);
      logger.info(`💚 Health check:   http://${host}:${port}/health`);
      logger.info(`📊 Metrics:        http://${host}:${port}/metrics`);
      logger.info(`🔐 Environment:    ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🤖 AI Providers:   ${ProviderConfigManager.getConfiguredProviders().join(', ') || 'none'}`);
      logger.info(`📝 Log level:      ${process.env.LOG_LEVEL || 'info'}`);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // Graceful shutdown
    setupGracefulShutdown(server);
  } catch (error) {
    logger.error('❌ Failed to start service:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// ============================================================
// CREATE EXPRESS APP
// ============================================================

function createApp(): express.Application {
  const app = express();

  // ----------------------------------------
  // Security middleware
  // ----------------------------------------

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // ----------------------------------------
  // CORS
  // ----------------------------------------

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow no-origin requests (mobile apps, curl)
        if (!origin) return callback(null, true);

        // Wildcard
        if (allowedOrigins.includes('*')) return callback(null, true);

        // Exact match
        if (allowedOrigins.includes(origin)) return callback(null, true);

        callback(new Error('CORS: Origin not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Request-Id'],
    })
  );

  // ----------------------------------------
  // Body parsing
  // ----------------------------------------

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ----------------------------------------
  // Rate limiting
  // ----------------------------------------

  if (process.env.AI_RATE_LIMIT_ENABLED !== 'false') {
    const limiter = rateLimit({
      windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000', 10),
      max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '1000', 10),
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      skip: (req) => {
        // Skip rate limiting for health & metrics
        return req.path === '/health' || req.path === '/metrics';
      },
    });
    app.use(limiter);
  }

  // ----------------------------------------
  // Request ID + logging
  // ----------------------------------------

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.userId,
        tenantId: req.user?.tenantId,
      };

      // Log level based on status
      if (res.statusCode >= 500) {
        logger.error('Request failed', logData);
      } else if (res.statusCode >= 400) {
        logger.warn('Request error', logData);
      } else {
        logger.info('Request completed', logData);
      }
    });

    next();
  });

  // ----------------------------------------
  // Health check (no auth, no tenant)
  // ----------------------------------------

  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const dbHealth = await checkDatabaseHealth();

      const status = dbHealth.healthy ? 'healthy' : 'unhealthy';
      const httpStatus = dbHealth.healthy ? 200 : 503;

      res.status(httpStatus).json({
        status,
        service: 'vyenfita-ai',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: {
            status: dbHealth.healthy ? 'pass' : 'fail',
            latency: dbHealth.latency,
            error: dbHealth.error,
          },
          aiProviders: {
            status: 'pass',
            configured: ProviderConfigManager.getConfiguredProviders(),
          },
        },
        environment: process.env.NODE_ENV || 'development',
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'vyenfita-ai',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ----------------------------------------
  // Readiness probe (Kubernetes)
  // ----------------------------------------

  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      if (!dbHealth.healthy) {
        res.status(503).json({ ready: false, reason: 'database not ready' });
        return;
      }
      res.json({ ready: true });
    } catch (error) {
      res.status(503).json({ ready: false, reason: 'unknown' });
    }
  });

  // ----------------------------------------
  // Liveness probe (Kubernetes)
  // ----------------------------------------

  app.get('/live', (_req: Request, res: Response) => {
    res.json({ alive: true });
  });

  // ----------------------------------------
  // Metrics (basic)
  // ----------------------------------------

  app.get('/metrics', (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    res.json({
      timestamp: new Date().toISOString(),
      process: {
        uptime: process.uptime(),
        memory: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external,
        },
        cpu: {
          user: cpu.user,
          system: cpu.system,
        },
        pid: process.pid,
        version: process.version,
      },
    });
  });

  // ----------------------------------------
  // PUBLIC ROUTES
  // ----------------------------------------

  app.use('/api/v1/auth', createAuthRouter());

  // ----------------------------------------
  // PROTECTED ROUTES
  // Require: authentication + tenant context
  // ----------------------------------------

  app.use(
    '/api/v1/ai',
    AuthMiddleware.validate,
    TenantMiddleware.enforce,
    createAIRouter()
  );

  app.use(
    '/api/v1/workflow',
    AuthMiddleware.validate,
    TenantMiddleware.enforce,
    createWorkflowRouter()
  );

  app.use(
    '/api/v1/advanced',
    AuthMiddleware.validate,
    TenantMiddleware.enforce,
    createAdvancedRouter()
  );

  app.use(
    '/api/v1/enterprise',
    AuthMiddleware.validate,
    TenantMiddleware.enforce,
    createEnterpriseRouter()
  );

  // ----------------------------------------
  // 404 handler
  // ----------------------------------------

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      code: 'NOT_FOUND',
      path: `${req.method} ${req.path}`,
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  });

  // ----------------------------------------
  // Error handler
  // ----------------------------------------

  app.use(
    (err: Error, req: Request, res: Response, _next: NextFunction) => {
      const requestId = (req as any).requestId;
      const isProduction = process.env.NODE_ENV === 'production';

      logger.error('Unhandled error', {
        requestId,
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.userId,
        tenantId: req.user?.tenantId,
      });

      // Audit security-relevant errors
      if (req.user) {
        auditService
          .log({
            tenantId: req.user.tenantId,
            userId: req.user.userId,
            eventType: 'system',
            action: 'unhandled_error',
            resource: req.path,
            status: 'error',
            errorMessage: err.message,
            requestId,
          })
          .catch(() => {
            // Swallow audit errors
          });
      }

      res.status(500).json({
        success: false,
        error: isProduction ? 'Internal server error' : err.message,
        code: 'INTERNAL_ERROR',
        requestId,
        timestamp: new Date().toISOString(),
        ...(isProduction ? {} : { stack: err.stack }),
      });
    }
  );

  return app;
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function setupGracefulShutdown(server: any): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`${signal} received again, but shutdown already in progress`);
      return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await disconnectDatabase();
        logger.info('Database disconnected');
      } catch (error) {
        logger.error('Error during database disconnect', { error });
      }

      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('⏱️  Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('💥 Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason: any) => {
    logger.error('💥 Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    shutdown('unhandledRejection');
  });
}

// ============================================================
// START
// ============================================================

bootstrap();

// ============================================================
// EXPORTS (for testing)
// ============================================================

export { createApp, logger };
