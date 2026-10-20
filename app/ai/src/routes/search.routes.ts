import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createSearchRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const q = req.query.q as string | undefined;
      if (!q || q.trim().length < 2) return res.status(400).json({ success: false, error: 'Query too short' });
      const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 50);
      const tenantId = req.user!.tenantId;

      const [applications, workflows, templates] = await Promise.all([
        prisma.application.findMany({ where: { tenantId, deletedAt: null, OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, name: true, status: true } }),
        prisma.workflow.findMany({ where: { tenantId, deletedAt: null, OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, name: true, status: true } }),
        prisma.marketplaceTemplate.findMany({ where: { status: 'published', visibility: 'public', deletedAt: null, OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, name: true, category: true } }),
      ]);
      return res.json({ success: true, data: { query: q, applications: applications.map(a => ({ type: 'application', ...a })), workflows: workflows.map(w => ({ type: 'workflow', ...w })), templates: templates.map(t => ({ type: 'template', ...t })), total: applications.length + workflows.length + templates.length } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/suggest', async (req: Request, res: Response) => {
    try {
      const q = req.query.q as string | undefined;
      if (!q || q.trim().length < 1) return res.json({ success: true, data: [] });
      const apps = await prisma.application.findMany({ where: { tenantId: req.user!.tenantId, deletedAt: null, name: { startsWith: q, mode: 'insensitive' } }, take: 5, select: { id: true, name: true } });
      return res.json({ success: true, data: apps.map(a => ({ id: a.id, label: a.name, type: 'application' })) });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
}
