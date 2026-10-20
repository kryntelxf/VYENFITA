/**
 * VYENFITA Integration Routes (Minimal)
 *
 * Manage third-party integration connections (Salesforce, Slack, HubSpot, Jira).
 * OAuth flow is stubbed — this version supports API-key/bearer connections only.
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';
import { SecretService } from '../lib/security/secret.service';

// ============================================================
// STATIC PROVIDER CATALOG
// ============================================================

const PROVIDERS = [
  {
    type: 'salesforce',
    name: 'Salesforce',
    description: 'CRM platform for sales, service, marketing',
    icon: '☁️',
    category: 'crm',
    authType: 'oauth2',
    authScopes: ['api', 'refresh_token', 'offline_access'],
    actions: ['create_lead', 'update_lead', 'query', 'get_opportunities'],
    triggers: ['lead_created', 'opportunity_stage_changed'],
  },
  {
    type: 'hubspot',
    name: 'HubSpot',
    description: 'CRM & marketing automation',
    icon: '🟠',
    category: 'crm',
    authType: 'oauth2',
    authScopes: [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
    ],
    actions: ['create_contact', 'get_contacts', 'get_deals'],
    triggers: ['contact_created', 'deal_created'],
  },
  {
    type: 'slack',
    name: 'Slack',
    description: 'Team communication',
    icon: '💬',
    category: 'communication',
    authType: 'oauth2',
    authScopes: ['chat:write', 'channels:read', 'files:write'],
    actions: ['send_message', 'send_file', 'list_channels'],
    triggers: ['message_received', 'reaction_added'],
  },
  {
    type: 'jira',
    name: 'Jira',
    description: 'Issue tracking & project management',
    icon: '🔷',
    category: 'devtools',
    authType: 'oauth2',
    authScopes: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
    actions: ['create_issue', 'search_issues'],
    triggers: ['issue_created', 'issue_updated'],
  },
];

const VALID_TYPES = PROVIDERS.map((p) => p.type);

// ============================================================
// ROUTER
// ============================================================

export function createIntegrationRouter(): Router {
  const router = Router();

  // ============================================================
  // PROVIDERS — LIST (public)
  // ============================================================

  router.get('/providers', (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;
    const filtered = category
      ? PROVIDERS.filter((p) => p.category === category)
      : PROVIDERS;

    return res.json({
      success: true,
      data: filtered,
      count: filtered.length,
    });
  });

  // Everything below requires auth
  router.use(authenticate);

  // Lazy-init secret service
  let secretService: SecretService | null = null;
  const getSecret = (): SecretService => {
    if (!secretService) secretService = new SecretService();
    return secretService;
  };

  // ============================================================
  // CONNECTIONS — LIST
  // ============================================================

  router.get('/connections', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const type = req.query.type as string | undefined;

      const where: any = { tenantId };
      if (type) where.integrationType = type;

      const connections = await prisma.integrationConnection.findMany({
        where,
        orderBy: { connectedAt: 'desc' },
        select: {
          id: true,
          integrationType: true,
          name: true,
          status: true,
          scopes: true,
          expiresAt: true,
          connectedAt: true,
          updatedAt: true,
          lastUsedAt: true,
          lastError: true,
          config: true,
        },
      });

      return res.json({
        success: true,
        data: connections,
        count: connections.length,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to list connections',
      });
    }
  });

  // ============================================================
  // CONNECTIONS — CREATE
  // ============================================================

  router.post('/connections', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { integrationType, name, accessToken, config } = req.body;

      if (!integrationType || !VALID_TYPES.includes(integrationType)) {
        return res.status(400).json({
          success: false,
          error: `integrationType must be one of: ${VALID_TYPES.join(', ')}`,
        });
      }
      if (!name || typeof name !== 'string') {
        return res
          .status(400)
          .json({ success: false, error: 'name is required' });
      }
      if (!accessToken || typeof accessToken !== 'string') {
        return res.status(400).json({
          success: false,
          error:
            'accessToken is required (use OAuth flow in a future version for automatic token exchange)',
        });
      }

      // Encrypt token
      let encrypted: string;
      try {
        encrypted = getSecret().encrypt(accessToken);
      } catch (err) {
        return res.status(500).json({
          success: false,
          error:
            'Failed to encrypt token. Ensure ENCRYPTION_KEY is set correctly.',
        });
      }

      const connection = await prisma.integrationConnection.create({
        data: {
          tenantId,
          integrationType,
          name,
          status: 'connected',
          accessTokenEncrypted: encrypted,
          config: config || {},
          connectedBy: userId,
        },
        select: {
          id: true,
          integrationType: true,
          name: true,
          status: true,
          connectedAt: true,
        },
      });

      return res.status(201).json({ success: true, data: connection });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create connection',
      });
    }
  });

  // ============================================================
  // CONNECTIONS — GET BY ID
  // ============================================================

  router.get('/connections/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;

      const connection = await prisma.integrationConnection.findFirst({
        where: { id: req.params.id, tenantId },
        select: {
          id: true,
          integrationType: true,
          name: true,
          status: true,
          scopes: true,
          expiresAt: true,
          connectedAt: true,
          updatedAt: true,
          lastUsedAt: true,
          lastError: true,
          config: true,
        },
      });

      if (!connection) {
        return res
          .status(404)
          .json({ success: false, error: 'Connection not found' });
      }

      return res.json({ success: true, data: connection });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get connection',
      });
    }
  });

  // ============================================================
  // CONNECTIONS — DELETE
  // ============================================================

  router.delete('/connections/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;

      const connection = await prisma.integrationConnection.findFirst({
        where: { id: req.params.id, tenantId },
      });

      if (!connection) {
        return res
          .status(404)
          .json({ success: false, error: 'Connection not found' });
      }

      await prisma.integrationConnection.delete({
        where: { id: connection.id },
      });

      return res.json({ success: true, message: 'Connection disconnected' });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to disconnect',
      });
    }
  });

  // ============================================================
  // CONNECTIONS — TEST
  // ============================================================

  router.post(
    '/connections/:id/test',
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;

        const connection = await prisma.integrationConnection.findFirst({
          where: { id: req.params.id, tenantId },
        });

        if (!connection) {
          return res
            .status(404)
            .json({ success: false, error: 'Connection not found' });
        }

        // Mock health check — in production this would call the provider API
        const healthy = connection.status === 'connected';

        if (healthy) {
          await prisma.integrationConnection.update({
            where: { id: connection.id },
            data: { lastUsedAt: new Date(), lastError: null },
          });
        }

        return res.json({
          success: true,
          data: {
            healthy,
            status: connection.status,
            message: healthy
              ? 'Connection appears healthy (mock check — real provider test not implemented yet)'
              : `Connection is ${connection.status}`,
            checkedAt: new Date().toISOString(),
            mock: true,
          },
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to test connection',
        });
      }
    }
  );

  return router;
      }
