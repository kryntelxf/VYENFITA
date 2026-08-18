import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware for VYENFITA AI Service
 * Validates API keys from Authorization header
 */
export class AuthMiddleware {
  private static validKeys: Set<string> = new Set();

  /**
   * Initialize with valid API keys
   */
  static initialize(keys: string[]): void {
    this.validKeys = new Set(keys);
  }

  /**
   * Middleware to validate authentication
   */
  static validate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Authorization header required',
      });
      return;
    }

    // Bearer token format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: 'Invalid authorization format. Expected: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // In development mode, allow any token if no keys configured
    if (process.env.NODE_ENV === 'development' && this.validKeys.size === 0) {
      console.warn('⚠️  AI Service running in development mode without authentication');
      next();
      return;
    }

    if (!this.validKeys.has(token)) {
      res.status(403).json({
        error: 'Invalid API key',
      });
      return;
    }

    next();
  }
}
