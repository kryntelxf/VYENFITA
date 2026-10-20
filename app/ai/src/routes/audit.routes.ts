import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createAuditRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/events', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
      const eventType = req.query.eventType as string | undefined;
      const where: any = { tenantId };
      if (eventType) where.eventType = eventType;
      
      const [events, total] = await Promise.all([
        prisma.auditEvent.findMany({ where, orderBy: { timestamp: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.auditEvent.count({ where }),
      ]);
      return res.json({ success: true, data: events, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const days = parseInt(req.query.days as string || '30', 10);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const events = await prisma.auditEvent.findMany({ where: { tenantId, timestamp: { gte: startDate } } });
      const byEventType: any = {}; const byStatus: any = {};
      for (const e of events) { byEventType[e.eventType] = (byEventType[e.eventType] || 0) + 1; byStatus[e.status] = (byStatus[e.status] || 0) + 1; }
      return res.json({ success: true, data: { period: { start: startDate.toISOString() }, totalEvents: events.length, byEventType, byStatus } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/events/:id', async (req: Request, res: Response) => {
    try {
      const event = await prisma.auditEvent.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
      if (!event) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: event });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
