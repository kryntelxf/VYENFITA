import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createAnalyticsAdvancedRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/retention', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const events = await prisma.analyticsEvent.findMany({ where: { tenantId, timestamp: { gte: startDate, lte: endDate } }, orderBy: { timestamp: 'asc' } });
      const cohorts = new Map<string, { users: Set<string> }>();
      for (const e of events) {
        const uid = e.userId || e.sessionId;
        if (!uid) continue;
        const week = Math.floor(e.timestamp.getTime() / (7 * 24 * 60 * 60 * 1000));
        const key = `week-${week}`;
        if (!cohorts.has(key)) cohorts.set(key, { users: new Set() });
        cohorts.get(key)!.users.add(uid);
      }
      return res.json({ success: true, data: { cohorts: Array.from(cohorts.entries()).map(([key, data]) => ({ cohort: key, size: data.users.size })), period: { startDate, endDate } } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/segments', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const members = await prisma.membership.findMany({ where: { tenantId, deletedAt: null }, include: { role: true } });
      const segments: Record<string, number> = {};
      for (const m of members) { segments[m.role.name] = (segments[m.role.name] || 0) + 1; }
      return res.json({ success: true, data: { totalMembers: members.length, byRole: segments } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/ab-tests', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, variants, metric, description } = req.body;
      if (!name || !Array.isArray(variants) || variants.length < 2) return res.status(400).json({ success: false, error: 'Invalid input' });
      const record = await prisma.metricDataPoint.create({ data: { tenantId, metricName: `ab_test:${name}`, value: variants.length, labels: { name, metric, description, variants: JSON.stringify(variants) } } });
      return res.status(201).json({ success: true, data: { id: record.id, name, variants, metric, status: 'running', createdAt: record.timestamp } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/attribution', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const days = parseInt(req.query.days as string || '30', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const events = await prisma.analyticsEvent.findMany({ where: { tenantId, timestamp: { gte: startDate } }, orderBy: { timestamp: 'desc' } });
      const attribution: Record<string, number> = {};
      for (const e of events) { const channel = (e.properties as any)?.channel || 'direct'; attribution[channel] = (attribution[channel] || 0) + 1; }
      return res.json({ success: true, data: { attribution, days } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/realtime', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const events = await prisma.analyticsEvent.findMany({ where: { tenantId, timestamp: { gte: fiveMinAgo } } });
      const byType: Record<string, number> = {};
      for (const e of events) { byType[e.eventName] = (byType[e.eventName] || 0) + 1; }
      return res.json({ success: true, data: { window: '5m', totalEvents: events.length, byEventType: byType, timestamp: new Date().toISOString() } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
          }
