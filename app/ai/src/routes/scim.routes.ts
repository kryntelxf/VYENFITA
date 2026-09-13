/**
 * VYENFITA SCIM Routes
 * 
 * RFC 7644 compliant SCIM 2.0 endpoints.
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { SCIMController } from '../controllers/scim.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

export function createSCIMRouter(): Router {
  const router = Router();
  const controller = new SCIMController();

  // All SCIM endpoints require authentication
  router.use(AuthMiddleware.validate);

  // Discovery
  router.get('/ServiceProviderConfig', (req, res) =>
    controller.serviceProviderConfig(req, res)
  );

  // Users
  router.get('/Users', (req, res) => controller.listUsers(req, res));
  router.post('/Users', (req, res) => controller.createUser(req, res));
  router.get('/Users/:id', (req, res) => controller.getUser(req, res));
  router.put('/Users/:id', (req, res) => controller.updateUser(req, res));
  router.delete('/Users/:id', (req, res) => controller.deleteUser(req, res));

  // Groups
  router.get('/Groups', (req, res) => controller.listGroups(req, res));

  return router;
}
