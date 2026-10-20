import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createDataExportRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.post('/my-data', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ success: false, error: 'Not found' });
      const memberships = await prisma.membership.findMany({ where: { userId, deletedAt: null }, include: { tenant: true, role: true } });
      const data = { exportedAt: new Date().toISOString(), user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }, memberships: memberships.map(m => ({ tenantId: m.tenantId, tenantName: m.tenant.name, role: m.role.name })), currentTenant: req.user!.tenantId };
      return res.json({ success: true, data });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/deletion-request', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { confirmEmail } = req.body;
      if (!confirmEmail) return res.status(400).json({ success: false, error: 'confirmEmail required' });
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.email.toLowerCase() !== confirmEmail.toLowerCase()) return res.status(400).json({ success: false, error: 'Email mismatch' });

      await prisma.auditEvent.create({ data: { tenantId: req.user!.tenantId, userId, eventType: 'delete', action: 'gdpr.deletion_requested', resource: 'user', resourceId: userId, status: 'success', details: { requestedAt: new Date().toISOString() } } });
      return res.status(202).json({ success: true, data: { message: 'Requested', scheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/deletion-status', async (req: Request, res: Response) => {
    try {
      const request = await prisma.auditEvent.findFirst({ where: { userId: req.user!.userId, action: 'gdpr.deletion_requested' }, orderBy: { timestamp: 'desc' } });
      if (!request) return res.json({ success: true, data: { requested: false } });
      const scheduledAt = new Date(request.timestamp.getTime() + 30 * 24 * 60 * 60 * 1000);
      return res.json({ success: true, data: { requested: true, requestedAt: request.timestamp, scheduledAt, daysRemaining: Math.max(0, Math.ceil((scheduledAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/tenant-data', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Not found' });
      const counts = await Promise.all([prisma.membership.count({ where: { tenantId, deletedAt: null } }), prisma.application.count({ where: { tenantId, deletedAt: null } }), prisma.workflow.count({ where: { tenantId, deletedAt: null } }), prisma.deployment.count({ where: { tenantId } })]);
      return res.json({ success: true, data: { exportedAt: new Date().toISOString(), tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, plan: tenant.plan }, counts: { members: counts[0], applications: counts[1], workflows: counts[2], deployments: counts[3] } } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
  }
