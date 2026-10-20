import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createTenantBillingInvoicesRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const costs = await prisma.costRecord.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { timestamp: 'desc' }, take: 200 });
      const monthly: Record<string, { total: number; count: number }> = {};
      for (const c of costs) { const m = c.timestamp.toISOString().substring(0, 7); if (!monthly[m]) monthly[m] = { total: 0, count: 0 }; monthly[m].total += c.totalCost; monthly[m].count++; }
      const invoices = Object.entries(monthly).map(([m, d]) => ({ id: `inv-${m}`, month: m, amount: Math.round(d.total * 100) / 100, currency: 'USD', recordCount: d.count, status: 'paid', downloadUrl: `/api/v1/billing/invoices/${m}/download` }));
      return res.json({ success: true, data: invoices });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/:month', async (req: Request, res: Response) => {
    try {
      const { month } = req.params;
      const start = new Date(`${month}-01T00:00:00Z`); const end = new Date(start); end.setMonth(end.getMonth() + 1);
      const costs = await prisma.costRecord.findMany({ where: { tenantId: req.user!.tenantId, timestamp: { gte: start, lt: end } }, orderBy: { timestamp: 'asc' } });
      const total = costs.reduce((s, c) => s + c.totalCost, 0);
      return res.json({ success: true, data: { id: `inv-${month}`, month, period: { start, end }, items: costs.map(c => ({ service: c.service, description: c.description, amount: c.totalCost })), total: Math.round(total * 100) / 100, currency: 'USD' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/:month/download', async (req: Request, res: Response) => {
    try {
      const { month } = req.params;
      const start = new Date(`${month}-01T00:00:00Z`); const end = new Date(start); end.setMonth(end.getMonth() + 1);
      const costs = await prisma.costRecord.findMany({ where: { tenantId: req.user!.tenantId, timestamp: { gte: start, lt: end } }, orderBy: { timestamp: 'asc' } });
      let csv = 'date,service,description,amount,currency\n';
      for (const c of costs) { csv += `${c.timestamp.toISOString()},${c.service},"${c.description.replace(/"/g, '""')}",${c.totalCost},${c.currency}\n`; }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${month}.csv"`);
      return res.send(csv);
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/summary/overview', async (req: Request, res: Response) => {
    try {
      const costs = await prisma.costRecord.findMany({ where: { tenantId: req.user!.tenantId } });
      const totalAllTime = costs.reduce((s, c) => s + c.totalCost, 0);
      const currentMonth = new Date().toISOString().substring(0, 7);
      const thisMonth = costs.filter(c => c.timestamp.toISOString().startsWith(currentMonth)).reduce((s, c) => s + c.totalCost, 0);
      return res.json({ success: true, data: { totalAllTime: Math.round(totalAllTime * 100) / 100, currentMonth: Math.round(thisMonth * 100) / 100, currency: 'USD' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                              }
