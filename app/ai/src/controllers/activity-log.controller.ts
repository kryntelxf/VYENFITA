/**
 * VYENFITA Activity Log Controller
 * 
 * Handles activity log operations
 * - Log activities
 * - Get logs by user/tenant/action
 * - Get statistics
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { ActivityLogService } from '../core/services/activity-log.service';

const activityLogService = new ActivityLogService();

export class ActivityLogController {
  /**
   * Log an activity
   * POST /api/v1/activity-logs/log
   */
  async log(req: Request, res: Response): Promise<void> {
    try {
      const { userId, tenantId, action, resource, resourceId, details, status, error } = req.body;

      if (!userId || !tenantId || !action || !resource) {
        res.status(400).json({
          success: false,
          error: 'userId, tenantId, action, and resource are required',
        });
        return;
      }

      const result = activityLogService.log({
        userId,
        tenantId,
        action,
        resource,
        resourceId,
        details: details || {},
        status: status || 'success',
        error,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get logs by user
   * GET /api/v1/activity-logs/user/:userId
   */
  async getByUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const result = activityLogService.getByUser(userId);

      res.json({
        success: true,
        data: result,
        count: result.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get logs by tenant
   * GET /api/v1/activity-logs/tenant/:tenantId
   */
  async getByTenant(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;

      const result = activityLogService.getByTenant(tenantId);

      res.json({
        success: true,
        data: result,
        count: result.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get logs by action
   * GET /api/v1/activity-logs/action/:action
   */
  async getByAction(req: Request, res: Response): Promise<void> {
    try {
      const { action } = req.params;

      const result = activityLogService.getByAction(action);

      res.json({
        success: true,
        data: result,
        count: result.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get recent logs
   * GET /api/v1/activity-logs/recent
   */
  async getRecent(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;

      const result = activityLogService.getRecent(limit);

      res.json({
        success: true,
        data: result,
        count: result.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get statistics
   * GET /api/v1/activity-logs/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.query;

      const stats = activityLogService.getStats(tenantId as string);

      res.json({
        success: true,
        data: {
          ...stats,
          uniqueUsers: stats.uniqueUsers.size,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Clear old logs
   * POST /api/v1/activity-logs/clear
   */
  async clearOldLogs(req: Request, res: Response): Promise<void> {
    try {
      const { maxAgeMs } = req.body;

      const count = activityLogService.clearOldLogs(maxAgeMs || 30 * 24 * 60 * 60 * 1000);

      res.json({
        success: true,
        message: `Cleared ${count} old logs`,
        count,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
  }
