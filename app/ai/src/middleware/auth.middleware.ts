/**
 * VYENFITA Authentication Middleware
 * 
 * Real authentication - NO BYPASS
 * - Verifies JWT
 * - Loads session
 * - Attaches user context
 * - Enforces tenant isolation
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { TokenService, TokenPayload } from '../lib/auth/token.service';
import { SessionService } from '../lib/auth/session.service';
import { auditService } from '../lib/audit/audit.service';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        tenantId: string;
        roleId: string;
        sessionId: string;
        permissions: string[];
      };
    }
  }
}

export class AuthMiddleware {
  /**
   * Validate authentication - strict mode
   * NO development bypass. NO exceptions.
   */
  static validate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();

    try {
      // Extract token
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        await auditService.log({
          eventType: 'security',
          action: 'auth_missing',
          resource: 'api',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          status: 'failure',
          errorMessage: 'Authorization header missing',
        });

        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_MISSING',
        });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
          success: false,
          error: 'Invalid authorization format. Use: Bearer <token>',
          code: 'AUTH_INVALID_FORMAT',
        });
        return;
      }

      const token = parts[1];

      // Verify JWT
      let payload: TokenPayload;
      try {
        payload = TokenService.verifyAccessToken(token);
      } catch (error) {
        await auditService.log({
          eventType: 'security',
          action: 'auth_invalid_token',
          resource: 'api',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          status: 'failure',
          errorMessage: error instanceof Error ? error.message : 'Token verification failed',
        });

        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'AUTH_INVALID_TOKEN',
        });
        return;
      }

      // Validate session (check revocation, expiry, user status)
      const sessionValidation = await SessionService.validate(token);

      if (!sessionValidation.valid) {
        await auditService.log({
          eventType: 'security',
          action: 'auth_session_invalid',
          resource: 'api',
          userId: payload.userId,
          tenantId: payload.tenantId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          status: 'failure',
          errorMessage: sessionValidation.reason,
        });

        res.status(401).json({
          success: false,
          error: sessionValidation.reason || 'Session invalid',
          code: 'AUTH_SESSION_INVALID',
        });
        return;
      }

      const session = sessionValidation.session!;

      // Find membership for the payload tenant
      const membership = session.user.memberships.find(
        (m: any) => m.tenantId === payload.tenantId && m.status === 'active'
      );

      if (!membership) {
        await auditService.log({
          eventType: 'security',
          action: 'auth_tenant_mismatch',
          resource: 'api',
          userId: payload.userId,
          tenantId: payload.tenantId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          status: 'failure',
          errorMessage: 'User is not an active member of this tenant',
        });

        res.status(403).json({
          success: false,
          error: 'Access denied: not a member of this tenant',
          code: 'AUTH_TENANT_DENIED',
        });
        return;
      }

      if (membership.tenant.deletedAt || membership.tenant.status !== 'active') {
        res.status(403).json({
          success: false,
          error: 'Access denied: tenant is not active',
          code: 'AUTH_TENANT_INACTIVE',
        });
        return;
      }

      // Load permissions
      const permissionRecords = await require('../database/client').prisma.rolePermission.findMany({
        where: { roleId: membership.roleId },
        include: { permission: true },
      });

      const permissions = permissionRecords.map(
        (rp: any) => `${rp.permission.resource}:${rp.permission.action}`
      );

      // Attach user context to request
      req.user = {
        userId: payload.userId,
        email: payload.email,
        tenantId: payload.tenantId,
        roleId: payload.roleId,
        sessionId: payload.sessionId,
        permissions,
      };

      next();
    } catch (error) {
      await auditService.log({
        eventType: 'security',
        action: 'auth_error',
        resource: 'api',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Authentication error',
        code: 'AUTH_ERROR',
      });
    }
  };
}
