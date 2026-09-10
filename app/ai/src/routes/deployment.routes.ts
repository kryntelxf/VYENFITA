/**
 * VYENFITA Deployment Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { DeploymentController } from '../controllers/deployment.controller';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createDeploymentRouter(): Router {
  const router = Router();
  const controller = new DeploymentController();

  // List application deployments
  router.get(
    '/applications/:id/deployments',
    PermissionMiddleware.require('application:read'),
    (req, res) => controller.list(req, res)
  );

  // Create deployment
  router.post(
    '/applications/:id/deployments',
    PermissionMiddleware.require('application:deploy'),
    (req, res) => controller.deploy(req, res)
  );

  // Get deployment
  router.get(
    '/deployments/:deploymentId',
    PermissionMiddleware.require('application:read'),
    (req, res) => controller.get(req, res)
  );

  // Rollback
  router.post(
    '/deployments/:deploymentId/rollback',
    PermissionMiddleware.require('application:deploy'),
    (req, res) => controller.rollback(req, res)
  );

  // Remove
  router.delete(
    '/deployments/:deploymentId',
    PermissionMiddleware.require('application:deploy'),
    (req, res) => controller.remove(req, res)
  );

  return router;
}
