/**
 * VYENFITA Webhook Routes
 * 
 * Inbound webhooks (public, but HMAC-verified)
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { WebhookReceiverController } from '../controllers/webhook-receiver.controller';

export function createWebhookReceiverRouter(): Router {
  const router = Router();
  const controller = new WebhookReceiverController();

  // All methods and paths under /webhooks/inbound/* handled by receiver
  router.all('/inbound/*', (req, res) => controller.receive(req, res));

  return router;
}
