/**
 * VYENFITA Webhook Controller
 * 
 * Handles webhook management operations
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { WebhookManager } from '../core/webhooks/webhook-manager';

const webhookManager = new WebhookManager();

export class WebhookController {
  /**
   * Register a webhook
   * POST /api/v1/webhooks/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, url, events, headers, retryConfig } = req.body;

      if (!name || !url || !events) {
        res.status(400).json({
          success: false,
          error: 'name, url, and events are required',
        });
        return;
      }

      const webhook = webhookManager.registerWebhook(name, url, events, headers, retryConfig);

      res.json({
        success: true,
        data: webhook,
        message: `Webhook ${webhook.name} registered successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all webhooks
   * GET /api/v1/webhooks
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const webhooks = webhookManager.getWebhooks();

      res.json({
        success: true,
        data: webhooks,
        count: webhooks.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a specific webhook
   * GET /api/v1/webhooks/:webhookId
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const webhook = webhookManager.getWebhook(webhookId);

      if (!webhook) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      res.json({
        success: true,
        data: webhook,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get delivery history
   * GET /api/v1/webhooks/deliveries
   */
  async getDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.query;
      const deliveries = webhookManager.getDeliveries(webhookId as string);

      res.json({
        success: true,
        data: deliveries,
        count: deliveries.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Enable a webhook
   * POST /api/v1/webhooks/:webhookId/enable
   */
  async enable(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const success = webhookManager.enableWebhook(webhookId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Webhook enabled successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Disable a webhook
   * POST /api/v1/webhooks/:webhookId/disable
   */
  async disable(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const success = webhookManager.disableWebhook(webhookId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Webhook disabled successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update webhook
   * PATCH /api/v1/webhooks/:webhookId
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const { name, url, events, headers, retryConfig } = req.body;

      const webhook = webhookManager.getWebhook(webhookId);
      if (!webhook) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      const updates: Partial<typeof webhook> = {};
      if (name) updates.name = name;
      if (url) updates.url = url;
      if (events) updates.events = events.map((event: any) => ({
        id: `evt-${Date.now()}`,
        type: event,
        timestamp: new Date(),
        data: {},
      }));
      if (headers) updates.headers = headers;
      if (retryConfig) updates.retryConfig = retryConfig;

      const success = webhookManager.updateWebhook(webhookId, updates);

      res.json({
        success: true,
        message: 'Webhook updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unregister a webhook
   * DELETE /api/v1/webhooks/:webhookId
   */
  async unregister(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const success = webhookManager.unregisterWebhook(webhookId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Webhook unregistered successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
