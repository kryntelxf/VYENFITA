/**
 * VYENFITA FinOps Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { FinOpsController } from '../controllers/finops.controller';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createFinOpsRouter(): Router {
  const router = Router();
  const controller = new FinOpsController();

  // Summary — quick overview
  router.get(
    '/summary',
    PermissionMiddleware.require('billing:read'),
    (req, res) => controller.getSummary(req, res)
  );

  // Costs
  router.get(
    '/costs',
    PermissionMiddleware.require('billing:read'),
    (req, res) => controller.getCosts(req, res)
  );

  router.get(
    '/costs/trend',
    PermissionMiddleware.require('billing:read'),
    (req, res) => controller.getTrend(req, res)
  );

  // Budgets
  router.get(
    '/budgets',
    PermissionMiddleware.require('billing:read'),
    (req, res) => controller.listBudgets(req, res)
  );

  router.post(
    '/budgets',
    PermissionMiddleware.require('billing:manage'),
    (req, res) => controller.createBudget(req, res)
  );

  router.get(
    '/budgets/:id',
    PermissionMiddleware.require('billing:read'),
    (req, res) => controller.getBudget(req, res)
  );

  router.delete(
    '/budgets/:id',
    PermissionMiddleware.require('billing:manage'),
    (req, res) => controller.deleteBudget(req, res)
  );

  // Optimization
  router.get(
    '/optimizations',
    PermissionMiddleware.require('billing:read'),
    (req, res) => controller.getOptimizations(req, res)
  );

  // Anomalies
  router.get(
    '/anomalies',
    PermissionMiddleware.require('billing:read'),
    (req, res) => controller.getAnomalies(req, res)
  );

  return router;
}
