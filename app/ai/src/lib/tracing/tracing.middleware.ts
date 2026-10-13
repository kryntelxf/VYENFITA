/**
 * VYENFITA Tracing Middleware
 * 
 * Express middleware that:
 * - Ensures a root span exists for each request
 * - Adds tenant/user/requestId as span attributes
 * - Correlates with the existing trace ID from observability middleware
 * 
 * @version 1.0.0
 */

import { NextFunction, Request, Response } from 'express';
import { setSpanAttributes } from './tracing.service';
import { SpanAttrs } from './tracing.types';

/**
 * Enrich the current request's span with VYENFITA context.
 * Must run AFTER auth + tenant middleware (so req.user is populated).
 */
export function enrichTracingContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const attrs: Record<string, any> = {};

  if (req.user) {
    attrs[SpanAttrs.TENANT_ID] = req.user.tenantId;
    attrs[SpanAttrs.USER_ID] = req.user.userId;
  }

  if (req.traceId) {
    attrs[SpanAttrs.TRACE_ID] = req.traceId;
    attrs[SpanAttrs.REQUEST_ID] = req.traceId;
  }

  // Route template (e.g. /api/v1/applications/:id)
  if (req.route?.path) {
    attrs[SpanAttrs.HTTP_ROUTE] = req.baseUrl + req.route.path;
  }

  if (Object.keys(attrs).length > 0) {
    setSpanAttributes(attrs);
  }

  next();
}
