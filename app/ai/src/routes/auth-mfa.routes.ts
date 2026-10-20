import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

let otplib: any = null;
try { otplib = require('otplib'); } catch { otplib = null; }

export function createMFARouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.post('/setup', async (req: Request, res: Response) => {
    if (!otplib) return res.status(501).json({ success: false, error: 'MFA not available. Install otplib: yarn add otplib' });
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) return res.status(404).json({ success: false, error: 'Not found' });

      const secret = otplib.authenticator.generateSecret();
      const otpauth = otplib.authenticator.keyuri(user.email, 'VYENFITA', secret);

      const metadata = (user.metadata as any) || {};
      await prisma.user.update({ where: { id: user.id }, data: { metadata: { ...metadata, pendingMfaSecret: secret } } });
      return res.json({ success: true, data: { secret, otpauth } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/verify', async (req: Request, res: Response) => {
    if (!otplib) return res.status(501).json({ success: false, error: 'MFA not available' });
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ success: false, error: 'code required' });

      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) return res.status(404).json({ success: false, error: 'Not found' });

      const metadata = (user.metadata as any) || {};
      if (!metadata.pendingMfaSecret) return res.status(400).json({ success: false, error: 'No pending setup' });

      const valid = otplib.authenticator.verify({ token: code, secret: metadata.pendingMfaSecret });
      if (!valid) return res.status(400).json({ success: false, error: 'Invalid code' });

      await prisma.user.update({ where: { id: user.id }, data: { metadata: { ...metadata, mfaEnabled: true, mfaSecret: metadata.pendingMfaSecret, pendingMfaSecret: undefined } } });
      return res.json({ success: true, message: 'MFA enabled' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/disable', async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) return res.status(404).json({ success: false, error: 'Not found' });
      const metadata = (user.metadata as any) || {};
      await prisma.user.update({ where: { id: user.id }, data: { metadata: { ...metadata, mfaEnabled: false, mfaSecret: undefined } } });
      return res.json({ success: true, message: 'MFA disabled' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/status', async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      const metadata = (user?.metadata as any) || {};
      return res.json({ success: true, data: { enabled: !!metadata.mfaEnabled, available: !!otplib } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
    }
