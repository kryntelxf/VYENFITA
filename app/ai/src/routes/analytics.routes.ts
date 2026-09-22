/**
 * VYENFITA Analytics Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';

export function createAnalyticsRouter(): Router {
  const router = Router();
  const controller = new AnalyticsController();

  // Metrics
  router.get('/metrics', (req, res) => controller.queryMetrics(req, res));
  router.get('/metrics/list', (req, res) => controller.listMetrics(req, res));

  // KPIs
  router.post('/kpis', (req, res) => controller.createKPI(req, res));
  router.get('/kpis', (req, res) => controller.listKPIs(req, res));
  router.get('/kpis/:id/report', (req, res) => controller.getKPIReport(req, res));

  // Funnels
  router.post('/funnels', (req, res) => controller.createFunnel(req, res));
  router.get('/funnels', (req, res) => controller.listFunnels(req, res));
  router.get('/funnels/:id/analyze', (req, res) => controller.analyzeFunnel(req, res));

  // Cohort
  router.post('/cohort/analyze', (req, res) => controller.analyzeCohort(req, res));

  // Predictive
  router.post('/forecast', (req, res) => controller.forecast(req, res));

  // Natural Language Query
  router.post('/ask', (req, res) => controller.ask(req, res));

  return router;
}

export default createAnalyticsRouter;
