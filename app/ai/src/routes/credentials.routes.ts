import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';
import { SecretService } from '../lib/security/secret.service';

export function createCredentialsRouter(): Router {
  const router = Router();
  router.use(authenticate);
  let secretService: SecretService | null = null;
  const getSecret = () => (secretService ||= new SecretService());

  router.get('/', async (req: Request, res: Response) => {
    try {
      const creds = await prisma.secret.findMany({ where: { tenantId: req.user!.tenantId, deletedAt: null, type: 'credential' }, select: { id: true, name: true, description: true, provider: true, createdAt: true } });
      return res.json({ success: true, data: creds });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description, provider, value } = req.body;
      if (!name || !value) return res.status(400).json({ success: false, error: 'Missing' });
      let encrypted: string;
      try { encrypted = getSecret().encrypt(value); } catch { return res.status(500).json({ success: false, error: 'Encrypt failed' }); }
      const cred = await prisma.secret.create({ data: { tenantId: req.user!.tenantId, name, description: description || null, provider: provider || 'custom', type: 'credential', vaultPath: encrypted }, select: { id: true, name: true, provider: true, createdAt: true } });
      return res.status(201).json({ success: true, data: cred });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const cred = await prisma.secret.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, type: 'credential', deletedAt: null } });
      if (!cred) return res.status(404).json({ success: false, error: 'Not found' });
      let value = null;
      try { value = cred.vaultPath ? getSecret().decrypt(cred.vaultPath) : null; } catch {}
      return res.json({ success: true, data: { id: cred.id, name: cred.name, value } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const cred = await prisma.secret.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, type: 'credential', deletedAt: null } });
      if (!cred) return res.status(404).json({ success: false, error: 'Not found' });
      await prisma.secret.update({ where: { id: cred.id }, data: { deletedAt: new Date() } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                                       }
