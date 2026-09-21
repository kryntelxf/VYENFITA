/**
 * VYENFITA Review Service
 * 
 * Handles template reviews and ratings.
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { CreateReviewInput, MarketplaceError } from './marketplace.types';

export class ReviewService {
  /**
   * Create a review
   */
  static async create(input: CreateReviewInput): Promise<any> {
    if (input.rating < 1 || input.rating > 5) {
      throw new MarketplaceError('Rating must be between 1 and 5', 'INVALID_RATING');
    }

    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: input.templateId },
    });

    if (!template) {
      throw new MarketplaceError('Template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    if (template.status !== 'published') {
      throw new MarketplaceError('Template not published', 'NOT_PUBLISHED');
    }

    // Check if user already reviewed
    const existing = await prisma.marketplaceReview.findUnique({
      where: {
        templateId_userId: {
          templateId: input.templateId,
          userId: input.userId,
        },
      },
    });

    if (existing) {
      throw new MarketplaceError('Already reviewed', 'ALREADY_REVIEWED', 409);
    }

    // Check if user has installed template
    const install = await prisma.marketplaceInstall.findFirst({
      where: {
        templateId: input.templateId,
        tenantId: input.tenantId,
        status: 'installed',
      },
    });

    if (!install) {
      throw new MarketplaceError(
        'Must install template before reviewing',
        'INSTALL_REQUIRED',
        403
      );
    }

    const review = await prisma.marketplaceReview.create({
      data: {
        id: uuidv4(),
        templateId: input.templateId,
        userId: input.userId,
        tenantId: input.tenantId,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
        status: 'published',
      },
    });

    // Recalculate template rating
    await this.updateTemplateRating(input.templateId);

    logger.info('Review created', {
      reviewId: review.id,
      templateId: input.templateId,
      rating: input.rating,
    });

    return review;
  }

  /**
   * Update a review
   */
  static async update(
    reviewId: string,
    userId: string,
    updates: Partial<CreateReviewInput>
  ): Promise<any> {
    const review = await prisma.marketplaceReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new MarketplaceError('Review not found', 'REVIEW_NOT_FOUND', 404);
    }

    if (review.userId !== userId) {
      throw new MarketplaceError('Not authorized', 'UNAUTHORIZED', 403);
    }

    if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
      throw new MarketplaceError('Rating must be between 1 and 5', 'INVALID_RATING');
    }

    const updated = await prisma.marketplaceReview.update({
      where: { id: reviewId },
      data: {
        rating: updates.rating,
        title: updates.title,
        comment: updates.comment,
      },
    });

    await this.updateTemplateRating(review.templateId);

    return updated;
  }

  /**
   * Delete a review
   */
  static async delete(reviewId: string, userId: string): Promise<void> {
    const review = await prisma.marketplaceReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new MarketplaceError('Review not found', 'REVIEW_NOT_FOUND', 404);
    }

    if (review.userId !== userId) {
      throw new MarketplaceError('Not authorized', 'UNAUTHORIZED', 403);
    }

    await prisma.marketplaceReview.delete({ where: { id: reviewId } });

    await this.updateTemplateRating(review.templateId);
  }

  /**
   * List reviews for a template
   */
  static async listByTemplate(
    templateId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const where = { templateId, status: 'published' };

    const [reviews, total] = await Promise.all([
      prisma.marketplaceReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.marketplaceReview.count({ where }),
    ]);

    return {
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static async updateTemplateRating(templateId: string): Promise<void> {
    const stats = await prisma.marketplaceReview.aggregate({
      where: { templateId, status: 'published' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: {
        rating: stats._avg.rating || 0,
        reviewCount: stats._count.rating || 0,
      },
    });
  }
}

export default ReviewService;
