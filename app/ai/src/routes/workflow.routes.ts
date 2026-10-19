/**
 * VYENFITA Workflow Routes (Minimal)
 *
 * CRUD endpoints for workflows with tenant isolation.
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createWorkflowRouter(): Router {
  const router = Router();

  router.use(authenticate);

  // ============================================================
  // LIST WORKFLOWS
  // ============================================================

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      const status = req.query.status as string | undefined;

      const where: any = { tenantId, deletedAt: null };
      if (status) where.status = status;

      const [workflows, total] = await Promise.all([
        prisma.workflow.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.workflow.count({ where }),
      ]);

      return res.json({
        success: true,
        data: workflows,
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
        error: error instanceof Error ? error.message : 'Failed to list workflows',
      });
    }
  });

  // ============================================================
  // CREATE WORKFLOW
  // ============================================================

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { name, description, definition, triggers } = req.body;

      if (!name || typeof name !== 'string' || name.length < 1) {
        return res.status(400).json({ success: false, error: 'name is required' });
      }
      if (name.length > 255) {
        return res.status(400).json({ success: false, error: 'name too long (max 255)' });
      }
      if (!definition || typeof definition !== 'object') {
        return res.status(400).json({ success: false, error: 'definition is required' });
      }

      const baseSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80) || 'workflow';
      const slug = `${baseSlug}-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        const workflow = await tx.workflow.create({
          data: {
            tenantId,
            name,
            description: description || null,
            slug,
            status: 'draft',
            triggers: triggers || [],
          },
        });

        const version = await tx.workflowVersion.create({
          data: {
            workflowId: workflow.id,
            version: '1.0.0',
            definition,
            changelog: 'Initial version',
            createdBy: userId,
            isCurrent: true,
          },
        });

        const updated = await tx.workflow.update({
          where: { id: workflow.id },
          data: { currentVersionId: version.id },
        });

        return { workflow: updated, version };
      });

      return res.status(201).json({
        success: true,
        data: {
          ...result.workflow,
          currentVersion: result.version,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create workflow',
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

      const workflow = await prisma.workflow.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }

      const currentVersion = workflow.currentVersionId
        ? await prisma.workflowVersion.findUnique({
            where: { id: workflow.currentVersionId },
          })
        : null;

      return res.json({
        success: true,
        data: { ...workflow, currentVersion },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get workflow',
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

      const workflow = await prisma.workflow.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }

      await prisma.workflow.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return res.json({ success: true, message: 'Workflow deleted' });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete workflow',
      });
    }
  });

  return router;
          }
