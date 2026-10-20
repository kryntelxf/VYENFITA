import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createFileStorageRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      return res.json({ success: true, data: (tenant?.settings as any)?.files || [] });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, size, mimeType, url } = req.body;
      if (!name || size === undefined) return res.status(400).json({ success: false, error: 'Missing fields' });
      
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const files = settings.files || [];
      
      const file = { id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`, name, size, mimeType: mimeType || 'application/octet-stream', url: url || null, uploadedBy: req.user!.userId, uploadedAt: new Date().toISOString() };
      files.push(file);
      
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, files } } });
      return res.status(201).json({ success: true, data: file, note: 'Upload to S3 added later.' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const file = ((tenant?.settings as any)?.files || []).find((f: any) => f.id === req.params.id);
      if (!file) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: file });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const files = (settings.files || []).filter((f: any) => f.id !== req.params.id);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, files } } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
