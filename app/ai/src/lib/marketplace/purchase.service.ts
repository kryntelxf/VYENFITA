/**
 * VYENFITA Purchase Service
 * 
 * Handles payments, purchases, and refunds.
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { CreatorService } from './creator.service';
import {
  PurchaseTemplateInput,
  MarketplaceError,
  TemplateNotFoundError,
  PLATFORM_FEE_PERCENTAGE,
  AUTHOR_EARNINGS_PERCENTAGE,
} from './marketplace.types';

export class PurchaseService {
  /**
   * Purchase a template
   */
  static async purchase(input: PurchaseTemplateInput): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: input.templateId },
    });

    if (!template) {
      throw new TemplateNotFoundError(input.templateId);
    }

    if (template.status !== 'published') {
      throw new MarketplaceError(
        'Template is not available for purchase',
        'NOT_AVAILABLE'
      );
    }

    // Free template: create completed purchase
    if (template.priceType === 'free') {
      return this.createFreePurchase(input, template);
    }

    // Paid template: require payment
    if (template.priceType === 'paid') {
      return this.createPaidPurchase(input, template);
    }

    throw new MarketplaceError(
      `Unsupported price type: ${template.priceType}`,
      'UNSUPPORTED_PRICE_TYPE'
    );
  }

  /**
   * Check if user has access to template
   */
  static async hasAccess(
    templateId: string,
    buyerId: string,
    buyerTenantId: string
  ): Promise<boolean> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) return false;

    // Free template: always accessible
    if (template.priceType === 'free') return true;

    // Author: own templates
    const author = await prisma.marketplaceAuthor.findUnique({
      where: { userId: buyerId },
    });

    if (author && author.id === template.authorId) return true;

    // Check purchase
    const purchase = await prisma.marketplacePurchase.findFirst({
      where: {
        templateId,
        buyerTenantId,
        status: 'completed',
      },
    });

    return !!purchase;
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static async createFreePurchase(
    input: PurchaseTemplateInput,
    template: any
  ): Promise<any> {
    const purchase = await prisma.marketplacePurchase.create({
      data: {
        id: uuidv4(),
        templateId: template.id,
        buyerId: input.buyerId,
        buyerTenantId: input.buyerTenantId,
        amount: 0,
        currency: template.currency,
        platformFee: 0,
        authorEarnings: 0,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    logger.info('Free template acquired', {
      purchaseId: purchase.id,
      templateId: template.id,
      buyerId: input.buyerId,
    });

    return purchase;
  }

  private static async createPaidPurchase(
    input: PurchaseTemplateInput,
    template: any
  ): Promise<any> {
    if (!template.priceAmount || template.priceAmount <= 0) {
      throw new MarketplaceError(
        'Template has invalid price',
        'INVALID_PRICE'
      );
    }

    const amount = template.priceAmount;
    const platformFee = (amount * PLATFORM_FEE_PERCENTAGE) / 100;
    const authorEarnings = (amount * AUTHOR_EARNINGS_PERCENTAGE) / 100;

    // Create pending purchase (payment will be completed via webhook)
    const purchase = await prisma.marketplacePurchase.create({
      data: {
        id: uuidv4(),
        templateId: template.id,
        buyerId: input.buyerId,
        buyerTenantId: input.buyerTenantId,
        amount,
        currency: template.currency,
        platformFee,
        authorEarnings,
        status: 'pending',
        paymentProvider: input.paymentMethod || 'stripe',
      },
    });

    // In production: create Stripe PaymentIntent here
    // For now, we return the pending purchase
    // The client will complete payment via Stripe Elements

    logger.info('Pending purchase created', {
      purchaseId: purchase.id,
      templateId: template.id,
      amount,
    });

    return purchase;
  }

  /**
   * Complete a pending purchase (called from payment webhook)
   */
  static async completePurchase(
    purchaseId: string,
    paymentIntentId: string
  ): Promise<any> {
    const purchase = await prisma.marketplacePurchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new MarketplaceError('Purchase not found', 'PURCHASE_NOT_FOUND', 404);
    }

    if (purchase.status !== 'pending') {
      throw new MarketplaceError(
        `Cannot complete purchase with status: ${purchase.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await prisma.marketplacePurchase.update({
      where: { id: purchaseId },
      data: {
        status: 'completed',
        paymentIntentId,
        completedAt: new Date(),
      },
    });

    // Credit author
    if (purchase.authorEarnings > 0) {
      await CreatorService.creditPurchase(purchase.templateId, purchase.authorEarnings);
    }

    // Increment template stats
    await prisma.marketplaceTemplate.update({
      where: { id: purchase.templateId },
      data: { installCount: { increment: 1 } },
    });

    await auditService.log({
      eventType: 'system',
      action: 'marketplace.purchase.complete',
      resource: 'marketplace_purchase',
      resourceId: purchaseId,
      details: { amount: purchase.amount },
      status: 'success',
    });

    logger.info('Purchase completed', { purchaseId, amount: purchase.amount });

    return updated;
  }

  /**
   * Refund a purchase
   */
  static async refund(
    purchaseId: string,
    reason: string,
    adminUserId?: string
  ): Promise<any> {
    const purchase = await prisma.marketplacePurchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new MarketplaceError('Purchase not found', 'PURCHASE_NOT_FOUND', 404);
    }

    if (purchase.status !== 'completed') {
      throw new MarketplaceError(
        `Cannot refund purchase with status: ${purchase.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await prisma.marketplacePurchase.update({
      where: { id: purchaseId },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundReason: reason,
      },
    });

    // Reverse author earnings
    if (purchase.authorEarnings > 0) {
      const template = await prisma.marketplaceTemplate.findUnique({
        where: { id: purchase.templateId },
      });

      if (template) {
        await prisma.marketplaceAuthor.update({
          where: { id: template.authorId },
          data: {
            totalEarnings: { decrement: purchase.authorEarnings },
            availableBalance: { decrement: purchase.authorEarnings },
            installCount: { decrement: 1 },
          },
        });
      }
    }

    await auditService.log({
      userId: adminUserId,
      eventType: 'modify',
      action: 'marketplace.purchase.refund',
      resource: 'marketplace_purchase',
      resourceId: purchaseId,
      details: { reason, amount: purchase.amount },
      status: 'success',
    });

    logger.info('Purchase refunded', { purchaseId, reason });

    return updated;
  }

  /**
   * List purchases for a tenant
   */
  static async listByTenant(tenantId: string): Promise<any[]> {
    return prisma.marketplacePurchase.findMany({
      where: { buyerTenantId: tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: { id: true, name: true, slug: true, icon: true },
        },
      },
    });
  }
}

export default PurchaseService;
