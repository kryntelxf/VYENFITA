/**
 * VYENFITA Integration Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { getIntegrationRegistry } from '../lib/integrations/registry';
import { OAuthService } from '../lib/integrations/oauth.service';
import { IntegrationType, IntegrationError } from '../lib/integrations/integration.interface';
import { logger } from '../lib/observability/logger';

const oauthService = new OAuthService();

export class IntegrationController {
  /**
   * List available providers
   * GET /api/v1/integrations/providers
   */
  async listProviders(req: Request, res: Response): Promise<void> {
    try {
      const registry = getIntegrationRegistry();
      const category = req.query.category as string;

      const providers = category
        ? registry.listProvidersByCategory(category)
        : registry.listProviders();

      // Hide secrets from client
      const sanitized = providers.map((p) => ({
        type: p.type,
        name: p.name,
        description: p.description,
        icon: p.icon,
        category: p.category,
        authType: p.authType,
        authScopes: p.authScopes,
        capabilities: p.capabilities,
        actions: p.actions,
        triggers: p.triggers,
      }));

      res.json({ success: true, data: sanitized, count: sanitized.length });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get authorization URL
   * POST /api/v1/integrations/:type/authorize
   */
  async getAuthorizationUrl(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const type = req.params.type as IntegrationType;
      const { redirectUri } = req.body;

      if (!redirectUri) {
        res.status(400).json({ success: false, error: 'redirectUri is required' });
        return;
      }

      const registry = getIntegrationRegistry();
      const adapter = registry.get(type);

      if (!adapter) {
        res.status(404).json({ success: false, error: `Unknown integration: ${type}` });
        return;
      }

      const { state, codeVerifier } = await oauthService.createState(
        req.user.tenantId,
        type,
        redirectUri
      );

      const url = await adapter.getAuthorizationUrl(req.user.tenantId, redirectUri, state);

      res.json({
        success: true,
        data: { url, state, codeVerifier },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * OAuth callback
   * POST /api/v1/integrations/:type/callback
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const type = req.params.type as IntegrationType;
      const { code, state, name, config } = req.body;

      if (!code || !state) {
        res.status(400).json({ success: false, error: 'code and state are required' });
        return;
      }

      const registry = getIntegrationRegistry();
      const adapter = registry.get(type);

      if (!adapter) {
        res.status(404).json({ success: false, error: `Unknown integration: ${type}` });
        return;
      }

      // Verify state
      const oauthState = await oauthService.consumeState(state, type);

      // Exchange code
      const tokens = await adapter.exchangeCode(code, oauthState.redirectUri);

      // Store connection
      const connection = await oauthService.storeConnection({
        tenantId: req.user.tenantId,
        integrationType: type,
        userId: req.user.userId,
        name: name || adapter.provider.name,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        config,
      });

      res.status(201).json({
        success: true,
        data: {
          id: connection.id,
          type: connection.integrationType,
          name: connection.name,
          status: connection.status,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * List connections
   * GET /api/v1/integrations/connections
   */
  async listConnections(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const type = req.query.type as IntegrationType | undefined;
      const connections = await oauthService.listConnections(req.user.tenantId, type);

      res.json({ success: true, data: connections, count: connections.length });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Execute an integration action
   * POST /api/v1/integrations/connections/:connectionId/actions/:actionName
   */
  async executeAction(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { connectionId, actionName } = req.params;
      const { prisma } = await import('../lib/database/client');

      const connection = await prisma.integrationConnection.findFirst({
        where: { id: connectionId, tenantId: req.user.tenantId },
      });

      if (!connection) {
        res.status(404).json({ success: false, error: 'Connection not found' });
        return;
      }

      const registry = getIntegrationRegistry();
      const adapter = registry.get(connection.integrationType as IntegrationType);

      if (!adapter) {
        res.status(404).json({ success: false, error: 'Adapter not found' });
        return;
      }

      const result = await adapter.executeAction(actionName, req.body, connection);

      // Update last used
      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: { lastUsedAt: new Date() },
      });

      res.json({ success: result.success, data: result.data, error: result.error });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Test connection
   * POST /api/v1/integrations/connections/:connectionId/test
   */
  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { prisma } = await import('../lib/database/client');

      const connection = await prisma.integrationConnection.findFirst({
        where: { id: req.params.connectionId, tenantId: req.user.tenantId },
      });

      if (!connection) {
        res.status(404).json({ success: false, error: 'Connection not found' });
        return;
      }

      const registry = getIntegrationRegistry();
      const adapter = registry.get(connection.integrationType as IntegrationType);

      if (!adapter) {
        res.status(404).json({ success: false, error: 'Adapter not found' });
        return;
      }

      const result = await adapter.testConnection(connection as any);
      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Disconnect integration
   * DELETE /api/v1/integrations/connections/:connectionId
   */
  async disconnect(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await oauthService.disconnect(req.params.connectionId, req.user.tenantId);
      res.json({ success: true, message: 'Disconnected' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Webhook receiver
   * POST /api/v1/integrations/webhooks/:type
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as IntegrationType;
      const registry = getIntegrationRegistry();
      const adapter = registry.get(type);

      if (!adapter || !adapter.handleWebhook) {
        res.status(404).json({ success: false, error: 'Webhook not supported' });
        return;
      }

      const signature = req.headers['x-signature'] as string;
      const result = await adapter.handleWebhook(req.body, signature);

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Webhook processing failed', {
        type: req.params.type,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      res.status(500).json({ success: false, error: 'Webhook failed' });
    }
  }

  // ============================================================
  // ERROR HANDLER
  // ============================================================

  private handleError(error: unknown, res: Response): void {
    if (error instanceof IntegrationError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Integration error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
        }
