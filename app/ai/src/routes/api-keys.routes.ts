import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';
import { randomBytes, createHash } from 'crypto';

export function createAPIKeysRouter(): Router {
  const router = Router();
  router.use(authenticate);
  const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const keys = ((tenant?.settings as any)?.apiKeys || []).map((k: any) => ({ id: k.id, name: k.name, prefix: k.prefix, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt, expiresAt: k.expiresAt }));
      return res.json({ success: true, data: keys });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, expiresInDays } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'name required' });
      
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const keys = settings.apiKeys || [];
      
      const rawKey = `vyk_${randomBytes(24).toString('hex')}`;
      const prefix = rawKey.substring(0, 12);
      const newKey = { id: `key-${Date.now()}`, name, prefix, hashedKey: hashKey(rawKey), createdAt: new Date().toISOString(), expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null, lastUsedAt: null };
      keys.push(newKey);
      
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, apiKeys: keys } } });
      return res.status(201).json({ success: true, data: { id: newKey.id, name, key: rawKey, prefix, expiresAt: newKey.expiresAt }, warning: 'Save this key now.' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const keys = (settings.apiKeys || []).filter((k: any) => k.id !== req.params.id);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, apiKeys: keys } } });
      return res.json({ success: true, message: 'Revoked' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/:id/rotate', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const keys = settings.apiKeys || [];
      const oldKey = keys.find((k: any) => k.id === req.params.id);
      if (!oldKey) return res.status(404).json({ success: false, error: 'Not found' });
      
      const rawKey = `vyk_${randomBytes(24).toString('hex')}`;
      oldKey.prefix = rawKey.substring(0, 12);
      oldKey.hashedKey = hashKey(rawKey);
      oldKey.lastUsedAt = null;
      
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, apiKeys: keys } } });
      return res.json({ success: true, data: { id: oldKey.id, newKey: rawKey, prefix: oldKey.prefix }, warning: 'Save this new key.' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
