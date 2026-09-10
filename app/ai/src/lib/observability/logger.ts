/**
 * VYENFITA Structured Logger
 * 
 * Structured logging with:
 * - Trace ID injection
 * - Tenant/user context
 * - JSON format
 * - Log levels
 * 
 * @version 1.0.0
 */

import winston from 'winston';
import { TracingService } from './tracing.service';

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

// Custom format that injects trace context
const injectTraceContext = winston.format((info) => {
  const ctx = TracingService.getContext();
  if (ctx) {
    info.traceId = ctx.traceId;
    info.spanId = ctx.spanId;
    if (ctx.tenantId) info.tenantId = ctx.tenantId;
    if (ctx.userId) info.userId = ctx.userId;
  }
  return info;
});

// Human-readable format for local dev
const devFormat = printf((info) => {
  const parts = [
    `[${info.timestamp}]`,
    `${info.level.toUpperCase()}`,
  ];
  if (info.traceId) parts.push(`trace=${String(info.traceId).substring(0, 8)}`);
  if (info.tenantId) parts.push(`tenant=${String(info.tenantId).substring(0, 8)}`);
  parts.push(String(info.message));

  const meta: any = { ...info };
  delete meta.timestamp;
  delete meta.level;
  delete meta.message;
  delete meta.traceId;
  delete meta.spanId;
  delete meta.tenantId;
  delete meta.userId;

  let line = parts.join(' ');
  if (Object.keys(meta).length > 0) {
    line += ` ${JSON.stringify(meta)}`;
  }
  return line;
});

const isProduction = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction
    ? combine(
        timestamp(),
        errors({ stack: true }),
        injectTraceContext(),
        json()
      )
    : combine(
        timestamp({ format: 'HH:mm:ss.SSS' }),
        errors({ stack: true }),
        injectTraceContext(),
        colorize(),
        devFormat
      ),
  defaultMeta: {
    service: 'vyenfita-ai',
    version: process.env.SERVICE_VERSION || '1.0.0',
  },
  transports: [
    new winston.transports.Console(),
    ...(process.env.LOG_FILE
      ? [new winston.transports.File({ filename: process.env.LOG_FILE })]
      : []),
  ],
});

/**
 * Log helper that respects trace context
 */
export function logInfo(message: string, data?: Record<string, any>): void {
  logger.info(message, data);
}

export function logWarn(message: string, data?: Record<string, any>): void {
  logger.warn(message, data);
}

export function logError(message: string, data?: Record<string, any>): void {
  logger.error(message, data);
}

export function logDebug(message: string, data?: Record<string, any>): void {
  logger.debug(message, data);
  }
