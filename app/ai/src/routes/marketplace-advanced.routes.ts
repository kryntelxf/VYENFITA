import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createMarketplaceAdvancedRouter(): Router {
  const router = Router();

  router.get('/categories', (_req: Request, res: Response) => {
    const categories = [
      { id: 'business', name: 'Business', icon: '💼' }, { id: 'personal', name: 'Personal', icon: '👤' },
      { id: 'data', name: 'Data & Analytics', icon: '📊' }, { id: 'form', name: 'Forms', icon: '📝' },
      { id: 'crm', name: 'CRM', icon: '🤝' }, { id: 'support', name: 'Support', icon: '🎫' },
      { id: 'marketing', name: 'Marketing', icon: '📢' }, { id: 'devtools', name: 'DevTools', icon: '🛠' },
    ];
    return res.json({ success: true, data: categories, count: categories.length });
  });

  router.get('/featured', async (_req: Request, res: Response) => {
    try {
      const templates = await prisma.marketplaceTemplate.findMany({
        where: { status: 'published', visibility: 'public', deletedAt: null },
        orderBy: [{ rating: 'desc' }, { installCount: 'desc' }], take: 10,
        select: { id: true, slug: true, name: true, description: true, icon: true, rating: true, installCount: true },
      });
      return res.json({ success: true, data: templates, count: templates.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/top-sellers', async (_req: Request, res: Response) => {
    try {
      const authors = await prisma.marketplaceAuthor.findMany({
        where: { verified: true },
        orderBy: [{ installCount: 'desc' }, { averageRating: 'desc' }], take: 10,
        select: { id: true, displayName: true, avatarUrl: true, installCount: true, averageRating: true },
      });
      return res.json({ success: true, data: authors, count: authors.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/verify-creator', authenticate, async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;
      const author = await prisma.marketplaceAuthor.findUnique({ where: { userId: req.user!.userId } });
      if (!author) return res.status(404).json({ success: false, error: 'Profile not found' });
      if (author.verified) return res.status(400).json({ success: false, error: 'Already verified' });

      await prisma.marketplaceAuthor.update({ where: { id: author.id }, data: { verificationNotes: notes || null } });
      return res.status(202).json({ success: true, data: { status: 'pending', note: 'Verification submitted.' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
