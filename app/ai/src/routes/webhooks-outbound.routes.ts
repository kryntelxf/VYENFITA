import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';
import { randomBytes } from 'crypto';

export function createWebhooksOutboundRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const webhooks = ((tenant?.settings as any)?.outboundWebhooks || []).map((w: any) => ({ id: w.id, url: w.url, events: w.events, enabled: w.enabled, secretPrefix: w.secret ? `${w.secret.substring(0, 8)}...` : null, createdAt: w.createdAt }));
      return res.json({ success: true, data: webhooks });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { url, events = [], enabled = true } = req.body;
      if (!url || !Array.isArray(events) || events.length === 0) return res.status(400).json({ success: false, error: 'Missing fields' });
      
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const webhooks = settings.outboundWebhooks || [];
      
      const secret = `whsec_${randomBytes(24).toString('hex')}`;
      const webhook = { id: `wh-${Date.now()}`, url, events, enabled, secret, createdAt: new Date().toISOString() };
      webhooks.push(webhook);
      
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, outboundWebhooks: webhooks } } });
      return res.status(201).json({ success: true, data: { id: webhook.id, url, events, enabled, secret }, warning: 'Save this secret.' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/:id/toggle', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const webhooks = settings.outboundWebhooks || [];
      const wh = webhooks.find((w: any) => w.id === req.params.id);
      if (!wh) return res.status(404).json({ success: false, error: 'Not found' });
      
      wh.enabled = !wh.enabled;
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, outboundWebhooks: webhooks } } });
      return res.json({ success: true, data: { id: wh.id, enabled: wh.enabled } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const webhooks = (settings.outboundWebhooks || []).filter((w: any) => w.id !== req.params.id);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, outboundWebhooks: webhooks } } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
