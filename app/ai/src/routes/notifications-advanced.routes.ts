import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createNotificationsAdvancedRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/preferences', async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      const metadata = (user?.metadata as any) || {};
      return res.json({ success: true, data: { email: metadata.notificationPrefs?.email ?? true, inApp: metadata.notificationPrefs?.inApp ?? true, desktop: metadata.notificationPrefs?.desktop ?? false, weekly: metadata.notificationPrefs?.weekly ?? true } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/preferences', async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) return res.status(404).json({ success: false, error: 'Not found' });
      const existing = (user.metadata as any) || {};
      const newPrefs = { ...(existing.notificationPrefs || {}), ...req.body };
      await prisma.user.update({ where: { id: req.user!.userId }, data: { metadata: { ...existing, notificationPrefs: newPrefs } } });
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
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) return res.status(404).json({ success: false, error: 'Not found' });
      const existing = (user.metadata as any) || {};
      await prisma.user.update({ where: { id: req.user!.userId }, data: { metadata: { ...existing, notificationsReadAt: new Date().toISOString() } } });
      return res.json({ success: true, message: 'Marked' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
    }
