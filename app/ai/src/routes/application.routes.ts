/**
 * VYENFITA Application Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { ApplicationController } from '../controllers/application.controller';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createApplicationRouter(): Router {
  const router = Router();
  const controller = new ApplicationController();

  // Stats must be defined BEFORE :id route to avoid collision
  router.get('/stats', (req, res) => controller.stats(req, res));

  router.post(
    '/',
    PermissionMiddleware.require('application:create'),
    (req, res) => controller.create(req, res)
  );

  router.get(
    '/',
    PermissionMiddleware.require('application:read'),
    (req, res) => controller.list(req, res)
  );

  router.get(
    '/:id',
    PermissionMiddleware.require('application:read'),
    (req, res) => controller.get(req, res)
  );

  router.put(
    '/:id',
    PermissionMiddleware.require('application:update'),
    (req, res) => controller.update(req, res)
  );

  router.delete(
    '/:id',
    PermissionMiddleware.require('application:delete'),
    (req, res) => controller.delete(req, res)
  );

  router.get(
    '/:id/versions',
    PermissionMiddleware.require('application:read'),
    (req, res) => controller.getVersions(req, res)
  );

  router.post(
    '/:id/rollback/:versionId',
    PermissionMiddleware.require('application:update'),
    (req, res) => controller.rollback(req, res)
  );

  return router;
}
