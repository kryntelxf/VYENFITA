import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

const AVAILABLE_TARGETS = ['docker', 'kubernetes', 'aws-ecs', 'gcp-cloud-run', 'vercel'];

export function createDeploymentRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/targets', (_req: Request, res: Response) => {
    return res.json({ success: true, data: AVAILABLE_TARGETS, count: AVAILABLE_TARGETS.length });
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      const where: any = { tenantId };
      if (status) where.status = status;
      const [deployments, total] = await Promise.all([
        prisma.deployment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.deployment.count({ where }),
      ]);
      return res.json({ success: true, data: deployments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { applicationId, environmentId, versionId, target } = req.body;
      if (!applicationId || !environmentId || !versionId || !target) return res.status(400).json({ success: false, error: 'Missing fields' });
      if (!AVAILABLE_TARGETS.includes(target.type)) return res.status(400).json({ success: false, error: 'Invalid target' });
      const app = await prisma.application.findFirst({ where: { id: applicationId, tenantId, deletedAt: null } });
      if (!app) return res.status(404).json({ success: false, error: 'App not found' });
      
      const deployment = await prisma.deployment.create({ data: { tenantId, applicationId, environmentId, versionId, status: 'pending', platform: target.type, config: { target, ...(req.body.config || {}) }, triggeredBy: userId } });
      return res.status(201).json({ success: true, data: deployment });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const deployment = await prisma.deployment.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
      if (!deployment) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: deployment });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const deployment = await prisma.deployment.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
      if (!deployment) return res.status(404).json({ success: false, error: 'Not found' });
      await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'removed', completedAt: new Date() } });
      return res.json({ success: true, message: 'Removed' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                                                                                  }
