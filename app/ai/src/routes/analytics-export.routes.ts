import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createAnalyticsExportRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/metrics-csv', async (req: Request, res: Response) => {
    try {
      const metricName = req.query.metricName as string;
      if (!metricName) return res.status(400).json({ success: false, error: 'metricName required' });

      const points = await prisma.metricDataPoint.findMany({ where: { tenantId: req.user!.tenantId, metricName }, orderBy: { timestamp: 'asc' }, take: 10000 });
      let csv = 'timestamp,value\n';
      for (const p of points) { csv += `${p.timestamp.toISOString()},${p.value}\n`; }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${metricName}-${Date.now()}.csv"`);
      return res.send(csv);
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/events-csv', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string || '30', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const events = await prisma.analyticsEvent.findMany({ where: { tenantId: req.user!.tenantId, timestamp: { gte: startDate } }, orderBy: { timestamp: 'asc' }, take: 10000 });
      
      let csv = 'timestamp,eventName,userId,sessionId,properties\n';
      for (const e of events) {
        const props = JSON.stringify(e.properties).replace(/"/g, '""');
        csv += `${e.timestamp.toISOString()},"${e.eventName}","${e.userId || ''}","${e.sessionId || ''}","${props}"\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="events-${days}d-${Date.now()}.csv"`);
      return res.send(csv);
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/snapshot', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string || '30', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const [kpis, funnels, events, metrics] = await Promise.all([
        prisma.kPI.count({ where: { tenantId: req.user!.tenantId } }),
        prisma.funnel.count({ where: { tenantId: req.user!.tenantId } }),
        prisma.analyticsEvent.count({ where: { tenantId: req.user!.tenantId, timestamp: { gte: startDate } } }),
        prisma.metricDataPoint.groupBy({ by: ['metricName'], where: { tenantId: req.user!.tenantId, timestamp: { gte: startDate } }, _count: { _all: true } }),
      ]);
      return res.json({ success: true, data: { exportedAt: new Date().toISOString(), period: days, kpis, funnels, events, metrics: metrics.map(m => ({ name: m.metricName, count: m._count._all })) } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                                          }
