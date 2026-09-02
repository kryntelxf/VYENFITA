/**
 * VYENFITA Enterprise Controller
 * 
 * Handles enterprise features:
 * - SSO
 * - Audit Trail
 * - Advanced RBAC
 * - Application Analytics
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { EnterpriseSSOService } from '../core/services/enterprise-sso.service';
import { AuditTrailService } from '../core/services/audit-trail.service';
import { AdvancedRBACService } from '../core/services/advanced-rbac.service';
import { ApplicationAnalyticsService } from '../core/services/application-analytics.service';

const ssoService = new EnterpriseSSOService();
const auditService = new AuditTrailService();
const rbacService = new AdvancedRBACService();
const analyticsService = new ApplicationAnalyticsService();

export class EnterpriseController {
  // ============================================================
  // SSO
  // ============================================================

  /**
   * Get SSO providers
   * GET /api/v1/enterprise/sso/providers
   */
  async getSSOProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers = ssoService.getProviders();

      res.json({
        success: true,
        data: providers,
        count: providers.length,
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
   * Get SSO authorization URL
   * GET /api/v1/enterprise/sso/auth/:providerId
   */
  async getAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const { providerId } = req.params;
      const { redirectUri, state } = req.query;

      if (!redirectUri) {
        res.status(400).json({
          success: false,
          error: 'redirectUri is required',
        });
        return;
      }

      const url = ssoService.getAuthorizationUrl(
        providerId,
        redirectUri as string,
        state as string || 'default'
      );

      res.json({
        success: true,
        data: { url },
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
   * Handle SSO callback
   * POST /api/v1/enterprise/sso/callback
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { providerId, code, redirectUri } = req.body;

      if (!providerId || !code || !redirectUri) {
        res.status(400).json({
          success: false,
          error: 'providerId, code, and redirectUri are required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await ssoService.handleCallback(
        providerId,
        code,
        redirectUri,
        ipAddress,
        userAgent
      );

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

  // ============================================================
  // AUDIT TRAIL
  // ============================================================

  /**
   * Get audit events
   * GET /api/v1/enterprise/audit/events
   */
  async getAuditEvents(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, userId, eventType, status, resource, limit, offset, startDate, endDate } = req.query;

      const result = auditService.getEvents({
        tenantId: tenantId as string,
        userId: userId as string,
        eventType: eventType as any,
        status: status as any,
        resource: resource as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: result.events,
        total: result.total,
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
   * Get audit summary
   * GET /api/v1/enterprise/audit/summary
   */
  async getAuditSummary(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, startDate, endDate } = req.query;

      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: 'tenantId is required',
        });
        return;
      }

      const summary = auditService.getSummary(
        tenantId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: summary,
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
   * Get security summary
   * GET /api/v1/enterprise/audit/security
   */
  async getSecuritySummary(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, days } = req.query;

      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: 'tenantId is required',
        });
        return;
      }

      const summary = auditService.getSecuritySummary(
        tenantId as string,
        days ? parseInt(days as string) : 30
      );

      res.json({
        success: true,
        data: summary,
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

  // ============================================================
  // RBAC
  // ============================================================

  /**
   * Get roles
   * GET /api/v1/enterprise/rbac/roles
   */
  async getRoles(req: Request, res: Response): Promise<void> {
    try {
      const roles = rbacService.getRoles();

      res.json({
        success: true,
        data: roles,
        count: roles.length,
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
   * Create a role
   * POST /api/v1/enterprise/rbac/roles
   */
  async createRole(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, permissions, hierarchy, isDefault } = req.body;

      if (!name || !permissions) {
        res.status(400).json({
          success: false,
          error: 'name and permissions are required',
        });
        return;
      }

      const role = rbacService.createRole(name, description, permissions, hierarchy, isDefault);

      res.json({
        success: true,
        data: role,
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
   * Update a role
   * PUT /api/v1/enterprise/rbac/roles/:roleId
   */
  async updateRole(req: Request, res: Response): Promise<void> {
    try {
      const { roleId } = req.params;
      const updates = req.body;

      const role = rbacService.updateRole(roleId, updates);

      if (!role) {
        res.status(404).json({
          success: false,
          error: 'Role not found',
        });
        return;
      }

      res.json({
        success: true,
        data: role,
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
   * Delete a role
   * DELETE /api/v1/enterprise/rbac/roles/:roleId
   */
  async deleteRole(req: Request, res: Response): Promise<void> {
    try {
      const { roleId } = req.params;

      const success = rbacService.deleteRole(roleId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Role not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Role deleted successfully',
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
   * Check permission
   * POST /api/v1/enterprise/rbac/check
   */
  async checkPermission(req: Request, res: Response): Promise<void> {
    try {
      const { userRoles, resource, action, attributes } = req.body;

      if (!userRoles || !resource || !action) {
        res.status(400).json({
          success: false,
          error: 'userRoles, resource, and action are required',
        });
        return;
      }

      const result = rbacService.hasPermission(userRoles, resource, action, attributes);

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

  // ============================================================
  // APPLICATION ANALYTICS
  // ============================================================

  /**
   * Record an event
   * POST /api/v1/enterprise/analytics/event
   */
  async recordEvent(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId, tenantId, userId, sessionId, type, data, duration, error } = req.body;

      if (!applicationId || !tenantId || !userId || !sessionId || !type) {
        res.status(400).json({
          success: false,
          error: 'applicationId, tenantId, userId, sessionId, and type are required',
        });
        return;
      }

      const event = analyticsService.recordEvent(
        applicationId,
        tenantId,
        userId,
        sessionId,
        type,
        data || {},
        duration,
        error
      );

      res.json({
        success: true,
        data: event,
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
   * Get application analytics
   * GET /api/v1/enterprise/analytics/applications/:applicationId
   */
  async getAppAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId } = req.params;
      const { date } = req.query;

      const analytics = analyticsService.getAnalytics(
        applicationId,
        date ? new Date(date as string) : undefined
      );

      res.json({
        success: true,
        data: analytics,
        count: analytics.length,
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
   * Get tenant analytics
   * GET /api/v1/enterprise/analytics/tenants/:tenantId
   */
  async getTenantAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;

      const analytics = analyticsService.getTenantAnalytics(tenantId);

      res.json({
        success: true,
        data: analytics,
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
   * Get user journey
   * GET /api/v1/enterprise/analytics/applications/:applicationId/journey/:userId
   */
  async getUserJourney(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId, userId } = req.params;
      const { limit } = req.query;

      const journey = analyticsService.getUserJourney(
        applicationId,
        userId,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        success: true,
        data: journey,
        count: journey.length,
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
