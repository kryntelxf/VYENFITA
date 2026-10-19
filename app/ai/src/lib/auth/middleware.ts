/**
 * VYENFITA Auth Middleware (Minimal)
 *
 * Verifies JWT and attaches tenant/user context to req.user.
 *
 * @version 1.0.0
 */

import { NextFunction, Request, Response } from 'express';
import { TokenService } from './token';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        tenantId: string;
        sessionId: string;
      };
    }
  }
}

/**
 * Middleware: verify Bearer token, populate req.user.
 * Rejects 401 if token invalid.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = TokenService.verifyAccessToken(token);

    const headerTenant = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenant && headerTenant !== payload.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'X-Tenant-Id does not match token',
      });
    }

    req.user = {
      userId: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      sessionId: payload.sessionId,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid token',
    });
  }
      }
