import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createApplicationRouter(): Router {
  const router = Router();
  router.use(authenticate);

  // LIST
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      const where = { tenantId, deletedAt: null };

      const [applications, total] = await Promise.all([
        prisma.application.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.application.count({ where }),
      ]);

      res.json({ success: true, data: applications, pagination: { page, limit, total } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // CREATE
  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { name, description, spec } = req.body;

      if (!name || typeof name !== 'string' || name.length < 1) return res.status(400).json({ success: false, error: 'name required' });

      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        const app = await tx.application.create({ data: { tenantId, name, description: description || null, slug, status: 'draft' } });
        const version = await tx.applicationVersion.create({ data: { applicationId: app.id, version: '1.0.0', spec: spec || {}, changelog: 'Initial', createdBy: userId, isCurrent: true } });
        return await tx.application.update({ where: { id: app.id }, data: { currentVersionId: version.id } });
      });

      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET BY ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const app = await prisma.application.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null } });
      if (!app) return res.status(404).json({ success: false, error: 'Not found' });
      res.json({ success: true, data: app });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE (Soft)
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const app = await prisma.application.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null } });
      if (!app) return res.status(404).json({ success: false, error: 'Not found' });
      
      await prisma.application.update({ where: { id: app.id }, data: { deletedAt: new Date() } });
      res.json({ success: true, message: 'Deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
        }
