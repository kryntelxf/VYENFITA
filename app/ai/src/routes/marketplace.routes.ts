/**
 * VYENFITA Marketplace Routes (Minimal)
 *
 * Templates, creator profiles, installs, reviews.
 * Tenant isolation enforced via JWT.
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createMarketplaceRouter(): Router {
  const router = Router();

  // ============================================================
  // TEMPLATES — LIST / SEARCH (PUBLIC)
  // ============================================================

  router.get('/templates', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      const query = req.query.q as string | undefined;
      const category = req.query.category as string | undefined;
      const priceType = req.query.priceType as string | undefined;
      const sortBy = (req.query.sortBy as string) || 'recent';

      const where: any = {
        status: 'published',
        visibility: 'public',
        deletedAt: null,
      };

      if (category) where.category = category;
      if (priceType) where.priceType = priceType;
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ];
      }

      const orderBy: any =
        sortBy === 'trending' ? { trendingScore: 'desc' } :
        sortBy === 'popular' ? { installCount: 'desc' } :
        sortBy === 'rating' ? { rating: 'desc' } :
        { createdAt: 'desc' };

      const [templates, total] = await Promise.all([
        prisma.marketplaceTemplate.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true, slug: true, name: true, description: true, category: true,
            tags: true, icon: true, priceType: true, priceAmount: true, currency: true,
            installCount: true, rating: true, reviewCount: true, createdAt: true,
          },
        }),
        prisma.marketplaceTemplate.count({ where }),
      ]);

      return res.json({
        success: true,
        data: templates,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to list templates' });
    }
  });

  // ============================================================
  // TEMPLATES — GET BY ID (PUBLIC)
  // ============================================================

  router.get('/templates/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const template = await prisma.marketplaceTemplate.findFirst({
        where: { OR: [{ id }, { slug: id }], status: 'published', visibility: 'public', deletedAt: null },
        include: { author: { select: { id: true, displayName: true, avatarUrl: true, verified: true } } },
      });

      if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
      return res.json({ success: true, data: template });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to get template' });
    }
  });

  // ============================================================
  // TEMPLATES — CREATE (PROTECTED, CREATOR)
  // ============================================================

  router.post('/templates', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const author = await prisma.marketplaceAuthor.findUnique({ where: { userId } });
      if (!author) return res.status(403).json({ success: false, error: 'Creator profile required. Create one at POST /creators first.' });

      const { slug, name, description, longDescription, category, tags, icon, priceType = 'free', priceAmount, currency = 'USD', license = 'MIT' } = req.body;

      if (!slug || !/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ success: false, error: 'Invalid slug' });
      if (!name || !category) return res.status(400).json({ success: false, error: 'name and category are required' });
      if (priceType === 'paid' && (typeof priceAmount !== 'number' || priceAmount <= 0)) return res.status(400).json({ success: false, error: 'priceAmount required for paid' });

      const existing = await prisma.marketplaceTemplate.findUnique({ where: { slug } });
      if (existing) return res.status(409).json({ success: false, error: 'Slug already taken' });

      const template = await prisma.marketplaceTemplate.create({
        data: { authorId: author.id, slug, name, description, longDescription, category, tags: tags || [], icon, priceType, priceAmount: priceType === 'paid' ? priceAmount : null, currency, license, status: 'draft', visibility: 'public' },
      });

      return res.status(201).json({ success: true, data: template });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // TEMPLATES — INSTALL (PROTECTED)
  // ============================================================

  router.post('/templates/:id/install', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { id } = req.params;

      const template = await prisma.marketplaceTemplate.findFirst({ where: { id, status: 'published', deletedAt: null } });
      if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

      const existing = await prisma.marketplaceInstall.findFirst({ where: { templateId: id, tenantId } });
      if (existing) return res.status(409).json({ success: false, error: 'Already installed' });

      const install = await prisma.marketplaceInstall.create({ data: { templateId: id, tenantId, userId, status: 'completed', installedAt: new Date() } });
      await prisma.marketplaceTemplate.update({ where: { id }, data: { installCount: { increment: 1 } } });

      return res.status(201).json({ success: true, data: install });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // REVIEWS — CREATE
  // ============================================================

  router.post('/templates/:id/reviews', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { id } = req.params;
      const { rating, title, comment } = req.body;

      if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) return res.status(400).json({ success: false, error: 'rating must be integer 1-5' });

      const existing = await prisma.marketplaceReview.findUnique({ where: { templateId_userId: { templateId: id, userId } } });
      if (existing) return res.status(409).json({ success: false, error: 'Already reviewed' });

      const review = await prisma.marketplaceReview.create({ data: { templateId: id, userId, tenantId, rating, title, comment, status: 'published' } });
      const agg = await prisma.marketplaceReview.aggregate({ where: { templateId: id, status: 'published' }, _avg: { rating: true }, _count: { _all: true } });
      
      await prisma.marketplaceTemplate.update({ where: { id }, data: { rating: agg._avg.rating || 0, reviewCount: agg._count._all || 0 } });

      return res.status(201).json({ success: true, data: review });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // REVIEWS — LIST
  // ============================================================

  router.get('/templates/:id/reviews', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);

      const [reviews, total] = await Promise.all([
        prisma.marketplaceReview.findMany({ where: { templateId: id, status: 'published' }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.marketplaceReview.count({ where: { templateId: id, status: 'published' } }),
      ]);

      return res.json({ success: true, data: reviews, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // CREATORS
  // ============================================================

  router.post('/creators', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { displayName, bio, avatarUrl, websiteUrl } = req.body;

      if (!displayName) return res.status(400).json({ success: false, error: 'displayName is required' });

      const existing = await prisma.marketplaceAuthor.findUnique({ where: { userId } });
      if (existing) return res.status(409).json({ success: false, error: 'Profile exists' });

      const profile = await prisma.marketplaceAuthor.create({ data: { userId, displayName, bio, avatarUrl, websiteUrl } });
      return res.status(201).json({ success: true, data: profile });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  router.get('/creators/me', authenticate, async (req: Request, res: Response) => {
    try {
      const profile = await prisma.marketplaceAuthor.findUnique({ where: { userId: req.user!.userId } });
      return res.json({ success: true, data: profile });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // INSTALLS
  // ============================================================

  router.get('/installs', authenticate, async (req: Request, res: Response) => {
    try {
      const installs = await prisma.marketplaceInstall.findMany({
        where: { tenantId: req.user!.tenantId },
        orderBy: { createdAt: 'desc' },
        include: { template: { select: { id: true, name: true, slug: true, icon: true, category: true } } },
      });
      return res.json({ success: true, data: installs, count: installs.length });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  return router;
        }
