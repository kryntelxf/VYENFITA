import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createNotificationsAdvancedRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/preferences', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const prefs = settings.notificationPrefs || {};

      return res.json({ success: true, data: { email: prefs.email ?? true, inApp: prefs.inApp ?? true, desktop: prefs.desktop ?? false, weekly: prefs.weekly ?? true } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/preferences', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Not found' });

      const settings = (tenant.settings as any) || {};
      const newPrefs = { ...(settings.notificationPrefs || {}), ...req.body };

      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, notificationPrefs: newPrefs } } });
      return res.json({ success: true, data: newPrefs });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/recent', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      const notifications = await prisma.activityLog.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { timestamp: 'desc' }, take: limit });
      return res.json({ success: true, data: notifications, count: notifications.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/mark-all-read', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Not found' });

      const settings = (tenant.settings as any) || {};
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, notificationsReadAt: new Date().toISOString() } } });
      return res.json({ success: true, message: 'Marked' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
    }
