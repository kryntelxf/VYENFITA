/**
 * VYENFITA GDPR Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { GDPRController } from '../controllers/gdpr.controller';

export function createGDPRRouter(): Router {
  const router = Router();
  const controller = new GDPRController();

  /**
   * GET /api/v1/users/me/export
   * Export all personal data for the current user.
   */
  router.get('/users/me/export', (req, res) => controller.exportMyData(req, res));

  /**
   * GET /api/v1/tenants/me/export
   * Export all tenant data (admin only).
   */
  router.get('/tenants/me/export', (req, res) =>
    controller.exportMyTenant(req, res)
  );

  /**
   * DELETE /api/v1/users/me
   * Request account deletion (30-day grace period).
   */
  router.delete('/users/me', (req, res) => controller.deleteMyAccount(req, res));

  /**
   * POST /api/v1/users/me/deletion/cancel
   * Cancel a pending account deletion.
   */
  router.post('/users/me/deletion/cancel', (req, res) =>
    controller.cancelMyDeletion(req, res)
  );

  return router;
}

export default createGDPRRouter;
