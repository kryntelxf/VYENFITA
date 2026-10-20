import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createDashboardRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      return res.json({ success: true, data: (tenant?.settings as any)?.dashboards || [] });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description, widgets = [] } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'name required' });
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const dashboards = settings.dashboards || [];
      const dashboard = { id: `db-${Date.now()}`, name, description: description || null, widgets, createdBy: req.user!.userId, createdAt: new Date().toISOString() };
      dashboards.push(dashboard);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, dashboards } } });
      return res.status(201).json({ success: true, data: dashboard });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const dashboard = ((tenant?.settings as any)?.dashboards || []).find((d: any) => d.id === req.params.id);
      if (!dashboard) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: dashboard });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const dashboards = (settings.dashboards || []).filter((d: any) => d.id !== req.params.id);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, dashboards } } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
