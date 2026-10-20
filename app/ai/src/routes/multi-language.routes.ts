import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', direction: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', direction: 'ltr' },
  { code: 'es', name: 'Español', direction: 'ltr' },
  { code: 'fr', name: 'Français', direction: 'ltr' },
  { code: 'de', name: 'Deutsch', direction: 'ltr' },
  { code: 'ja', name: '日本語', direction: 'ltr' },
  { code: 'zh', name: '中文', direction: 'ltr' },
  { code: 'ar', name: 'العربية', direction: 'rtl' },
];

export function createMultiLanguageRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/languages', (_req: Request, res: Response) => {
    return res.json({ success: true, data: SUPPORTED_LANGUAGES, count: SUPPORTED_LANGUAGES.length });
  });

  router.get('/preference', async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      return res.json({ success: true, data: { preferredLanguage: user.preferredLanguage, timezone: user.timezone } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/preference', async (req: Request, res: Response) => {
    try {
      const { preferredLanguage, timezone } = req.body;
      if (preferredLanguage && !SUPPORTED_LANGUAGES.some(l => l.code === preferredLanguage)) return res.status(400).json({ success: false, error: 'Unsupported' });
      const updated = await prisma.user.update({ where: { id: req.user!.userId }, data: { ...(preferredLanguage && { preferredLanguage }), ...(timezone && { timezone }) } });
      return res.json({ success: true, data: { preferredLanguage: updated.preferredLanguage, timezone: updated.timezone } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const members = await prisma.membership.findMany({ where: { tenantId: req.user!.tenantId, deletedAt: null }, include: { user: true } });
      const byLanguage: Record<string, number> = {};
      for (const m of members) { byLanguage[m.user.preferredLanguage] = (byLanguage[m.user.preferredLanguage] || 0) + 1; }
      return res.json({ success: true, data: { totalUsers: members.length, byLanguage, supportedLanguages: SUPPORTED_LANGUAGES.length } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                              }
