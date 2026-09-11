/**
 * VYENFITA Observability Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { getMetrics } from '../lib/observability/metrics.service';
import { HealthService } from '../lib/observability/health.service';
import { TracingService } from '../lib/observability/tracing.service';

export class ObservabilityController {
  /**
   * Prometheus metrics
   * GET /metrics
   */
  async metrics(_req: Request, res: Response): Promise<void> {
    const metrics = getMetrics();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics.expose());
  }

  /**
   * Full health check
   * GET /health
   */
  async health(_req: Request, res: Response): Promise<void> {
    const report = await HealthService.check();
    const statusCode = report.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(report);
  }

  /**
   * Liveness check
   * GET /health/liveness
   */
  async liveness(_req: Request, res: Response): Promise<void> {
    const result = HealthService.liveness();
    res.json(result);
  }

  /**
   * Readiness check
   * GET /health/readiness
   */
  async readiness(_req: Request, res: Response): Promise<void> {
    const result = await HealthService.readiness();
    res.status(result.ready ? 200 : 503).json(result);
  }

  /**
   * Current trace spans
   * GET /debug/traces
   */
  async traces(_req: Request, res: Response): Promise<void> {
    const spans = TracingService.getSpans();
    const traceId = TracingService.getTraceId();

    res.json({
      traceId,
      spanCount: spans.length,
      spans,
    });
  }
  }
