import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createCommentsRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const { resourceType, resourceId } = req.query;
      if (!resourceType || !resourceId) return res.status(400).json({ success: false, error: 'Missing params' });
      const comments = await prisma.activityLog.findMany({ where: { tenantId: req.user!.tenantId, action: 'comment', resource: resourceType as string, resourceId: resourceId as string }, orderBy: { timestamp: 'desc' } });
      return res.json({ success: true, data: comments });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { resourceType, resourceId, text } = req.body;
      if (!resourceType || !resourceId || !text) return res.status(400).json({ success: false, error: 'Missing fields' });
      const comment = await prisma.activityLog.create({ data: { tenantId: req.user!.tenantId, userId: req.user!.userId, action: 'comment', resource: resourceType, resourceId, details: { text } } });
      return res.status(201).json({ success: true, data: comment });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const comment = await prisma.activityLog.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, action: 'comment' } });
      if (!comment) return res.status(404).json({ success: false, error: 'Not found' });
      await prisma.activityLog.delete({ where: { id: comment.id } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/mine', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      const comments = await prisma.activityLog.findMany({ where: { tenantId: req.user!.tenantId, userId: req.user!.userId, action: 'comment' }, orderBy: { timestamp: 'desc' }, take: limit });
      return res.json({ success: true, data: comments });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                      }
