/**
 * VYENFITA Workflow Routes
 * 
 * @version 2.0.0
 */

import { Router } from 'express';
import { WorkflowController } from '../controllers/workflow.controller';
import { WorkflowExecutionController } from '../controllers/workflow-execution.controller';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createWorkflowRouter(): Router {
  const router = Router();
  const controller = new WorkflowController();
  const execController = new WorkflowExecutionController();

  // Stats BEFORE :id routes
  router.get('/stats', (req, res) => controller.stats(req, res));

  // ============================================================
  // EXECUTION ROUTES (must be BEFORE /:id)
  // ============================================================

  router.get(
    '/executions/:executionId',
    PermissionMiddleware.require('workflow:read'),
    (req, res) => execController.get(req, res)
  );

  router.post(
    '/executions/:executionId/cancel',
    PermissionMiddleware.require('workflow:execute'),
    (req, res) => execController.cancel(req, res)
  );

  // ============================================================
  // CRUD ROUTES
  // ============================================================

  router.post(
    '/',
    PermissionMiddleware.require('workflow:create'),
    (req, res) => controller.create(req, res)
  );

  router.get(
    '/',
    PermissionMiddleware.require('workflow:read'),
    (req, res) => controller.list(req, res)
  );

  router.get(
    '/:id',
    PermissionMiddleware.require('workflow:read'),
    (req, res) => controller.get(req, res)
  );

  router.delete(
    '/:id',
    PermissionMiddleware.require('workflow:delete'),
    (req, res) => controller.delete(req, res)
  );

  // ============================================================
  // EXECUTION ROUTES (per-workflow)
  // ============================================================

  router.post(
    '/:id/execute',
    PermissionMiddleware.require('workflow:execute'),
    (req, res) => execController.execute(req, res)
  );

  router.get(
    '/:id/executions',
    PermissionMiddleware.require('workflow:read'),
    (req, res) => execController.list(req, res)
  );

  return router;
    }
