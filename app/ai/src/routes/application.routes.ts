/**
 * VYENFITA Application Routes (Minimal)
 *
 * CRUD endpoints with tenant isolation enforced by middleware.
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createApplicationRouter(): Router {
  const router = Router();

  router.use(authenticate);

  // ============================================================
  // LIST APPLICATIONS
  // ============================================================

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);

      const where = { tenantId, deletedAt: null };

      const [applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.application.count({ where }),
      ]);

      return res.json({
        success: true,
        data: applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list applications',
      });
    }
  });

  // ============================================================
  // CREATE APPLICATION
  // ============================================================

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { name, description, spec } = req.body;

      if (!name || typeof name !== 'string' || name.length < 1) {
        return res.status(400).json({ success: false, error: 'name is required' });
      }
      if (name.length > 255) {
        return res.status(400).json({ success: false, error: 'name too long (max 255)' });
      }

      const baseSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80) || 'app';
      const slug = `${baseSlug}-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        const application = await tx.application.create({
          data: {
            tenantId,
            name,
            description: description || null,
            slug,
            status: 'draft',
          },
        });

        const version = await tx.applicationVersion.create({
          data: {
            applicationId: application.id,
            version: '1.0.0',
            spec: spec || { metadata: {}, entities: [], pages: [], roles: [] },
            changelog: 'Initial version',
            createdBy: userId,
            isCurrent: true,
          },
        });

        const updated = await tx.application.update({
          where: { id: application.id },
          data: { currentVersionId: version.id },
        });

        return { application: updated, version };
      });

      return res.status(201).json({
        success: true,
        data: {
          ...result.application,
          currentVersion: result.version,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create application',
      });
    }
  });

  // ============================================================
  // GET BY ID
  // ============================================================

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const application = await prisma.application.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!application) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      const currentVersion = application.currentVersionId
        ? await prisma.applicationVersion.findUnique({
            where: { id: application.currentVersionId },
          })
        : null;

      return res.json({
        success: true,
        data: { ...application, currentVersion },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get application',
      });
    }
  });

  // ============================================================
  // DELETE (soft)
  // ============================================================

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const application = await prisma.application.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!application) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      await prisma.application.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return res.json({ success: true, message: 'Application deleted' });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete application',
      });
    }
  });

  return router;
}
