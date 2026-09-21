/**
 * VYENFITA Creator Service
 * 
 * Handles creator profiles, earnings, payouts.
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { MarketplaceError } from './marketplace.types';

export interface CreateCreatorProfileInput {
  userId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  githubHandle?: string;
}

export class CreatorService {
  /**
   * Create creator profile
   */
  static async createProfile(input: CreateCreatorProfileInput): Promise<any> {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      throw new MarketplaceError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Check if already has profile
    const existing = await prisma.marketplaceAuthor.findUnique({
      where: { userId: input.userId },
    });

    if (existing) {
      throw new MarketplaceError('Creator profile already exists', 'PROFILE_EXISTS', 409);
    }

    const profile = await prisma.marketplaceAuthor.create({
      data: {
        id: uuidv4(),
        userId: input.userId,
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        websiteUrl: input.websiteUrl,
        twitterHandle: input.twitterHandle,
        githubHandle: input.githubHandle,
      },
    });

    logger.info('Creator profile created', { creatorId: profile.id, userId: input.userId });

    return profile;
  }

  /**
   * Get creator profile
   */
  static async getProfile(creatorId: string): Promise<any> {
    const profile = await prisma.marketplaceAuthor.findUnique({
      where: { id: creatorId },
      include: {
        templates: {
          where: { status: 'published', deletedAt: null },
          orderBy: { installCount: 'desc' },
          take: 20,
        },
      },
    });

    if (!profile) {
      throw new MarketplaceError('Creator not found', 'CREATOR_NOT_FOUND', 404);
    }

    return profile;
  }

  /**
   * Get profile by user ID
   */
  static async getProfileByUserId(userId: string): Promise<any> {
    return prisma.marketplaceAuthor.findUnique({
      where: { userId },
    });
  }

  /**
   * Update profile
   */
  static async updateProfile(
    creatorId: string,
    updates: Partial<CreateCreatorProfileInput>
  ): Promise<any> {
    const profile = await prisma.marketplaceAuthor.update({
      where: { id: creatorId },
      data: {
        displayName: updates.displayName,
        bio: updates.bio,
        avatarUrl: updates.avatarUrl,
        websiteUrl: updates.websiteUrl,
        twitterHandle: updates.twitterHandle,
        githubHandle: updates.githubHandle,
      },
    });

    return profile;
  }

  /**
   * Get earnings summary
   */
  static async getEarnings(creatorId: string): Promise<{
    total: number;
    available: number;
    pending: number;
    paidOut: number;
    recentSales: any[];
  }> {
    const creator = await prisma.marketplaceAuthor.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new MarketplaceError('Creator not found', 'CREATOR_NOT_FOUND', 404);
    }

    // Get recent sales
    const recentSales = await prisma.marketplacePurchase.findMany({
      where: {
        template: { authorId: creatorId },
        status: 'completed',
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: {
        template: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return {
      total: creator.totalEarnings,
      available: creator.availableBalance,
      pending: creator.pendingBalance,
      paidOut: creator.totalPaidOut,
      recentSales,
    };
  }

  /**
   * Update creator balance after purchase
   */
  static async creditPurchase(
    templateId: string,
    authorEarnings: number
  ): Promise<void> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new MarketplaceError('Template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    await prisma.marketplaceAuthor.update({
      where: { id: template.authorId },
      data: {
        totalEarnings: { increment: authorEarnings },
        availableBalance: { increment: authorEarnings },
        installCount: { increment: 1 },
      },
    });

    logger.info('Creator credited', {
      templateId,
      authorId: template.authorId,
      amount: authorEarnings,
    });
  }

  /**
   * Request payout
   */
  static async requestPayout(
    creatorId: string,
    amount: number
  ): Promise<any> {
    const creator = await prisma.marketplaceAuthor.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new MarketplaceError('Creator not found', 'CREATOR_NOT_FOUND', 404);
    }

    if (!creator.payoutEnabled) {
      throw new MarketplaceError(
        'Payout not enabled. Please configure payment method.',
        'PAYOUT_DISABLED'
      );
    }

    if (amount < 50) {
      throw new MarketplaceError(
        'Minimum payout amount is $50',
        'MIN_PAYOUT'
      );
    }

    if (amount > creator.availableBalance) {
      throw new MarketplaceError(
        'Insufficient balance',
        'INSUFFICIENT_BALANCE'
      );
    }

    // Create payout record
    const now = new Date();
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const payout = await prisma.marketplacePayout.create({
      data: {
        id: uuidv4(),
        authorId: creatorId,
        amount,
        currency: creator.currency,
        status: 'pending',
        provider: 'stripe',
        periodStart,
        periodEnd: now,
      },
    });

    // Move from available to pending
    await prisma.marketplaceAuthor.update({
      where: { id: creatorId },
      data: {
        availableBalance: { decrement: amount },
        pendingBalance: { increment: amount },
      },
    });

    await auditService.log({
      eventType: 'create',
      action: 'marketplace.payout.request',
      resource: 'marketplace_payout',
      resourceId: payout.id,
      details: { creatorId, amount },
      status: 'success',
    });

    logger.info('Payout requested', { payoutId: payout.id, creatorId, amount });

    return payout;
  }

  /**
   * List payouts for creator
   */
  static async listPayouts(creatorId: string): Promise<any[]> {
    return prisma.marketplacePayout.findMany({
      where: { authorId: creatorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Mark payout as completed (admin/webhook)
   */
  static async completePayout(payoutId: string, providerRef: string): Promise<any> {
    const payout = await prisma.marketplacePayout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new MarketplaceError('Payout not found', 'PAYOUT_NOT_FOUND', 404);
    }

    const updated = await prisma.marketplacePayout.update({
      where: { id: payoutId },
      data: {
        status: 'completed',
        providerRef,
        completedAt: new Date(),
      },
    });

    await prisma.marketplaceAuthor.update({
      where: { id: payout.authorId },
      data: {
        pendingBalance: { decrement: payout.amount },
        totalPaidOut: { increment: payout.amount },
      },
    });

    logger.info('Payout completed', { payoutId, providerRef });

    return updated;
  }
}

export default CreatorService;
