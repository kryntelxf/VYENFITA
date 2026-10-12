/**
 * VYENFITA GDPR Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { DataExportService } from '../lib/gdpr/data-export.service';
import { DataDeletionService } from '../lib/gdpr/data-deletion.service';

export class GDPRController {
  /**
   * Export current user's data
   * GET /api/v1/users/me/export
   */
  async exportMyData(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const data = await DataExportService.exportUserData(
        req.user.userId,
        req.user.tenantId
      );

      const filename = `vyenfita-user-export-${req.user.userId.substring(
        0,
        8
      )}-${Date.now()}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      const isUserError =
        message.includes('not found') || message.includes('not a member');

      res.status(isUserError ? 403 : 500).json({
        success: false,
        error: isUserError ? message : 'Export failed',
      });
    }
  }

  /**
   * Export current tenant's data (admin only)
   * GET /api/v1/tenants/me/export
   */
  async exportMyTenant(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const includeLarge = req.query.include === 'large';

      const data = await DataExportService.exportTenantData(
        req.user.tenantId,
        req.user.userId,
        { includeLarge }
      );

      const filename = `vyenfita-tenant-export-${req.user.tenantId.substring(
        0,
        8
      )}-${Date.now()}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      const isNotFound = message.includes('not found');
      const isForbidden =
        message.includes('administrators') || message.includes('not a member');

      res.status(isNotFound ? 404 : isForbidden ? 403 : 500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * Request account deletion
   * DELETE /api/v1/users/me
   */
  async deleteMyAccount(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { confirmEmail, reason } = req.body;

      if (!confirmEmail || typeof confirmEmail !== 'string') {
        res.status(400).json({
          success: false,
          error: 'confirmEmail is required',
        });
        return;
      }

      const result = await DataDeletionService.requestUserDeletion(
        req.user.userId,
        req.user.tenantId,
        { confirmEmail, reason }
      );

      res.status(202).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Deletion request failed';
      const isUserError =
        message.includes('not found') ||
        message.includes('does not match') ||
        message.includes('sole owner');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Deletion request failed',
      });
    }
  }

  /**
   * Cancel a pending deletion
   * POST /api/v1/users/me/deletion/cancel
   */
  async cancelMyDeletion(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const result = await DataDeletionService.cancelUserDeletion(
        req.user.userId,
        req.user.tenantId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cancel failed';
      res.status(message.includes('No pending') ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  }
  }
