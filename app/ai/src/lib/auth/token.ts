import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-at-least-32-characters-long-for-codespaces';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const m: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(match[1], 10) * m[match[2]];
}

export class TokenService {
  static generateTokenPair(payload: any, sessionId?: string) {
    const finalSessionId = sessionId || require('crypto').randomUUID();
    const fullPayload = { ...payload, sessionId: finalSessionId };
    
    const accessToken = jwt.sign(fullPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN } as jwt.SignOptions);
    const refreshToken = jwt.sign({ sessionId: finalSessionId, userId: payload.userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN } as jwt.SignOptions);
    
    return { accessToken, refreshToken, sessionId: finalSessionId, expiresIn: parseDuration(ACCESS_TOKEN_EXPIRES_IN) };
  }

  static verifyAccessToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
                           }
