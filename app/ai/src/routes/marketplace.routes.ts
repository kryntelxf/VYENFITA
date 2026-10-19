/**
 * VYENFITA Marketplace Routes (Minimal)
 *
 * CRUD for marketplace templates.
 * Public read access, authenticated write access.
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createMarketplaceRouter(): Router {
  const router = Router();

  // ============================================================
  // LIST TEMPLATES (Public)
  // ============================================================
  router.get('/templates', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      const category = req.query.category as string | undefined;

      const where: any = { status: 'published' };
      if (category) where.category = category;

      const [templates, total] = await Promise.all([
        prisma.marketplaceTemplate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            category: true,
            priceType: true,
            priceAmount: true,
            rating: true,
            installCount: true,
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
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list templates',
      });
    }
  });

  // ============================================================
  // GET TEMPLATE BY SLUG (Public)
  // ============================================================
  router.get('/templates/:slug', async (req: Request, res: Response) => {
    try {
      const template = await prisma.marketplaceTemplate.findUnique({
        where: { slug: req.params.slug },
        include: {
          currentVersion: true,
        },
      });

      if (!template || template.status !== 'published') {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      return res.json({ success: true, data: template });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get template',
      });
    }
  });

  // ============================================================
  // CREATE TEMPLATE (Authenticated)
  // ============================================================
  router.post('/templates', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { name, description, category, priceType, priceAmount } = req.body;

      if (!name || !description || !category) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // Find or create author profile
      let author = await prisma.marketplaceAuthor.findUnique({ where: { userId } });
      if (!author) {
        author = await prisma.marketplaceAuthor.create({
          data: {
            userId,
            displayName: req.user!.email.split('@')[0],
          },
        });
      }

      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80);
      const slug = `${baseSlug}-${Date.now()}`;

      const template = await prisma.marketplaceTemplate.create({
        data: {
          authorId: author.id,
          slug,
          name,
          description,
          category,
          priceType: priceType || 'free',
          priceAmount: priceAmount || 0,
          status: 'draft',
        },
      });

      return res.status(201).json({ success: true, data: template });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template',
      });
    }
  });

  return router;
          }
