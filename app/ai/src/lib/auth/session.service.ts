/**
 * VYENFITA Session Service
 * 
 * Manages user sessions in database
 * - Create session
 * - Validate session
 * - Revoke session
 * - Cleanup expired sessions
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { TokenService } from './token.service';

export interface CreateSessionInput {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class SessionService {
  /**
   * Create a new session
   */
  static async create(input: CreateSessionInput): Promise<any> {
    return prisma.session.create({
      data: {
        userId: input.userId,
        token: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  /**
   * Find session by token
   */
  static async findByToken(token: string): Promise<any | null> {
    return prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                role: true,
                tenant: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Validate session is active
   */
  static async validate(token: string): Promise<{
    valid: boolean;
    session?: any;
    reason?: string;
  }> {
    const session = await this.findByToken(token);

    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (session.revokedAt) {
      return { valid: false, reason: 'Session revoked' };
    }

    if (new Date() > session.expiresAt) {
      return { valid: false, reason: 'Session expired' };
    }

    if (session.user.deletedAt) {
      return { valid: false, reason: 'User deleted' };
    }

    if (session.user.status !== 'active') {
      return { valid: false, reason: 'User not active' };
    }

    return { valid: true, session };
  }

  /**
   * Revoke a session
   */
  static async revoke(token: string): Promise<void> {
    await prisma.session.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all sessions for a user
   */
  static async revokeAllForUser(userId: string): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpired(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    return result.count;
  }

  /**
   * Get active sessions for user
   */
  static async getActiveForUser(userId: string): Promise<any[]> {
    return prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
