/**
 * VYENFITA Database Client
 * 
 * @version 1.0.1
 */

import { PrismaClient, Prisma } from '@prisma/client';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// ============================================================
// PRISMA CLIENT SINGLETON
// ============================================================

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'info', emit: 'event' },
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// ============================================================
// EVENT LOGGING (using any cast to avoid Prisma type issues)
// ============================================================

const prismaAny = prisma as any;

prismaAny.$on('query', (e: any) => {
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('Query', {
      query: e.query,
      params: e.params,
      duration: e.duration,
    });
  }

  if (e.duration > 1000) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: e.duration,
    });
  }
});

prismaAny.$on('info', (e: any) => {
  logger.info('Database info', { message: e.message });
});

prismaAny.$on('warn', (e: any) => {
  logger.warn('Database warning', { message: e.message });
});

prismaAny.$on('error', (e: any) => {
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

export async function withTransaction<T>(
  callback: (tx: TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  return prisma.$transaction(callback as any, {
    maxWait: options?.maxWait ?? 5000,
    timeout: options?.timeout ?? 30000,
    isolationLevel: options?.isolationLevel,
  });
}

// ============================================================
// RETRY HELPERS
// ============================================================

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

function isRetryableError(error: Error): boolean {
  const retryableCodes = [
    'P1001',
    'P1002',
    'P1008',
    'P1017',
    'P2024',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
  ];

  const errorCode = (error as any).code;
  return retryableCodes.includes(errorCode);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================================

process.on('beforeExit', async () => {
  await disconnectDatabase();
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, disconnecting database...');
  await disconnectDatabase();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, disconnecting database...');
  await disconnectDatabase();
});

// ============================================================
// RE-EXPORT PRISMA TYPES
// ============================================================

export { PrismaClient };
export { Prisma };
export default prisma;
