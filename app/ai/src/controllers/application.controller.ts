/**
 * VYENFITA Application Controller
 * 
 * Real CRUD endpoints for applications
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { ApplicationService } from '../lib/application/application.service';

export class ApplicationController {
  /**
   * Create application
   * POST /api/v1/applications
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { name, description, slug, spec, tags } = req.body;

      if (!name || !spec) {
        res.status(400).json({
          success: false,
          error: 'name and spec are required',
        });
        return;
      }

      const application = await ApplicationService.create({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        name,
        description,
        slug,
        spec,
        tags,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: application,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create application';
      const isUserError = message.includes('already exists') || message.includes('must be');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to create application',
      });
    }
  }

  /**
   * List applications
   * GET /api/v1/applications
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { status, page, limit } = req.query;

      const result = await ApplicationService.list(req.user.tenantId, {
        status: status as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to list applications',
      });
    }
  }

  /**
   * Get application
   * GET /api/v1/applications/:id
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const application = await ApplicationService.getById(
        req.user.tenantId,
        req.params.id
      );

      res.json({
        success: true,
        data: application,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message.includes('not found') ? 'Application not found' : 'Failed to get application',
      });
    }
  }

  /**
   * Update application
   * PUT /api/v1/applications/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { name, description, status, spec, tags, changeLog } = req.body;

      const application = await ApplicationService.update({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        applicationId: req.params.id,
        name,
        description,
        status,
        spec,
        tags,
        changeLog,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: application,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message.includes('not found') ? 'Application not found' : 'Failed to update application',
      });
    }
  }

  /**
   * Delete application
   * DELETE /api/v1/applications/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await ApplicationService.delete(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: 'Application deleted successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message.includes('not found') ? 'Application not found' : 'Failed to delete application',
      });
    }
  }

  /**
   * Get version history
   * GET /api/v1/applications/:id/versions
   */
  async getVersions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const versions = await ApplicationService.getVersionHistory(
        req.user.tenantId,
        req.params.id
      );

      res.json({
        success: true,
        data: versions,
        count: versions.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message.includes('not found') ? 'Application not found' : 'Failed to get versions',
      });
    }
  }

  /**
   * Rollback to version
   * POST /api/v1/applications/:id/rollback/:versionId
   */
  async rollback(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const result = await ApplicationService.rollback(
        req.user.tenantId,
        req.params.id,
        req.params.versionId,
        req.user.userId,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message.includes('not found') ? 'Not found' : 'Failed to rollback',
      });
    }
  }

  /**
   * Get application statistics
   * GET /api/v1/applications/stats
   */
  async stats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const stats = await ApplicationService.getStats(req.user.tenantId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
      });
    }
  }
  }
