/**
 * VYENFITA Database Client
 * 
 * Production-grade database client with:
 * - Connection pooling
 * - Graceful shutdown
 * - Health check
 * - Transaction support
 * - Query logging
 * 
 * @version 1.0.0
 */

import { PrismaClient, Prisma } from '@prisma/client';
import winston from 'winston';

// ============================================================
// LOGGER
// ============================================================

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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
  ],
});

// ============================================================
// PRISMA CLIENT CONFIGURATION
// ============================================================

const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: [
    { level: 'query', emit: 'event' },
    { level: 'info', emit: 'event' },
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
  errorFormat: 'pretty',
};

// ============================================================
// CLIENT SINGLETON
// ============================================================

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Get Prisma client singleton
 * In development, store in globalThis to prevent hot-reload duplicates
 * In production, create fresh instance
 */
export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// ============================================================
// EVENT LOGGING
// ============================================================

prisma.$on('query', (e: Prisma.QueryEvent) => {
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('Query', {
      query: e.query,
      params: e.params,
      duration: e.duration,
    });
  }

  // Warn on slow queries
  if (e.duration > 1000) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: e.duration,
    });
  }
});

prisma.$on('info', (e: Prisma.LogEvent) => {
  logger.info('Database info', { message: e.message });
});

prisma.$on('warn', (e: Prisma.LogEvent) => {
  logger.warn('Database warning', { message: e.message });
});

prisma.$on('error', (e: Prisma.LogEvent) => {
  logger.error('Database error', { message: e.message });
});

// ============================================================
// HEALTH CHECK
// ============================================================

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      healthy: true,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

let isShuttingDown = false;

export async function disconnectDatabase(): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Database disconnect already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info('Disconnecting from database...');

  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database', { error });
    throw error;
  }
}

// ============================================================
// TRANSACTION HELPERS
// ============================================================

export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Execute a callback within a transaction
 */
export async function withTransaction<T>(
  callback: (tx: TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  return prisma.$transaction(callback, {
    maxWait: options?.maxWait ?? 5000,
    timeout: options?.timeout ?? 30000,
    isolationLevel: options?.isolationLevel,
  });
}

// ============================================================
// RETRY HELPERS
// ============================================================

/**
 * Retry a database operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 100;
  const maxDelayMs = options?.maxDelayMs ?? 5000;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs
      );

      if (options?.onRetry) {
        options.onRetry(attempt, lastError);
      }

      logger.warn('Retrying database operation', {
        attempt,
        maxAttempts,
        delay,
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error): boolean {
  const retryableCodes = [
    'P1001', // Can't reach database server
    'P1002', // Database server timeout
    'P1008', // Operations timed out
