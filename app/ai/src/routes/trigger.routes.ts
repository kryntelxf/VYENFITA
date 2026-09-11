/**
 * VYENFITA Trigger Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { TriggerController } from '../controllers/trigger.controller';
import { ApprovalController } from '../controllers/approval.controller';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createTriggerRouter(): Router {
  const router = Router();
  const triggerController = new TriggerController();
  const approvalController = new ApprovalController();

  // ============================================================
  // TRIGGERS (under /workflows)
  // ============================================================

  router.post(
    '/workflows/:id/triggers',
    PermissionMiddleware.require('workflow:update'),
    (req, res) => triggerController.register(req, res)
  );

  router.get(
    '/workflows/:id/triggers',
    PermissionMiddleware.require('workflow:read'),
    (req, res) => triggerController.list(req, res)
  );

  router.delete(
    '/workflows/triggers/:triggerId',
    PermissionMiddleware.require('workflow:update'),
    (req, res) => triggerController.unregister(req, res)
  );

  router.post(
    '/workflows/triggers/:triggerId/fire',
    PermissionMiddleware.require('workflow:execute'),
    (req, res) => triggerController.fire(req, res)
  );

  // ============================================================
  // APPROVALS
  // ============================================================

  router.get(
    '/approvals/pending',
    (req, res) => approvalController.listPending(req, res)
  );

  router.get(
    '/approvals/:approvalId',
    (req, res) => approvalController.get(req, res)
  );

  router.post(
    '/approvals/:approvalId/approve',
    (req, res) => approvalController.approve(req, res)
  );

  router.post(
    '/approvals/:approvalId/reject',
    (req, res) => approvalController.reject(req, res)
  );

  return router;
}
