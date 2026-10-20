import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';
import { SecretService } from '../lib/security/secret.service';

export function createSSORouter(): Router {
  const router = Router();
  let secretService: SecretService | null = null;
  const getSecret = (): SecretService => { if (!secretService) secretService = new SecretService(); return secretService; };

  router.get('/sso/providers', authenticate, async (req: Request, res: Response) => {
    try {
      const connections = await prisma.integrationConnection.findMany({
        where: { tenantId: req.user!.tenantId, integrationType: { startsWith: 'sso-' } },
        select: { id: true, name: true, status: true, config: true, connectedAt: true, updatedAt: true },
      });
      const providers = connections.map((c) => ({
        id: c.id, name: c.name, type: (c.config as any)?.type || 'oidc',
        enabled: c.status === 'connected', createdAt: c.connectedAt, updatedAt: c.updatedAt,
      }));
      return res.json({ success: true, data: providers, count: providers.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/sso/providers', authenticate, async (req: Request, res: Response) => {
    try {
      const { name, type, config } = req.body;
      if (!name || !['oidc', 'saml', 'oauth2', 'ldap'].includes(type) || !config) return res.status(400).json({ success: false, error: 'Invalid input' });

      const encryptedConfig: Record<string, any> = { type };
      for (const [key, value] of Object.entries(config)) {
        if (['clientSecret', 'privateKey', 'bindPassword'].includes(key) && typeof value === 'string') {
          try { encryptedConfig[key] = getSecret().encrypt(value); encryptedConfig[`${key}Encrypted`] = true; } 
          catch { return res.status(500).json({ success: false, error: 'Encrypt failed' }); }
        } else { encryptedConfig[key] = value; }
      }

      const connection = await prisma.integrationConnection.create({
        data: { tenantId: req.user!.tenantId, integrationType: `sso-${type}`, name, status: 'connected', config: encryptedConfig, connectedBy: req.user!.userId },
        select: { id: true, name: true, integrationType: true, status: true, connectedAt: true },
      });

      return res.status(201).json({ success: true, data: { id: connection.id, name: connection.name, type, enabled: true, createdAt: connection.connectedAt } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/sso/providers/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const existing = await prisma.integrationConnection.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, integrationType: { startsWith: 'sso-' } } });
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

      const oldConfig = (existing.config as Record<string, any>) || {};
      const newConfig = req.body.config ? { ...oldConfig, ...req.body.config, type: oldConfig.type } : oldConfig;

      const updated = await prisma.integrationConnection.update({
        where: { id: existing.id },
        data: { ...(req.body.name && { name: req.body.name }), ...(req.body.enabled !== undefined && { status: req.body.enabled ? 'connected' : 'disconnected' }), config: newConfig },
        select: { id: true, name: true, status: true, updatedAt: true },
      });
      return res.json({ success: true, data: updated });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/sso/providers/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const existing = await prisma.integrationConnection.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, integrationType: { startsWith: 'sso-' } } });
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

      await prisma.integrationConnection.delete({ where: { id: existing.id } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/scim/v2/ServiceProviderConfig', (_req: Request, res: Response) => {
    return res.json({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'], documentationUri: 'https://docs.vyenfita.com/scim', patch: { supported: false }, bulk: { supported: false }, filter: { supported: true, maxResults: 1000 }, changePassword: { supported: false }, sort: { supported: true }, etag: { supported: false }, authenticationSchemes: [{ type: 'oauthbearertoken', name: 'Bearer', description: 'JWT' }] });
  });

  router.get('/scim/v2/Users', authenticate, async (req: Request, res: Response) => {
    try {
      const startIndex = parseInt(req.query.startIndex as string || '1', 10);
      const count = Math.min(parseInt(req.query.count as string || '100', 10), 1000);
      const where: any = { tenantId: req.user!.tenantId, deletedAt: null };
      
      if (req.query.filter) {
        const match = (req.query.filter as string).match(/userName eq "([^"]+)"/i);
        if (match) where.user = { email: match[1].toLowerCase() };
      }

      const [memberships, total] = await Promise.all([
        prisma.membership.findMany({ where, include: { user: true, role: true }, skip: startIndex - 1, take: count }),
        prisma.membership.count({ where }),
      ]);

      const users = memberships.map((m) => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id: m.user.id, userName: m.user.email,
        name: { formatted: m.user.name || '' }, emails: [{ value: m.user.email, primary: true }], active: m.status === 'active',
        roles: [m.role.name], meta: { resourceType: 'User', created: m.user.createdAt.toISOString(), lastModified: m.user.updatedAt.toISOString() },
      }));

      return res.json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'], totalResults: total, startIndex, itemsPerPage: users.length, Resources: users });
    } catch (error) { return res.status(500).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Failed', status: '500' }); }
  });

  router.post('/scim/v2/Users', authenticate, async (req: Request, res: Response) => {
    try {
      const email = req.body.userName || (req.body.emails && req.body.emails[0]?.value);
      if (!email) return res.status(400).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Missing email', status: '400' });

      const existing = await prisma.membership.findFirst({ where: { tenantId: req.user!.tenantId, deletedAt: null, user: { email: email.toLowerCase() } } });
      if (existing) return res.status(409).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Exists', status: '409' });

      let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user) user = await prisma.user.create({ data: { email: email.toLowerCase(), name: req.body.name?.formatted || null, status: 'active' } });

      let role = await prisma.role.findFirst({ where: { tenantId: req.user!.tenantId, name: 'Viewer' } });
      if (!role) role = await prisma.role.create({ data: { tenantId: req.user!.tenantId, name: 'Viewer', isDefault: true } });

      const membership = await prisma.membership.create({ data: { userId: user.id, tenantId: req.user!.tenantId, roleId: role.id, status: 'active', joinedAt: new Date() }, include: { user: true, role: true } });

      return res.status(201).json({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id: membership.user.id, userName: membership.user.email, name: { formatted: membership.user.name || '' }, emails: [{ value: membership.user.email, primary: true }], active: true, roles: [membership.role.name], meta: { resourceType: 'User' } });
    } catch (error) { return res.status(500).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Failed', status: '500' }); }
  });

  router.get('/scim/v2/Users/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const m = await prisma.membership.findFirst({ where: { tenantId: req.user!.tenantId, userId: req.params.id, deletedAt: null }, include: { user: true, role: true } });
      if (!m) return res.status(404).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Not found', status: '404' });
      return res.json({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id: m.user.id, userName: m.user.email, name: { formatted: m.user.name || '' }, emails: [{ value: m.user.email, primary: true }], active: m.status === 'active', roles: [m.role.name], meta: { resourceType: 'User' } });
    } catch (error) { return res.status(500).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Failed', status: '500' }); }
  });

  router.delete('/scim/v2/Users/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const m = await prisma.membership.findFirst({ where: { tenantId: req.user!.tenantId, userId: req.params.id, deletedAt: null } });
      if (!m) return res.status(404).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Not found', status: '404' });
      
      await prisma.membership.update({ where: { id: m.id }, data: { status: 'inactive', deletedAt: new Date() } });
      return res.status(204).send();
    } catch (error) { return res.status(500).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Failed', status: '500' }); }
  });

  return router;
        }
