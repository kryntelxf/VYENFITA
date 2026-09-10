/**
 * VYENFITA Workflow Controller
 * 
 * Real CRUD endpoints for workflows
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { WorkflowService } from '../lib/workflow/workflow.service';

export class WorkflowController {
  /**
   * Create workflow
   * POST /api/v1/workflows
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { name, description, slug, definition, triggers } = req.body;

      if (!name || !definition) {
        res.status(400).json({
          success: false,
          error: 'name and definition are required',
        });
        return;
      }

      const workflow = await WorkflowService.create({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        name,
        description,
        slug,
        definition,
        triggers,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError = message.includes('already exists') || message.includes('must be');
      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to create workflow',
      });
    }
  }

  /**
   * List workflows
   * GET /api/v1/workflows
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { status, page, limit } = req.query;

      const result = await WorkflowService.list(req.user.tenantId, {
        status: status as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list workflows' });
    }
  }

  /**
   * Get workflow
   * GET /api/v1/workflows/:id
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const workflow = await WorkflowService.getById(req.user.tenantId, req.params.id);

      res.json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message.includes('not found') ? 'Workflow not found' : 'Failed to get workflow',
      });
    }
  }

  /**
   * Delete workflow
   * DELETE /api/v1/workflows/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await WorkflowService.delete(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: 'Workflow deleted successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message.includes('not found') ? 'Workflow not found' : 'Failed to delete workflow',
      });
    }
  }

  /**
   * Get workflow statistics
   * GET /api/v1/workflows/stats
   */
  async stats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const stats = await WorkflowService.getStats(req.user.tenantId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get statistics' });
    }
  }
        }
