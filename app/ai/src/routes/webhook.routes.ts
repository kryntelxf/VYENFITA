import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createWebhookRouter(): Router {
  const router = Router();

  router.post('/inbound/:token', async (req: Request, res: Response) => {
    try {
      const [workflowId] = req.params.token.split('-');
      const workflow = await prisma.workflow.findFirst({ where: { OR: [{ id: workflowId }, { slug: req.params.token }], deletedAt: null } });
      if (!workflow) return res.status(404).json({ success: false, error: 'Webhook not found' });
      
      const execution = await prisma.workflowExecution.create({ data: { workflowId: workflow.id, tenantId: workflow.tenantId, status: 'pending', input: req.body || {}, triggerType: 'webhook', startedAt: new Date() } });
      return res.status(202).json({ success: true, data: { executionId: execution.id, status: 'queued' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/test/:workflowId', authenticate, async (req: Request, res: Response) => {
    try {
      const workflow = await prisma.workflow.findFirst({ where: { id: req.params.workflowId, tenantId: req.user!.tenantId, deletedAt: null } });
      if (!workflow) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: { workflowId: workflow.id, webhookUrl: `${req.protocol}://${req.get('host')}/api/v1/webhooks/inbound/${workflow.id}`, method: 'POST' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/tokens', authenticate, async (req: Request, res: Response) => {
    try {
      const workflows = await prisma.workflow.findMany({ where: { tenantId: req.user!.tenantId, deletedAt: null }, select: { id: true, name: true, triggers: true } });
      const tokens = workflows.filter(w => Array.isArray(w.triggers) && (w.triggers as any[]).some(t => t.type === 'webhook')).map(w => ({ workflowId: w.id, workflowName: w.name, url: `/api/v1/webhooks/inbound/${w.id}` }));
      return res.json({ success: true, data: tokens, count: tokens.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                              }
