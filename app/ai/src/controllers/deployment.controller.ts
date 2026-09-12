/**
 * VYENFITA Deployment Controller
 * 
 * @version 2.0.0
 */

import { Request, Response } from 'express';
import { getDeploymentService } from '../lib/deployment/deployment.service';
import { prisma } from '../lib/database/client';

export class DeploymentController {
  /**
   * List available deployment target types
   * GET /api/v1/deployments/targets
   * 
   * MUST be defined before /deployments/:deploymentId to avoid collision
   */
  async listTargets(_req: Request, res: Response): Promise<void> {
    try {
      const service = getDeploymentService();
      const targets = service.listAvailableTargets();

      res.json({
        success: true,
        data: targets,
        count: targets.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to list targets',
      });
    }
  }

  /**
   * Deploy application
   * POST /api/v1/deployments/applications/:id/deployments
   */
  async deploy(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const applicationId = req.params.id;
      const { environmentId, versionId, target } = req.body;

      if (!environmentId || !versionId || !target) {
        res.status(400).json({
          success: false,
          error: 'environmentId, versionId, and target are required',
        });
        return;
      }

      if (!target.type || !target.name) {
        res.status(400).json({
          success: false,
          error: 'target.type and target.name are required',
        });
        return;
      }

      const service = getDeploymentService();

      const result = await service.deploy({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        applicationId,
        environmentId,
        versionId,
        target,
        config: req.body.config,
      });

      const statusCode = result.success ? 201 : 422;

      res.status(statusCode).json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deployment failed';
      const isNotFound = message.includes('not found');
      const isUserError =
        isNotFound ||
        message.includes('No driver') ||
        message.includes('required') ||
        message.includes('Invalid');

      res.status(isNotFound ? 404 : isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Deployment failed',
      });
    }
  }

  /**
   * List deployments for application
   * GET /api/v1/deployments/applications/:id/deployments
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const applicationId = req.params.id;
      const { environmentId, status, page = '1', limit = '20' } = req.query;

      const where: any = {
        applicationId,
        tenantId: req.user.tenantId,
      };
      if (environmentId) where.environmentId = environmentId;
      if (status) where.status = status;

      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const [deployments, total] = await Promise.all([
        prisma.deployment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.deployment.count({ where }),
      ]);

      res.json({
        success: true,
        data: deployments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list deployments' });
    }
  }

  /**
   * Get deployment
   * GET /api/v1/deployments/deployments/:deploymentId
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const deployment = await prisma.deployment.findFirst({
        where: {
          id: req.params.deploymentId,
          tenantId: req.user.tenantId,
        },
      });

      if (!deployment) {
        res.status(404).json({ success: false, error: 'Deployment not found' });
        return;
      }

      res.json({ success: true, data: deployment });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get deployment' });
    }
  }

  /**
   * Rollback deployment
   * POST /api/v1/deployments/deployments/:deploymentId/rollback
   */
  async rollback(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const service = getDeploymentService();

      const result = await service.rollback(
        req.user.tenantId,
        req.params.deploymentId,
        req.user.userId
      );

      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rollback failed';
      const isNotFound = message.includes('not found');
      const isUserError = isNotFound || message.includes('No previous');

      res.status(isNotFound ? 404 : isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Rollback failed',
      });
    }
  }

  /**
   * Remove deployment
   * DELETE /api/v1/deployments/deployments/:deploymentId
   */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const service = getDeploymentService();
      await service.remove(req.user.tenantId, req.params.deploymentId);

      res.json({ success: true, message: 'Deployment removed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remove failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  }
    }
