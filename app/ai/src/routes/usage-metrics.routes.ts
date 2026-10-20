import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createUsageMetricsRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const days = parseInt(req.query.days as string || '30', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const usage = await prisma.usageRecord.findMany({ where: { tenantId, timestamp: { gte: startDate } } });
      
      const byService: Record<string, number> = {}; const byOperation: Record<string, number> = {}; let totalQuantity = 0;
      for (const u of usage) { byService[u.service] = (byService[u.service] || 0) + u.quantity; byOperation[u.operation] = (byOperation[u.operation] || 0) + 1; totalQuantity += u.quantity; }
      return res.json({ success: true, data: { period: days, totalRecords: usage.length, totalQuantity, byService, byOperation } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/daily', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const days = parseInt(req.query.days as string || '30', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days); startDate.setHours(0, 0, 0, 0);
      const usage = await prisma.usageRecord.findMany({ where: { tenantId, timestamp: { gte: startDate } } });
      
      const daily: Record<string, { count: number; quantity: number }> = {};
      for (const u of usage) { const day = u.timestamp.toISOString().split('T')[0]; if (!daily[day]) daily[day] = { count: 0, quantity: 0 }; daily[day].count++; daily[day].quantity += u.quantity; }
      return res.json({ success: true, data: { daily, days } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/top-users', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 100);
      const usage = await prisma.usageRecord.groupBy({ by: ['userId'], where: { tenantId, userId: { not: null } }, _count: { _all: true }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: limit });
      
      const userIds = usage.map(u => u.userId).filter(Boolean) as string[];
      const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
      const userMap = new Map(users.map(u => [u.id, u]));
      
      return res.json({ success: true, data: usage.map(u => ({ userId: u.userId, email: u.userId ? userMap.get(u.userId)?.email : null, count: u._count._all, quantity: u._sum.quantity || 0 })) });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/cost-usage', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const days = parseInt(req.query.days as string || '30', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const [usage, costs] = await Promise.all([prisma.usageRecord.count({ where: { tenantId, timestamp: { gte: startDate } } }), prisma.costRecord.aggregate({ where: { tenantId, timestamp: { gte: startDate } }, _sum: { totalCost: true } })]);
      
      const totalCost = costs._sum.totalCost || 0;
      return res.json({ success: true, data: { period: days, totalUsage: usage, totalCost, costPerUsage: usage > 0 ? totalCost / usage : 0, currency: 'USD' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
  }
