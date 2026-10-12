/**
 * VYENFITA GDPR Data Deletion Service
 * 
 * Implements GDPR Article 17 (right to erasure):
 * Users can request deletion of their personal data.
 * 
 * Design:
 * - Immediate soft-delete (user.status = 'deleted', deletedAt = now)
 * - Scheduled hard-delete after grace period (30 days)
 * - Hard-delete anonymizes PII but preserves audit trail
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { DeleteUserRequest, DeleteUserResult } from './gdpr.types';
import { DELETION_GRACE_PERIOD_DAYS } from './gdpr.constants';

export class DataDeletionService {
  /**
   * Request deletion of a user account.
   */
  static async requestUserDeletion(
    userId: string,
    tenantId: string,
    request: DeleteUserRequest
  ): Promise<DeleteUserResult> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.email.toLowerCase() !== request.confirmEmail.toLowerCase()) {
      throw new Error('Email confirmation does not match');
    }

    const ownedTenants = await prisma.membership.findMany({
      where: {
        userId,
        tenantId,
        deletedAt: null,
        role: { name: 'Owner' },
      },
      include: { tenant: true },
    });

    if (ownedTenants.length > 0) {
      for (const ownedMembership of ownedTenants) {
        const memberCount = await prisma.membership.count({
          where: {
            tenantId: ownedMembership.tenantId,
            deletedAt: null,
          },
        });

        if (memberCount === 1) {
          throw new Error(
            'Cannot delete account: you are the sole owner of a tenant. ' +
              'Please transfer ownership or delete the tenant first.'
          );
        }
      }
    }

    const scheduledDeletionAt = new Date(
      Date.now() + DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'deleted',
          deletedAt: new Date(),
          metadata: {
            ...(((user as any).metadata as Record<string, any>) || {}),
            deletionRequestedAt: new Date().toISOString(),
            deletionReason: request.reason || null,
            scheduledHardDeleteAt: scheduledDeletionAt.toISOString(),
          },
        },
      });

      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await auditService.log({
      tenantId,
      userId,
      eventType: 'delete',
      action: 'gdpr.user_deletion_requested',
      resource: 'user',
      resourceId: userId,
      details: {
        reason: request.reason || null,
        scheduledHardDeleteAt: scheduledDeletionAt.toISOString(),
        gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
      },
      status: 'success',
    });

    logger.info('User deletion requested', {
      userId,
      tenantId,
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
    });

    return {
      success: true,
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
      message:
        `Your account has been scheduled for deletion on ${scheduledDeletionAt
          .toISOString()
          .split('T')[0]}. ` +
        `You have ${DELETION_GRACE_PERIOD_DAYS} days to cancel this request by logging in again.`,
    };
  }

  /**
   * Cancel a pending deletion request.
   */
  static async cancelUserDeletion(
    userId: string,
    tenantId: string
  ): Promise<{ success: boolean; message: string }> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: { not: null } },
    });

    if (!user) {
      throw new Error('No pending deletion request found for this user');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'active',
        deletedAt: null,
        metadata: {
          ...(((user as any).metadata as Record<string, any>) || {}),
          deletionCancelledAt: new Date().toISOString(),
        },
      },
    });

    await auditService.log({
      tenantId,
      userId,
      eventType: 'modify',
      action: 'gdpr.user_deletion_cancelled',
      resource: 'user',
      resourceId: userId,
      status: 'success',
    });

    return {
      success: true,
      message: 'Account deletion has been cancelled. Your account is now active.',
    };
  }

  /**
   * Permanently delete users whose grace period has expired.
   */
  static async processExpiredDeletions(): Promise<{
    processed: number;
    anonymized: string[];
    errors: string[];
  }> {
    const expiredUsers = await prisma.user.findMany({
      where: {
        status: 'deleted',
        deletedAt: {
          not: null,
          lte: new Date(
            Date.now() - DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
          ),
        },
      },
    });

    const anonymized: string[] = [];
    const errors: string[] = [];

    for (const user of expiredUsers) {
      try {
        await this.anonymizeUser(user.id, user.email);
        anonymized.push(user.id);
      } catch (error) {
        errors.push(
          `${user.id}: ${error instanceof Error ? error.message : 'unknown'}`
        );
        logger.error('Failed to anonymize user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    return {
      processed: expiredUsers.length,
      anonymized,
      errors,
    };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static async anonymizeUser(
    userId: string,
    originalEmail: string
  ): Promise<void> {
    const anonymizedEmail = `deleted-${userId.substring(
      0,
      8
    )}@deleted.vyenfita.local`;
    const anonymizedUserAgent = 'anonymized';

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          passwordHash: null,
          name: null,
          avatarUrl: null,
          ssoProviderId: null,
          metadata: {
            anonymizedAt: new Date().toISOString(),
            originalEmailHash: this.hashEmail(originalEmail),
          },
        },
      });

      await tx.session.updateMany({
        where: { userId },
        data: {
          ipAddress: null,
          userAgent: anonymizedUserAgent,
        },
      });

      await tx.auditEvent.updateMany({
        where: { userId },
        data: {
          ipAddress: null,
          userAgent: anonymizedUserAgent,
        },
      });

      await tx.membership.deleteMany({
        where: { userId },
      });
    });

    await auditService.log({
      userId,
      eventType: 'delete',
      action: 'gdpr.user_anonymized',
      resource: 'user',
      resourceId: userId,
      details: {
        anonymizedAt: new Date().toISOString(),
      },
      status: 'success',
    });

    logger.info('User anonymized', { userId });
  }

  private static hashEmail(email: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  }
      }
