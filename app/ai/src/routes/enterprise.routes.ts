/**
 * VYENFITA Enterprise Routes
 * 
 * Routes for enterprise features:
 * - SSO
 * - Audit Trail
 * - Advanced RBAC
 * - Application Analytics
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { EnterpriseController } from '../controllers/enterprise.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

export function createEnterpriseRouter(): Router {
  const router = Router();
  const controller = new EnterpriseController();

  // All enterprise routes require authentication
  router.use(AuthMiddleware.validate);

  // ============================================================
  // SSO ROUTES
  // ============================================================

  router.get('/sso/providers', (req, res) => controller.getSSOProviders(req, res));
  router.get('/sso/auth/:providerId', (req, res) => controller.getAuthUrl(req, res));
  router.post('/sso/callback', (req, res) => controller.handleCallback(req, res));

  // ============================================================
  // AUDIT TRAIL ROUTES
  // ============================================================

  router.get('/audit/events', (req, res) => controller.getAuditEvents(req, res));
  router.get('/audit/summary', (req, res) => controller.getAuditSummary(req, res));
  router.get('/audit/security', (req, res) => controller.getSecuritySummary(req, res));

  // ============================================================
  // RBAC ROUTES
  // ============================================================

  router.get('/rbac/roles', (req, res) => controller.getRoles(req, res));
  router.post('/rbac/roles', (req, res) => controller.createRole(req, res));
  router.put('/rbac/roles/:roleId', (req, res) => controller.updateRole(req, res));
  router.delete('/rbac/roles/:roleId', (req, res) => controller.deleteRole(req, res));
  router.post('/rbac/check', (req, res) => controller.checkPermission(req, res));

  // ============================================================
  // APPLICATION ANALYTICS ROUTES
  // ============================================================

  router.post('/analytics/event', (req, res) => controller.recordEvent(req, res));
  router.get('/analytics/applications/:applicationId', (req, res) => controller.getAppAnalytics(req, res));
  router.get('/analytics/tenants/:tenantId', (req, res) => controller.getTenantAnalytics(req, res));
  router.get('/analytics/applications/:applicationId/journey/:userId', (req, res) => controller.getUserJourney(req, res));

  return router;
    }
