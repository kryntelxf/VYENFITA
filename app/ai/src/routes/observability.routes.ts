/**
 * VYENFITA Observability Routes
 * 
 * Public routes for monitoring:
 * - /metrics (Prometheus)
 * - /health (health check)
 * - /health/liveness
 * - /health/readiness
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { ObservabilityController } from '../controllers/observability.controller';

export function createObservabilityRouter(): Router {
  const router = Router();
  const controller = new ObservabilityController();

  // Prometheus scrape endpoint
  router.get('/metrics', (req, res) => controller.metrics(req, res));

  // Health checks
  router.get('/health', (req, res) => controller.health(req, res));
  router.get('/health/liveness', (req, res) => controller.liveness(req, res));
  router.get('/health/readiness', (req, res) => controller.readiness(req, res));

  // Debug tracing (dev only)
  if (process.env.NODE_ENV !== 'production') {
    router.get('/debug/traces', (req, res) => controller.traces(req, res));
  }

  return router;
             }
