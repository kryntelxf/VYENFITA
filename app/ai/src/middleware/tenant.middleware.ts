/**
 * VYENFITA Tenant Isolation Middleware
 * 
 * Enforces tenant isolation on all requests
 * - Validates tenant context
 * - Prevents cross-tenant access
 * - Attaches tenant scope
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Ensure a tenant context exists. Must be called AFTER AuthMiddleware.validate.
 */
export class TenantMiddleware {
  static enforce = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'TENANT_NO_USER',
      });
      return;
    }

    if (!req.user.tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant context required',
        code: 'TENANT_MISSING',
      });
      return;
    }

    // Optional: allow X-Tenant-Id header override ONLY if it matches user's tenant
    const headerTenant = req.headers['x-tenant-id'] as string | undefined;

    if (headerTenant && headerTenant !== req.user.tenantId) {
      res.status(403).json({
        success: false,
        error: 'Cross-tenant access denied',
        code: 'TENANT_CROSS_ACCESS',
      });
      return;
    }

    next();
  };
}
