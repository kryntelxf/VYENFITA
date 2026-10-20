import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

const PLAN_QUOTAS: Record<string, any> = {
  free: { users: 5, applications: 10, workflows: 5, aiCallsMonth: 100, storageGB: 1 },
  starter: { users: 20, applications: 50, workflows: 30, aiCallsMonth: 5000, storageGB: 10 },
  pro: { users: 100, applications: 500, workflows: 300, aiCallsMonth: 50000, storageGB: 100 },
  enterprise: { users: -1, applications: -1, workflows: -1, aiCallsMonth: -1, storageGB: 1000 },
};

export function createTenantQuotasRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Not found' });
      const quotas = PLAN_QUOTAS[tenant.plan] || PLAN_QUOTAS.free;
      const [users, applications, workflows] = await Promise.all([prisma.membership.count({ where: { tenantId, deletedAt: null } }), prisma.application.count({ where: { tenantId, deletedAt: null } }), prisma.workflow.count({ where: { tenantId, deletedAt: null } })]);
      const aiUsage = await prisma.usageRecord.aggregate({ where: { tenantId, service: { in: ['openai', 'anthropic'] } }, _sum: { quantity: true } });
      return res.json({ success: true, data: { plan: tenant.plan, quotas, usage: { users, applications, workflows, aiCallsMonth: aiUsage._sum.quantity || 0 }, canAddUser: quotas.users === -1 || users < quotas.users, canAddApplication: quotas.applications === -1 || applications < quotas.applications, canAddWorkflow: quotas.workflows === -1 || workflows < quotas.workflows } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/check/:resource', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Not found' });
      const quotas = PLAN_QUOTAS[tenant.plan] || PLAN_QUOTAS.free;
      const limit = quotas[req.params.resource];
      if (limit === undefined) return res.status(400).json({ success: false, error: 'Unknown resource' });

      let current = 0;
      if (req.params.resource === 'users') current = await prisma.membership.count({ where: { tenantId, deletedAt: null } });
      else if (req.params.resource === 'applications') current = await prisma.application.count({ where: { tenantId, deletedAt: null } });
      else if (req.params.resource === 'workflows') current = await prisma.workflow.count({ where: { tenantId, deletedAt: null } });

      return res.json({ success: true, data: { resource: req.params.resource, limit, current, allowed: limit === -1 || current < limit, remaining: limit === -1 ? -1 : Math.max(0, limit - current) } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/plans', (_req: Request, res: Response) => {
    return res.json({ success: true, data: Object.entries(PLAN_QUOTAS).map(([name, quotas]) => ({ name, quotas })) });
  });

  router.get('/overage', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Not found' });
      const quotas = PLAN_QUOTAS[tenant.plan] || PLAN_QUOTAS.free;
      const [users, apps, wfs] = await Promise.all([prisma.membership.count({ where: { tenantId, deletedAt: null } }), prisma.application.count({ where: { tenantId, deletedAt: null } }), prisma.workflow.count({ where: { tenantId, deletedAt: null } })]);
      const overages: any[] = [];
      if (quotas.users !== -1 && users > quotas.users) overages.push({ resource: 'users', limit: quotas.users, current: users, over: users - quotas.users });
      if (quotas.applications !== -1 && apps > quotas.applications) overages.push({ resource: 'applications', limit: quotas.applications, current: apps, over: apps - quotas.applications });
      if (quotas.workflows !== -1 && wfs > quotas.workflows) overages.push({ resource: 'workflows', limit: quotas.workflows, current: wfs, over: wfs - quotas.workflows });
      return res.json({ success: true, data: { overages, hasOverages: overages.length > 0 } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                              }
