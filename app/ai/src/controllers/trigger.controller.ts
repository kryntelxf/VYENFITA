/**
 * VYENFITA Trigger Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { getTriggerService } from '../lib/workflow/trigger.service';

export class TriggerController {
  /**
   * Register a trigger
   * POST /api/v1/workflows/:id/triggers
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { type, config, enabled } = req.body;
      const workflowId = req.params.id;

      if (!type || !config) {
        res.status(400).json({
          success: false,
          error: 'type and config are required',
        });
        return;
      }

      const triggerService = getTriggerService();
      const trigger = await triggerService.register({
        workflowId,
        tenantId: req.user.tenantId,
        type,
        config,
        enabled,
      });

      res.status(201).json({
        success: true,
        data: trigger,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register trigger';
      const isUserError =
        message.includes('not found') ||
        message.includes('Invalid') ||
        message.includes('requires') ||
        message.includes('Unknown');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to register trigger',
      });
    }
  }

  /**
   * List triggers for a workflow
   * GET /api/v1/workflows/:id/triggers
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const triggerService = getTriggerService();
      const triggers = await triggerService.listByWorkflow(
        req.params.id,
        req.user.tenantId
      );

      res.json({
        success: true,
        data: triggers,
        count: triggers.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * Unregister a trigger
   * DELETE /api/v1/workflows/triggers/:triggerId
   */
  async unregister(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const triggerService = getTriggerService();
      await triggerService.unregister(req.params.triggerId, req.user.tenantId);

      res.json({
        success: true,
        message: 'Trigger unregistered',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * Fire a trigger manually
   * POST /api/v1/workflows/triggers/:triggerId/fire
   */
  async fire(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const triggerService = getTriggerService();
      const result = await triggerService.fire(req.params.triggerId, {
        input: req.body?.input || {},
        triggerType: 'manual',
      });

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fire trigger';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
                   }
