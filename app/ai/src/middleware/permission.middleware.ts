/**
 * VYENFITA Permission Middleware
 * 
 * Server-side permission enforcement
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';

export class PermissionMiddleware {
  /**
   * Require a specific permission
   * Format: "resource:action" e.g. "application:create"
   */
  static require(permission: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'PERM_NO_USER',
        });
        return;
      }

      const { permissions } = req.user;

      // Wildcard permission
      if (permissions.includes('*:manage')) {
        return next();
      }

      // Exact permission
      if (permissions.includes(permission)) {
        return next();
      }

      res.status(403).json({
        success: false,
        error: `Permission denied: ${permission} required`,
        code: 'PERM_DENIED',
      });
    };
  }

  /**
   * Require ANY of the given permissions
   */
  static requireAny(permissions: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'PERM_NO_USER',
        });
        return;
      }

      const { permissions: userPerms } = req.user;

      if (userPerms.includes('*:manage')) {
        return next();
      }

      const hasAny = permissions.some((p) => userPerms.includes(p));
      if (hasAny) {
        return next();
      }

      res.status(403).json({
        success: false,
        error: `Permission denied: one of [${permissions.join(', ')}] required`,
        code: 'PERM_DENIED',
      });
    };
  }

  /**
   * Require ALL of the given permissions
   */
  static requireAll(permissions: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'PERM_NO_USER',
        });
        return;
      }

      const { permissions: userPerms } = req.user;

      if (userPerms.includes('*:manage')) {
        return next();
      }

      const hasAll = permissions.every((p) => userPerms.includes(p));
      if (hasAll) {
        return next();
      }

      res.status(403).json({
        success: false,
        error: `Permission denied: [${permissions.join(', ')}] required`,
        code: 'PERM_DENIED',
      });
    };
  }
        }
