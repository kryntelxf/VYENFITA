/**
 * VYENFITA Auth Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

export function createAuthRouter(): Router {
  const router = Router();
  const controller = new AuthController();

  // Public routes
  router.post('/register', (req, res) => controller.register(req, res));
  router.post('/login', (req, res) => controller.login(req, res));
  router.post('/refresh', (req, res) => controller.refresh(req, res));

  // Protected routes
  router.post('/logout', AuthMiddleware.validate, (req, res) => controller.logout(req, res));
  router.get('/me', AuthMiddleware.validate, (req, res) => controller.me(req, res));
  router.post(
    '/change-password',
    AuthMiddleware.validate,
    (req, res) => controller.changePassword(req, res)
  );

  return router;
}
