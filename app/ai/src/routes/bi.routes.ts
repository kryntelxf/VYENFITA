/**
 * VYENFITA Business Intelligence Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { BusinessIntelligenceController } from '../controllers/bi.controller';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createBIRouter(): Router {
  const router = Router();
  const controller = new BusinessIntelligenceController();

  // Ask a business question (AI + SQL + chart)
  router.post(
    '/ask',
    PermissionMiddleware.require('analytics:read'),
    (req, res) => controller.ask(req, res)
  );

  // Discover schema for a data source
  router.get(
    '/data-sources/:id/schema',
    PermissionMiddleware.require('analytics:read'),
    (req, res) => controller.discoverSchema(req, res)
  );

  // Validate a SQL query
  router.post(
    '/validate-sql',
    PermissionMiddleware.require('analytics:read'),
    (req, res) => controller.validateSQL(req, res)
  );

  // Detect anomalies
  router.post(
    '/anomalies',
    PermissionMiddleware.require('analytics:read'),
    (req, res) => controller.detectAnomalies(req, res)
  );

  // Recommend chart
  router.post(
    '/recommend-chart',
    PermissionMiddleware.require('analytics:read'),
    (req, res) => controller.recommendChart(req, res)
  );

  return router;
                                         }
