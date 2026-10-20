/**
 * VYENFITA SSO + SCIM Routes (Minimal)
 *
 * SSO provider management + SCIM 2.0 user provisioning.
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';
import { SecretService } from '../lib/security/secret.service';

export function createSSORouter(): Router {
  const router = Router();

  // Lazy-init secret service
  let secretService: SecretService | null = null;
  const getSecret = (): SecretService => {
    if (!secretService) secretService = new SecretService();
    return secretService;
  };

  // ============================================================
  // SSO — LIST PROVIDERS
  // ============================================================
  router.get('/sso/providers', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const connections = await prisma.integrationConnection.findMany({
        where: { tenantId, integrationType: { startsWith: 'sso-' } },
        select: { id: true, name: true, status: true, config: true, createdAt: true, updatedAt: true },
      });

      const providers = connections.map((c) => ({
        id: c.id,
        name: c.name,
        type: (c.config as any)?.type || 'oidc',
        enabled: c.status === 'connected',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));

      return res.json({ success: true, data: providers, count: providers.length });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // SSO — REGISTER PROVIDER
  // ============================================================
  router.post('/sso/providers', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { name, type, config } = req.body;

      if (!name || typeof name !== 'string') return res.status(400).json({ success: false, error: 'name is required' });
      if (!['oidc', 'saml', 'oauth2', 'ldap'].includes(type)) return res.status(400).json({ success: false, error: 'Invalid type' });
      if (!config || typeof config !== 'object') return res.status(400).json({ success: false, error: 'config object is required' });

      const sensitiveKeys = ['clientSecret', 'privateKey', 'bindPassword'];
      const encryptedConfig: Record<string, any> = { type };

      for (const [key, value] of Object.entries(config)) {
        if (sensitiveKeys.includes(key) && typeof value === 'string') {
          try {
            encryptedConfig[key] = getSecret().encrypt(value);
            encryptedConfig[`${key}Encrypted`] = true;
          } catch {
            return res.status(500).json({ success: false, error: 'Failed to encrypt sensitive config. Ensure ENCRYPTION_KEY is set.' });
          }
        } else {
          encryptedConfig[key] = value;
        }
      }

      const connection = await prisma.integrationConnection.create({
        data: { tenantId, integrationType: `sso-${type}`, name, status: 'connected', config: encryptedConfig, connectedBy: userId },
        select: { id: true, name: true, integrationType: true, status: true, createdAt: true },
      });

      return res.status(201).json({ success: true, data: { id: connection.id, name: connection.name, type, enabled: true, createdAt: connection.createdAt } });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // SSO — UPDATE PROVIDER
  // ============================================================
  router.patch('/sso/providers/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, config, enabled } = req.body;

      const existing = await prisma.integrationConnection.findFirst({
        where: { id: req.params.id, tenantId, integrationType: { startsWith: 'sso-' } },
      });
      if (!existing) return res.status(404).json({ success: false, error: 'SSO provider not found' });

      const oldConfig = (existing.config as Record<string, any>) || {};
      const newConfig = config ? { ...oldConfig, ...config, type: oldConfig.type } : oldConfig;

      const updated = await prisma.integrationConnection.update({
        where: { id: existing.id },
        data: {
          ...(name !== undefined && { name }),
          ...(enabled !== undefined && { status: enabled ? 'connected' : 'disconnected' }),
          config: newConfig,
        },
        select: { id: true, name: true, status: true, updatedAt: true },
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // SSO — DELETE PROVIDER
  // ============================================================
  router.delete('/sso/providers/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const existing = await prisma.integrationConnection.findFirst({
        where: { id: req.params.id, tenantId, integrationType: { startsWith: 'sso-' } },
      });
      if (!existing) return res.status(404).json({ success: false, error: 'SSO provider not found' });

      await prisma.integrationConnection.delete({ where: { id: existing.id } });
      return res.json({ success: true, message: 'SSO provider deleted' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // SCIM — SERVICE PROVIDER CONFIG
  // ============================================================
  router.get('/scim/v2/ServiceProviderConfig', (_req: Request, res: Response) => {
    return res.json({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://docs.vyenfita.com/scim',
      patch: { supported: false }, bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 1000 }, changePassword: { supported: false },
      sort: { supported: true }, etag: { supported: false },
      authenticationSchemes: [{ type: 'oauthbearertoken', name: 'OAuth Bearer Token', description: 'JWT Bearer token' }],
    });
  });

  // ============================================================
  // SCIM — LIST USERS
  // ============================================================
  router.get('/scim/v2/Users', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const startIndex = parseInt(req.query.startIndex as string || '1', 10);
      const count = Math.min(parseInt(req.query.count as string || '100', 10), 1000);
      const filter = req.query.filter as string | undefined;

      const where: any = { tenantId, deletedAt: null };
      if (filter) {
        const match = filter.match(/userName eq "([^"]+)"/i);
        if (match) where.user = { email: match[1].toLowerCase() };
      }

      const [memberships, total] = await Promise.all([
        prisma.membership.findMany({ where, include: { user: true, role: true }, skip: startIndex - 1, take: count }),
        prisma.membership.count({ where }),
      ]);

      const users = memberships.map((m) => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: m.user.id, userName: m.user.email, name: { formatted: m.user.name || '' },
        emails: [{ value: m.user.email, primary: true }],
        active: m.status === 'active', roles: [m.role.name],
        meta: { resourceType: 'User', created: m.user.createdAt.toISOString(), lastModified: m.user.updatedAt.toISOString() },
      }));

      return res.json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: total, startIndex, itemsPerPage: users.length, Resources: users,
      });
    } catch (error) {
      return res.status(500).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: error instanceof Error ? error.message : 'Failed', status: '500' });
    }
  });

  // ============================================================
  // SCIM — CREATE USER
  // ============================================================
  router.post('/scim/v2/Users', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { userName, name, emails } = req.body;
      const email = userName || (emails && emails[0]?.value);

      if (!email || typeof email !== 'string') return res.status(400).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'userName required', status: '400' });

      const existingMembership = await prisma.membership.findFirst({ where: { tenantId, deletedAt: null, user: { email: email.toLowerCase() } } });
      if (existingMembership) return res.status(409).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'User exists', status: '409', scimType: 'uniqueness' });

      let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user) user = await prisma.user.create({ data: { email: email.toLowerCase(), name: name?.formatted || name?.givenName || null, status: 'active' } });

      let role = await prisma.role.findFirst({ where: { tenantId, name: 'Viewer' } });
      if (!role) role = await prisma.role.create({ data: { tenantId, name: 'Viewer', description: 'Read-only', isDefault: true } });

      const membership = await prisma.membership.create({ data: { userId: user.id, tenantId, roleId: role.id, status: 'active', joinedAt: new Date() }, include: { user: true, role: true } });

      return res.status(201).json({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: membership.user.id, userName: membership.user.email, name: { formatted: membership.user.name || '' },
        emails: [{ value: membership.user.email, primary: true }], active: true, roles: [membership.role.name],
        meta: { resourceType: 'User', created: membership.user.createdAt.toISOString(), lastModified: membership.user.updatedAt.toISOString() },
      });
    } catch (error) {
      return res.status(500).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: error instanceof Error ? error.message : 'Failed', status: '500' });
    }
  });

  // ============================================================
  // SCIM — GET USER
  // ============================================================
  router.get('/scim/v2/Users/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const membership = await prisma.membership.findFirst({ where: { tenantId, userId: req.params.id, deletedAt: null }, include: { user: true, role: true } });
      if (!membership) return res.status(404).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Not found', status: '404' });

      return res.json({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: membership.user.id, userName: membership.user.email, name: { formatted: membership.user.name || '' },
        emails: [{ value: membership.user.email, primary: true }], active: membership.status === 'active', roles: [membership.role.name],
        meta: { resourceType: 'User', created: membership.user.createdAt.toISOString(), lastModified: membership.user.updatedAt.toISOString() },
      });
    } catch (error) {
      return res.status(500).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: error instanceof Error ? error.message : 'Failed', status: '500' });
    }
  });

  // ============================================================
  // SCIM — DELETE USER
  // ============================================================
  router.delete('/scim/v2/Users/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const membership = await prisma.membership.findFirst({ where: { tenantId, userId: req.params.id, deletedAt: null } });
      if (!membership) return res.status(404).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Not found', status: '404' });

      await prisma.membership.update({ where: { id: membership.id }, data: { status: 'inactive', deletedAt: new Date() } });
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: error instanceof Error ? error.message : 'Failed', status: '500' });
    }
  });

  return router;
        }
