/**
 * VYENFITA AI Service - Entry Point
 * 
 * Main entry point for the VYENFITA AI Service.
 * Initializes all routes, middleware, and services.
 * 
 * Architecture:
 * - Public routes: /health, /api/v1/auth/*
 * - Protected routes: /api/v1/* (require JWT auth + tenant isolation)
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

// ============================================================
// ROUTES
// ============================================================

// Public routes
import { createAuthRouter } from './routes/auth.routes';

// Protected routes (require auth + tenant isolation)
import { createAIRouter } from './routes';
import { createWorkflowRouter } from './routes/workflow.routes';
import { createAdvancedRouter } from './routes/advanced.routes';
import { createEnterpriseRouter } from './routes/enterprise.routes';
import { createApplicationRouter } from './routes/application.routes';
import { createTenantRouter } from './routes/tenant.routes';

// ============================================================
// MIDDLEWARE
// ============================================================

import { AuthMiddleware } from './middleware/auth.middleware';
import { TenantMiddleware } from './middleware/tenant.middleware';

// ============================================================
// SERVICES
// ============================================================

import { ProviderConfigManager } from './config/providers.config';
import { WorkflowEngine } from './core/engine/workflow-engine';

// ============================================================
// DATABASE
// ============================================================

import { checkDatabaseHealth, disconnectDatabase } from './lib/database/client';

// Load environment variables
dotenv.config();

// ============================================================
// LOGGER CONFIGURATION
// ============================================================

const logger = winston.createLogger({
  level: process.env.AI_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
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
// VALIDATE REQUIRED ENVIRONMENT VARIABLES
// ============================================================

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

// ============================================================
// INITIALIZE SERVICES
// ============================================================

// Initialize AI provider configurations
try {
  ProviderConfigManager.initialize();
  const configured = ProviderConfigManager.getConfiguredProviders();
  logger.info(`Configured AI providers: ${configured.join(', ') || 'none'}`);
} catch (error) {
  logger.warn('No AI providers configured. AI features may not work.');
}

// Initialize Workflow Engine
const workflowEngine = new WorkflowEngine(logger);
logger.info('Workflow Engine initialized');

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001', 10);
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

// ============================================================
// RATE LIMITING
// ============================================================

const limiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '1000', 10),
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.AI_RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
});

// Stricter limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 min
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // API only, no HTML
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS
app.use(cors({
  origin: process.env.APPSMITH_API_URL
    ? process.env.APPSMITH_API_URL.split(',').map((u) => u.trim())
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (for correct IP behind load balancer)
app.set('trust proxy', 1);

// ============================================================
// REQUEST LOGGING
// ============================================================

app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.userId,
      tenantId: req.user?.tenantId,
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', logData);
    } else {
      logger.info('Request', logData);
    }
  });

  next();
});

// ============================================================
// HEALTH CHECK (PUBLIC)
// ============================================================

app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    const status = dbHealth.healthy ? 'ok' : 'degraded';
    const statusCode = dbHealth.healthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      service: 'VYENFITA AI',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        healthy: dbHealth.healthy,
        latency: dbHealth.latency,
        error: dbHealth.error,
      },
      providers: ProviderConfigManager.getConfiguredProviders(),
      endpoints: {
        auth: 6,
        applications: 8,
        workflows: 5,
        tenant: 10,
        ai: 13,
        advanced: 26,
        enterprise: 14,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'VYENFITA AI',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================
// READINESS CHECK (for Kubernetes)
// ============================================================

app.get('/ready', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    if (!dbHealth.healthy) {
      res.status(503).json({
        ready: false,
        reason: 'Database not ready',
      });
      return;
    }

    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================
// LIVENESS CHECK (for Kubernetes)
// ============================================================

app.get('/live', (req, res) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================================
// PUBLIC ROUTES
// ============================================================

// Apply global rate limiter
if (process.env.AI_RATE_LIMIT_ENABLED !== 'false') {
  app.use(limiter);
}

// Auth routes (with stricter limiter for brute force protection)
app.use('/api/v1/auth', authLimiter, createAuthRouter());

// ============================================================
// PROTECTED ROUTES (Auth + Tenant Isolation)
// ============================================================

// Apply authentication middleware
app.use('/api/v1/applications', AuthMiddleware.validate, TenantMiddleware.enforce, createApplicationRouter());
app.use('/api/v1/workflows', AuthMiddleware.validate, TenantMiddleware.enforce, createWorkflowRouter());
app.use('/api/v1/tenant', AuthMiddleware.validate, TenantMiddleware.enforce, createTenantRouter());
app.use('/api/v1/ai', AuthMiddleware.validate, TenantMiddleware.enforce, createAIRouter());
app.use('/api/v1/advanced', AuthMiddleware.validate, TenantMiddleware.enforce, createAdvancedRouter());
app.use('/api/v1/enterprise', AuthMiddleware.validate, TenantMiddleware.enforce, createEnterpriseRouter());

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((
  err: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.userId,
    tenantId: req.user?.tenantId,
  });

  // Don't leak internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: isProduction ? undefined : err.message,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// START SERVER
// ============================================================

const server = app.listen(port, host, () => {
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('  🚀 VYENFITA AI Service');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  📍 URL:          http://${host}:${port}`);
  logger.info(`  💚 Health:       http://${host}:${port}/health`);
  logger.info(`  🔑 Auth:         http://${host}:${port}/api/v1/auth`);
  logger.info(`  📦 Applications: http://${host}:${port}/api/v1/applications`);
  logger.info(`  ⚡ Workflows:    http://${host}:${port}/api/v1/workflows`);
  logger.info(`  🏢 Tenant:       http://${host}:${port}/api/v1/tenant`);
  logger.info(`  🤖 AI:           http://${host}:${port}/api/v1/ai`);
  logger.info(`  📊 Advanced:     http://${host}:${port}/api/v1/advanced`);
  logger.info(`  🏛️  Enterprise:   http://${host}:${port}/api/v1/enterprise`);
  logger.info('───────────────────────────────────────────────────────');
  logger.info(`  Environment:     ${process.env.NODE_ENV || 'development'}`);
  logger.info(`  AI Providers:    ${ProviderConfigManager.getConfiguredProviders().join(', ') || 'none'}`);
  logger.info(`  Log Level:       ${process.env.AI_LOG_LEVEL || 'info'}`);
  logger.info(`  Rate Limit:      ${process.env.AI_RATE_LIMIT_ENABLED !== 'false' ? 'Enabled' : 'Disabled'}`);
  logger.info('═══════════════════════════════════════════════════════');
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn(`${signal} received but shutdown already in progress`);
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Cleanup workflow engine
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
      logger.error('Error during shutdown', { error });
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

export { app, server, logger, workflowEngine };
