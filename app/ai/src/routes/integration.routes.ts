/**
 * VYENFITA Integration Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { IntegrationController } from '../controllers/integration.controller';

export function createIntegrationRouter(): Router {
  const router = Router();
  const controller = new IntegrationController();

  // ============================================================
  // PROVIDERS
  // ============================================================

  /**
   * List available integration providers
   * GET /api/v1/integrations/providers
   * 
   * Query params:
   *   - category: filter by category (crm, communication, etc.)
   */
  router.get('/providers', (req, res) => controller.listProviders(req, res));

  // ============================================================
  // OAUTH FLOW
  // ============================================================

  /**
   * Get OAuth authorization URL
   * POST /api/v1/integrations/:type/authorize
   * 
   * Body:
   *   - redirectUri: string (required)
   */
  router.post('/:type/authorize', (req, res) => controller.getAuthorizationUrl(req, res));

  /**
   * Handle OAuth callback
   * POST /api/v1/integrations/:type/callback
   * 
   * Body:
   *   - code: string (required)
   *   - state: string (required)
   *   - name: string (optional)
   *   - config: object (optional)
   */
  router.post('/:type/callback', (req, res) => controller.handleCallback(req, res));

  // ============================================================
  // CONNECTIONS
  // ============================================================

  /**
   * List all integration connections for tenant
   * GET /api/v1/integrations/connections
   * 
   * Query params:
   *   - type: filter by integration type
   */
  router.get('/connections', (req, res) => controller.listConnections(req, res));

  /**
   * Execute an integration action
   * POST /api/v1/integrations/connections/:connectionId/actions/:actionName
   * 
   * Body: action-specific input
   */
  router.post(
    '/connections/:connectionId/actions/:actionName',
    (req, res) => controller.executeAction(req, res)
  );

  /**
   * Test connection health
   * POST /api/v1/integrations/connections/:connectionId/test
   */
  router.post(
    '/connections/:connectionId/test',
    (req, res) => controller.testConnection(req, res)
  );

  /**
   * Disconnect integration
   * DELETE /api/v1/integrations/connections/:connectionId
   */
  router.delete(
    '/connections/:connectionId',
    (req, res) => controller.disconnect(req, res)
  );

  // ============================================================
  // WEBHOOKS (Public — no auth)
  // ============================================================

  /**
   * Webhook receiver for inbound events
   * POST /api/v1/integrations/webhooks/:type
   * 
   * This endpoint is PUBLIC and must be mounted OUTSIDE the
   * protected middleware. Signature verification is done
   * inside each adapter.
   */
  router.post('/webhooks/:type', (req, res) => controller.handleWebhook(req, res));

  return router;
}

export default createIntegrationRouter;
