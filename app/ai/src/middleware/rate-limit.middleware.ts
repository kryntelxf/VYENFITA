/**
 * VYENFITA Rate Limit Middleware
 * 
 * Multi-dimensional rate limiting:
 * - Per IP
 * - Per user (when authenticated)
 * - Per tenant
 * - Per endpoint
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export class RateLimitMiddleware {
  private stores: Map<string, Map<string, RateLimitEntry>> = new Map();

  /**
   * Create a rate limiter for a specific dimension
   */
  create(config: RateLimitConfig, dimension: 'ip' | 'user' | 'tenant' | 'user-tenant' = 'ip') {
    const storeName = `dimension-${dimension}`;

    if (!this.stores.has(storeName)) {
      this.stores.set(storeName, new Map());
    }

    const store = this.stores.get(storeName)!;

    // Cleanup expired entries periodically
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (entry.resetAt < now) {
          store.delete(key);
        }
      }
    }, config.windowMs).unref?.();

    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getKey(req, dimension);

      if (!key) {
        // Cannot determine key — fail open (or fail closed based on policy)
        next();
        return;
      }

      const now = Date.now();
      let entry = store.get(key);

      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + config.windowMs };
        store.set(key, entry);
      }

      entry.count++;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - entry.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

      if (entry.count > config.max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter);

        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter,
        });
        return;
      }

      next();
    };
  }

  /**
   * Predefined limiters for common use cases
   */
  authLimiter() {
    return this.create({ windowMs: 15 * 60 * 1000, max: 10 }, 'ip');
  }

  aiLimiter() {
    return this.create({ windowMs: 60 * 1000, max: 60 }, 'user-tenant');
  }

  writeLimiter() {
    return this.create({ windowMs: 60 * 1000, max: 100 }, 'tenant');
  }

  generalLimiter() {
    return this.create({ windowMs: 60 * 1000, max: 300 }, 'ip');
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private getKey(req: Request, dimension: string): string | undefined {
    switch (dimension) {
      case 'ip':
        return req.ip;
      case 'user':
        return req.user?.userId;
      case 'tenant':
        return req.user?.tenantId;
      case 'user-tenant':
        if (req.user) {
          return `${req.user.tenantId}:${req.user.userId}`;
        }
        return req.ip;
      default:
        return req.ip;
    }
  }
}

export const rateLimiter = new RateLimitMiddleware();
