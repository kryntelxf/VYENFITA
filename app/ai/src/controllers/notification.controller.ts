/**
 * VYENFITA Notification Controller
 * 
 * Handles notification operations
 * - Send notifications
 * - Get notification status
 * - Get all notifications
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { NotificationService } from '../core/services/notification.service';

const notificationService = new NotificationService();

export class NotificationController {
  /**
   * Send notification
   * POST /api/v1/notifications/send
   */
  async send(req: Request, res: Response): Promise<void> {
    try {
      const { type, to, subject, message, data } = req.body;

      if (!type || !to || !message) {
        res.status(400).json({
          success: false,
          error: 'type, to, and message are required',
        });
        return;
      }

      const result = await notificationService.send({
        type,
        to,
        subject,
        message,
        data,
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
   * Get notification status
   * GET /api/v1/notifications/:id
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = notificationService.getStatus(id);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
        return;
      }

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
   * Get all notifications
   * GET /api/v1/notifications
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const result = notificationService.getAll();

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
          }
