/**
 * VYENFITA Observability Middleware
 * 
 * Auto-instruments every HTTP request:
 * - Assigns trace ID
 * - Records metrics
 * - Logs request/response
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { TracingService } from '../lib/observability/tracing.service';
import { getMetrics } from '../lib/observability/metrics.service';
import { logger } from '../lib/observability/logger';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
    }
  }
}

export class ObservabilityMiddleware {
  static instrument = (req: Request, res: Response, next: NextFunction): void => {
    const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
    req.traceId = traceId;

    const startTime = Date.now();

    // Set trace ID in response header
    res.setHeader('X-Trace-Id', traceId);

    // Extract tenant/user from auth if available
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    // Run the rest in a trace context
    TracingService.runWithTrace(
      () => {
        res.on('finish', () => {
          const durationMs = Date.now() - startTime;
          const metrics = getMetrics();

          // Record metrics
          metrics.incrementCounter('vyenfita_http_requests_total', {
            method: req.method,
            path: normalizePath(req.path),
            status: res.statusCode,
          });

          metrics.observeHistogram(
            'vyenfita_http_request_duration_ms',
            durationMs,
            {
              method: req.method,
              path: normalizePath(req.path),
            }
          );

          if (res.statusCode >= 400) {
            metrics.incrementCounter('vyenfita_http_errors_total', {
              method: req.method,
              path: normalizePath(req.path),
              status: res.statusCode,
            });
          }

          // Log
          const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
          logger.log(level, `${req.method} ${req.path} ${res.statusCode}`, {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        });

        next();
      },
      { traceId, tenantId, userId }
    );
  };
}

/**
 * Normalize path to avoid high cardinality metrics
 * /api/v1/applications/123 → /api/v1/applications/:id
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}
