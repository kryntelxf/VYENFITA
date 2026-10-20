import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createSupportTicketsRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const tickets = (tenant?.settings as any)?.tickets || [];
      const filtered = req.query.status ? tickets.filter((t: any) => t.status === req.query.status) : tickets;
      return res.json({ success: true, data: filtered, count: filtered.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { subject, description, priority = 'medium', category = 'general' } = req.body;
      if (!subject || !description) return res.status(400).json({ success: false, error: 'Missing fields' });
      
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const tickets = settings.tickets || [];
      
      const ticket = { id: `tick-${Date.now()}`, subject, description, priority, category, status: 'open', createdBy: req.user!.userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), responses: [] };
      tickets.push(ticket);
      
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, tickets } } });
      return res.status(201).json({ success: true, data: ticket });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const ticket = ((tenant?.settings as any)?.tickets || []).find((t: any) => t.id === req.params.id);
      if (!ticket) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: ticket });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/:id/respond', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { text } = req.body;
      if (!text) return res.status(400).json({ success: false, error: 'Missing text' });
      
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const tickets = settings.tickets || [];
      const ticket = tickets.find((t: any) => t.id === req.params.id);
      if (!ticket) return res.status(404).json({ success: false, error: 'Not found' });
      
      ticket.responses.push({ id: `resp-${Date.now()}`, text, respondedBy: req.user!.userId, respondedAt: new Date().toISOString() });
      ticket.status = 'in_progress';
      ticket.updatedAt = new Date().toISOString();
      
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, tickets } } });
      return res.json({ success: true, data: ticket });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/:id/close', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const tickets = settings.tickets || [];
      const ticket = tickets.find((t: any) => t.id === req.params.id);
      if (!ticket) return res.status(404).json({ success: false, error: 'Not found' });
      
      ticket.status = 'closed';
      ticket.updatedAt = new Date().toISOString();
      
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, tickets } } });
      return res.json({ success: true, data: ticket });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
