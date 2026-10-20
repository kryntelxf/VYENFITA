import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createPluginsRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const settings = (tenant?.settings as any) || {};
      const plugins = settings.plugins || [];
      return res.json({ success: true, data: plugins, count: plugins.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, version, description, manifest, enabled = true } = req.body;
      if (!name || !version) return res.status(400).json({ success: false, error: 'Missing fields' });

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const plugins = settings.plugins || [];

      const plugin = { id: `plugin-${Date.now()}`, name, version, description: description || null, manifest: manifest || {}, enabled, registeredBy: req.user!.userId, registeredAt: new Date().toISOString() };
      plugins.push(plugin);

      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, plugins } } });
      return res.status(201).json({ success: true, data: plugin });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const plugin = ((tenant?.settings as any)?.plugins || []).find((p: any) => p.id === req.params.id);
      if (!plugin) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: plugin });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/:id/toggle', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const plugins = settings.plugins || [];
      const plugin = plugins.find((p: any) => p.id === req.params.id);
      if (!plugin) return res.status(404).json({ success: false, error: 'Not found' });
      
      plugin.enabled = !plugin.enabled;
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, plugins } } });
      return res.json({ success: true, data: { id: plugin.id, enabled: plugin.enabled } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const plugins = (settings.plugins || []).filter((p: any) => p.id !== req.params.id);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, plugins } } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                  }
