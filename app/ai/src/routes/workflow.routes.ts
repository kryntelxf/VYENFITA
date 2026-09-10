/**
 * VYENFITA Workflow Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { WorkflowController } from '../controllers/workflow.controller';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createWorkflowRouter(): Router {
  const router = Router();
  const controller = new WorkflowController();

  // Stats BEFORE :id
  router.get('/stats', (req, res) => controller.stats(req, res));

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

  return router;
}
