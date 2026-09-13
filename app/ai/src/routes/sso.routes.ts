/**
 * VYENFITA SSO Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { SSOController } from '../controllers/sso.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createSSORouter(): Router {
  const router = Router();
  const controller = new SSOController();

  // Public: initiate login (redirect to IdP)
  router.get('/login/:providerId', (req, res) => controller.initiateLogin(req, res));

  // Public: handle IdP callback
  router.get('/callback', (req, res) => controller.handleCallback(req, res));

  // Protected: manage providers
  router.get(
    '/providers',
    AuthMiddleware.validate,
    PermissionMiddleware.require('settings:read'),
    (req, res) => controller.listProviders(req, res)
  );

  router.post(
    '/providers',
    AuthMiddleware.validate,
    PermissionMiddleware.require('settings:update'),
    (req, res) => controller.registerProvider(req, res)
  );

  router.delete(
    '/providers/:id',
    AuthMiddleware.validate,
    PermissionMiddleware.require('settings:update'),
    (req, res) => controller.deleteProvider(req, res)
  );

  return router;
}
