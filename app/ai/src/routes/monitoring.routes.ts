import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

const startTime = Date.now();

export function createMonitoringRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const checks: Record<string, { status: string; latencyMs?: number }> = {};
      const dbStart = Date.now();
      try { await prisma.$queryRaw`SELECT 1`; checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }; } 
      catch { checks.database = { status: 'fail' }; }
      const allOk = Object.values(checks).every((c) => c.status === 'ok');
      return res.json({ success: true, data: { status: allOk ? 'healthy' : 'degraded', checks, uptimeSeconds: Math.floor((Date.now() - startTime) / 1000), version: process.env.SERVICE_VERSION || '4.0.0', timestamp: new Date().toISOString() } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/alerts', async (req: Request, res: Response) => {
    try {
      const budgets = await prisma.budget.findMany({ where: { tenantId: req.user!.tenantId, status: 'active' } });
      const alerts: any[] = [];
      for (const b of budgets) {
        const usage = (b.current / b.limit) * 100;
        if (usage >= 80) alerts.push({ type: usage >= 100 ? 'critical' : 'warning', resource: 'budget', message: `Budget "${b.name}" at ${usage.toFixed(1)}%`, triggeredAt: new Date().toISOString() });
      }
      return res.json({ success: true, data: alerts });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/incidents', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string || '7', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const incidents = await prisma.auditEvent.findMany({ where: { tenantId: req.user!.tenantId, eventType: 'security', timestamp: { gte: startDate }, status: { not: 'success' } }, orderBy: { timestamp: 'desc' }, take: 50 });
      return res.json({ success: true, data: incidents });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/sla', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string || '30', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const [totalEvents, successEvents] = await Promise.all([
        prisma.auditEvent.count({ where: { tenantId: req.user!.tenantId, timestamp: { gte: startDate } } }),
        prisma.auditEvent.count({ where: { tenantId: req.user!.tenantId, timestamp: { gte: startDate }, status: 'success' } }),
      ]);
      const availability = totalEvents > 0 ? (successEvents / totalEvents) * 100 : 100;
      return res.json({ success: true, data: { period: { days }, totalEvents, successEvents, availability: Math.round(availability * 100) / 100, slaTarget: 99.9, meetingSla: availability >= 99.9 } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
  }
