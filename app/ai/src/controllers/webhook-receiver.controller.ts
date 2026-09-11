/**
 * VYENFITA Webhook Receiver
 * 
 * Receives inbound webhooks and fires matching triggers.
 * Verifies HMAC signature to prevent forgery.
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { getTriggerService } from '../lib/workflow/trigger.service';
import { logger } from '../lib/observability/logger';
import { auditService } from '../lib/audit/audit.service';

export class WebhookReceiverController {
  /**
   * Receive webhook
   * ALL /api/v1/webhooks/inbound/*
   */
  async receive(req: Request, res: Response): Promise<void> {
    try {
      const path = req.path;
      const method = req.method;

      const triggerService = getTriggerService();
      const trigger = await triggerService.findByWebhookPath(path);

      if (!trigger) {
        res.status(404).json({
          success: false,
          error: 'No trigger matches this webhook path',
        });
        return;
      }

      const config = trigger.config as any;

      // Verify method
      if (config.method !== method) {
        res.status(405).json({
          success: false,
          error: `Method not allowed: expected ${config.method}`,
        });
        return;
      }

      // Verify signature
      const signature = req.headers['x-vyenfita-signature'] as string;
      if (!signature) {
        res.status(401).json({
          success: false,
          error: 'Missing signature header',
        });
        return;
      }

      const payload = JSON.stringify(req.body);
      const expectedSignature = createHmac('sha256', config.secret)
        .update(payload)
        .digest('hex');

      const signatureValid = this.safeCompare(signature, expectedSignature);

      if (!signatureValid) {
        await auditService.log({
          tenantId: trigger.tenantId,
          eventType: 'security',
          action: 'webhook.signature_invalid',
          resource: 'trigger',
          resourceId: trigger.id,
          ipAddress: req.ip,
          details: { path },
          status: 'failure',
        });

        res.status(401).json({
          success: false,
          error: 'Invalid signature',
        });
        return;
      }

      // Check optional required headers
      if (config.headers) {
        for (const [key, value] of Object.entries(config.headers)) {
          if (req.headers[key.toLowerCase()] !== value) {
            res.status(401).json({
              success: false,
              error: `Missing or invalid header: ${key}`,
            });
            return;
          }
        }
      }

      // Fire the trigger
      const result = await triggerService.fire(trigger.id, {
        input: req.body,
        triggerType: 'webhook',
      });

      res.json({
        success: result.success,
        data: {
          executionId: result.executionId,
          durationMs: result.durationMs,
        },
        error: result.error,
      });
    } catch (error) {
      logger.error('Webhook receive error', {
        path: req.path,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
      });
    }
  }

  /**
   * Timing-safe comparison
   */
  private safeCompare(a: string, b: string): boolean {
    try {
      const aBuf = Buffer.from(a, 'utf8');
      const bBuf = Buffer.from(b, 'utf8');

      if (aBuf.length !== bBuf.length) {
        // Still do a comparison to avoid timing leak
        timingSafeEqual(aBuf, aBuf);
        return false;
      }

      return timingSafeEqual(aBuf, bBuf);
    } catch {
      return false;
    }
  }
               }
