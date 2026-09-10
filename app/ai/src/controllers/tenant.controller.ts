/**
 * VYENFITA Tenant Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { TenantService } from '../lib/tenant/tenant.service';

export class TenantController {
  /**
   * GET /api/v1/tenant
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const tenant = await TenantService.getById(req.user.tenantId);

      res.json({ success: true, data: tenant });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * PUT /api/v1/tenant
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { name, description, settings } = req.body;

      const tenant = await TenantService.update({
        tenantId: req.user.tenantId,
        actorUserId: req.user.userId,
        name,
        description,
        settings,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: tenant });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * GET /api/v1/tenant/stats
   */
  async stats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const stats = await TenantService.getStats(req.user.tenantId);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
  }

  /**
   * GET /api/v1/tenant/members
   */
  async listMembers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const members = await TenantService.listMembers(req.user.tenantId);

      const sanitized = members.map((m: any) => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        roleId: m.roleId,
        roleName: m.role.name,
        status: m.status,
        joinedAt: m.joinedAt,
      }));

      res.json({ success: true, data: sanitized, count: sanitized.length });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list members' });
    }
  }

  /**
   * POST /api/v1/tenant/members/invite
   */
  async inviteMember(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { email, roleId } = req.body;

      if (!email || !roleId) {
        res.status(400).json({
          success: false,
          error: 'email and roleId are required',
        });
        return;
      }

      const result = await TenantService.inviteMember({
        tenantId: req.user.tenantId,
        invitedByUserId: req.user.userId,
        email,
        roleId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError =
        message.includes('already') ||
        message.includes('Invalid') ||
        message.includes('not found') ||
        message.includes('does not belong');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to invite member',
      });
    }
  }

  /**
   * PUT /api/v1/tenant/members/:userId/role
   */
  async updateMemberRole(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { roleId } = req.body;
      if (!roleId) {
        res.status(400).json({ success: false, error: 'roleId is required' });
        return;
      }

      const updated = await TenantService.updateMemberRole({
        tenantId: req.user.tenantId,
        actorUserId: req.user.userId,
        targetUserId: req.params.userId,
        roleId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError = message.includes('not found') || message.includes('Cannot');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to update role',
      });
    }
  }

  /**
   * DELETE /api/v1/tenant/members/:userId
   */
  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await TenantService.removeMember(
        req.user.tenantId,
        req.user.userId,
        req.params.userId,
        req.ip,
        req.headers['user-agent']
      );

      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError = message.includes('not found') || message.includes('Cannot');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to remove member',
      });
    }
  }

  /**
   * GET /api/v1/tenant/roles
   */
  async listRoles(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const roles = await TenantService.listRoles(req.user.tenantId);
      res.json({ success: true, data: roles, count: roles.length });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list roles' });
    }
  }

  /**
   * GET /api/v1/tenant/permissions
   */
  async listPermissions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const permissions = await TenantService.listPermissions();
      res.json({ success: true, data: permissions, count: permissions.length });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list permissions' });
    }
  }

  /**
   * POST /api/v1/tenant/roles
   */
  async createRole(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { name, description, permissions } = req.body;

      if (!name || !Array.isArray(permissions)) {
        res.status(400).json({
          success: false,
          error: 'name and permissions[] are required',
        });
        return;
      }

      const role = await TenantService.createRole(
        req.user.tenantId,
        req.user.userId,
        name,
        description || '',
        permissions,
        req.ip,
        req.headers['user-agent']
      );

      res.status(201).json({ success: true, data: role });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError =
        message.includes('reserved') ||
        message.includes('already exists') ||
        message.includes('Invalid') ||
        message.includes('must be');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to create role',
      });
    }
  }

  /**
   * DELETE /api/v1/tenant/roles/:roleId
   */
  async deleteRole(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await TenantService.deleteRole(
        req.user.tenantId,
        req.user.userId,
        req.params.roleId,
        req.ip,
        req.headers['user-agent']
      );

      res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError =
        message.includes('not found') ||
        message.includes('Cannot') ||
        message.includes('does not belong');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to delete role',
      });
    }
  }
  }
