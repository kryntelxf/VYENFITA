/**
 * VYENFITA Approval Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { getApprovalService } from '../lib/workflow/approval.service';

export class ApprovalController {
  /**
   * List pending approvals for the current user
   * GET /api/v1/approvals/pending
   */
  async listPending(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const approvalService = getApprovalService();
      const pending = await approvalService.listPendingForUser(
        req.user.userId,
        req.user.tenantId
      );

      res.json({
        success: true,
        data: pending,
        count: pending.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  /**
   * Get approval details
   * GET /api/v1/approvals/:approvalId
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const approvalService = getApprovalService();
      const approval = await approvalService.get(
        req.params.approvalId,
        req.user.tenantId
      );

      if (!approval) {
        res.status(404).json({
          success: false,
          error: 'Approval not found',
        });
        return;
      }

      res.json({
        success: true,
        data: approval,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  /**
   * Approve
   * POST /api/v1/approvals/:approvalId/approve
   */
  async approve(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { response } = req.body;

      const approvalService = getApprovalService();
      const approval = await approvalService.approve(
        req.params.approvalId,
        req.user.userId,
        req.user.tenantId,
        response
      );

      res.json({
        success: true,
        data: approval,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError =
        message.includes('not found') ||
        message.includes('Cannot') ||
        message.includes('not an approver') ||
        message.includes('expired');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to approve',
      });
    }
  }

  /**
   * Reject
   * POST /api/v1/approvals/:approvalId/reject
   */
  async reject(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { response } = req.body;

      const approvalService = getApprovalService();
      const approval = await approvalService.reject(
        req.params.approvalId,
        req.user.userId,
        req.user.tenantId,
        response
      );

      res.json({
        success: true,
        data: approval,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError =
        message.includes('not found') ||
        message.includes('Cannot') ||
        message.includes('not an approver');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to reject',
      });
    }
  }
          }
