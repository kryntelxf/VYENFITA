import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createEnvironmentRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/application/:appId', async (req: Request, res: Response) => {
    try {
      const app = await prisma.application.findFirst({ where: { id: req.params.appId, tenantId: req.user!.tenantId, deletedAt: null } });
      if (!app) return res.status(404).json({ success: false, error: 'App not found' });
      const envs = await prisma.environment.findMany({ where: { applicationId: app.id }, orderBy: { createdAt: 'asc' } });
      return res.json({ success: true, data: envs });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/application/:appId', async (req: Request, res: Response) => {
    try {
      const { name, type = 'custom', url, config = {}, variables = {} } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'name required' });
      const app = await prisma.application.findFirst({ where: { id: req.params.appId, tenantId: req.user!.tenantId, deletedAt: null } });
      if (!app) return res.status(404).json({ success: false, error: 'App not found' });
      const env = await prisma.environment.create({ data: { applicationId: app.id, name, type, url: url || null, config, variables } });
      return res.status(201).json({ success: true, data: env });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const env = await prisma.environment.findFirst({ where: { id: req.params.id, application: { tenantId: req.user!.tenantId, deletedAt: null } } });
      if (!env) return res.status(404).json({ success: false, error: 'Not found' });
      const updated = await prisma.environment.update({ where: { id: env.id }, data: req.body });
      return res.json({ success: true, data: updated });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const env = await prisma.environment.findFirst({ where: { id: req.params.id, application: { tenantId: req.user!.tenantId, deletedAt: null } } });
      if (!env) return res.status(404).json({ success: false, error: 'Not found' });
      await prisma.environment.delete({ where: { id: env.id } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                                               }
