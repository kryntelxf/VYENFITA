import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createPipelineRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      return res.json({ success: true, data: (tenant?.settings as any)?.pipelines || [] });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, stages = [], environmentId, enabled = true } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'name required' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const pipelines = settings.pipelines || [];
      const pipeline = { id: `pl-${Date.now()}`, name, stages, environmentId: environmentId || null, enabled, createdAt: new Date().toISOString() };
      pipelines.push(pipeline);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, pipelines } } });
      return res.status(201).json({ success: true, data: pipeline });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/:id/trigger', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const pipeline = (settings.pipelines || []).find((p: any) => p.id === req.params.id);
      if (!pipeline) return res.status(404).json({ success: false, error: 'Not found' });
      
      const deployment = await prisma.deployment.create({ data: { tenantId, applicationId: req.body.applicationId || '00000000-0000-0000-0000-000000000000', environmentId: pipeline.environmentId || '00000000-0000-0000-0000-000000000000', status: 'pending', platform: 'pipeline', config: { pipelineId: pipeline.id }, triggeredBy: req.user!.userId } });
      return res.json({ success: true, data: { pipelineId: pipeline.id, runId: deployment.id, status: 'queued' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const pipelines = (settings.pipelines || []).filter((p: any) => p.id !== req.params.id);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, pipelines } } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                                     }
