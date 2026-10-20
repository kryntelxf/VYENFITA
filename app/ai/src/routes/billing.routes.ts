import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

const PLANS = [
  { id: 'free', name: 'Free', price: 0, currency: 'USD', limits: { users: 5, applications: 10, aiCallsPerMonth: 100 } },
  { id: 'starter', name: 'Starter', price: 29, currency: 'USD', limits: { users: 20, applications: 50, aiCallsPerMonth: 5000 } },
  { id: 'pro', name: 'Pro', price: 99, currency: 'USD', limits: { users: 100, applications: 500, aiCallsPerMonth: 50000 } },
  { id: 'enterprise', name: 'Enterprise', price: 499, currency: 'USD', limits: { users: -1, applications: -1, aiCallsPerMonth: -1 } },
];

export function createBillingRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/plans', (_req: Request, res: Response) => {
    return res.json({ success: true, data: PLANS, count: PLANS.length });
  });

  router.get('/subscription', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Not found' });
      const plan = PLANS.find((p) => p.id === tenant.plan) || PLANS[0];
      return res.json({ success: true, data: { plan: tenant.plan, planDetails: plan, status: tenant.status, since: tenant.createdAt } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/subscription', async (req: Request, res: Response) => {
    try {
      const { plan } = req.body;
      if (!PLANS.some((p) => p.id === plan)) return res.status(400).json({ success: false, error: 'Invalid plan' });
      const updated = await prisma.tenant.update({ where: { id: req.user!.tenantId }, data: { plan } });
      return res.json({ success: true, data: { plan: updated.plan, note: 'Plan updated.' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/usage', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const startDate = new Date(); startDate.setDate(1);
      const [usageRecords, aiUsage] = await Promise.all([
        prisma.usageRecord.findMany({ where: { tenantId, timestamp: { gte: startDate } } }),
        prisma.usageRecord.aggregate({ where: { tenantId, service: { in: ['openai', 'anthropic'] }, timestamp: { gte: startDate } }, _sum: { quantity: true } }),
      ]);
      return res.json({ success: true, data: { period: 'current-month', totalRecords: usageRecords.length, aiTokensUsed: aiUsage._sum.quantity || 0 } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/invoices', async (req: Request, res: Response) => {
    try {
      const costs = await prisma.costRecord.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { timestamp: 'desc' }, take: 100 });
      const monthly: Record<string, number> = {};
      for (const c of costs) { const month = c.timestamp.toISOString().substring(0, 7); monthly[month] = (monthly[month] || 0) + c.totalCost; }
      const invoices = Object.entries(monthly).map(([month, total]) => ({ id: `inv-${month}`, month, amount: total, currency: 'USD', status: 'paid' }));
      return res.json({ success: true, data: invoices, count: invoices.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                                                 }
