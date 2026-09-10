/**
 * VYENFITA Token Service
 * 
 * JWT token generation & verification
 * - Access tokens (short-lived)
 * - Refresh tokens (long-lived)
 * - Token rotation
 * - Session tracking
 * 
 * @version 1.0.0
 */

import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface TokenPayload {
  userId: string;
  email: string;
  tenantId: string;
  roleId: string;
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET must be set and at least 32 characters long. ' +
    'Set a secure random string in environment variables.'
  );
}

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// Parse duration to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * multipliers[unit];
}

export class TokenService {
  /**
   * Generate access & refresh tokens
   */
  static generateTokenPair(payload: Omit<TokenPayload, 'sessionId'>): TokenPair & { sessionId: string } {
    const sessionId = uuidv4();

    const fullPayload: TokenPayload = {
      ...payload,
      sessionId,
    };

    const accessToken = jwt.sign(fullPayload, JWT_SECRET!, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'vyenfita',
      audience: 'vyenfita-api',
    });

    // Refresh token contains only sessionId for security
    const refreshToken = jwt.sign(
      { sessionId, userId: payload.userId },
      JWT_SECRET!,
      {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        issuer: 'vyenfita',
        audience: 'vyenfita-refresh',
      }
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
      expiresIn: parseDuration(ACCESS_TOKEN_EXPIRES_IN),
      refreshExpiresIn: parseDuration(REFRESH_TOKEN_EXPIRES_IN),
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET!, {
        issuer: 'vyenfita',
        audience: 'vyenfita-api',
      }) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): { sessionId: string; userId: string } {
    try {
      return jwt.verify(token, JWT_SECRET!, {
        issuer: 'vyenfita',
        audience: 'vyenfita-refresh',
      }) as { sessionId: string; userId: string };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Decode token without verification (for debugging only)
   */
  static decode(token: string): any {
    return jwt.decode(token);
  }
}
