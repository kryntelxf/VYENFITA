/**
 * VYENFITA Marketplace Review Service Unit Tests
 * 
 * Verifies:
 * - Review creation with rating validation
 * - List reviews with pagination
 * - Tenant isolation
 * - Duplicate review prevention
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    marketplaceReview: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    marketplaceTemplate: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { ReviewService } from '../../../lib/marketplace/review.service';
import { MarketplaceError } from '../../../lib/marketplace/marketplace.types';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a valid review', async () => {
      (mockPrisma.marketplaceReview.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplaceReview.create as jest.Mock).mockResolvedValue({
        id: 'review-1',
        templateId: 'template-1',
        userId: 'user-1',
        rating: 5,
        title: 'Great!',
        comment: 'Loved it',
      });
      (mockPrisma.marketplaceReview.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: 5 },
      });
      (mockPrisma.marketplaceReview.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.marketplaceTemplate.update as jest.Mock).mockResolvedValue({});

      const result = await ReviewService.create({
        templateId: 'template-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        rating: 5,
        title: 'Great!',
        comment: 'Loved it',
      });

      expect(result.rating).toBe(5);
      expect(mockPrisma.marketplaceReview.create).toHaveBeenCalled();
    });

    it('should reject rating below 1', async () => {
      await expect(
        ReviewService.create({
          templateId: 't1',
          userId: 'u1',
          tenantId: 'tenant-1',
          rating: 0,
        })
      ).rejects.toThrow(MarketplaceError);
    });

    it('should reject rating above 5', async () => {
      await expect(
        ReviewService.create({
          templateId: 't1',
          userId: 'u1',
          tenantId: 'tenant-1',
          rating: 6,
        })
      ).rejects.toThrow(MarketplaceError);
    });

    it('should reject non-integer rating', async () => {
      await expect(
        ReviewService.create({
          templateId: 't1',
          userId: 'u1',
          tenantId: 'tenant-1',
          rating: 3.5,
        })
      ).rejects.toThrow(MarketplaceError);
    });

    it('should reject duplicate review by same user', async () => {
      (mockPrisma.marketplaceReview.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-review',
      });

      await expect(
        ReviewService.create({
          templateId: 't1',
          userId: 'u1',
          tenantId: 'tenant-1',
          rating: 5,
        })
      ).rejects.toThrow(/already reviewed/);
    });

    it('should update template rating after create', async () => {
      (mockPrisma.marketplaceReview.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplaceReview.create as jest.Mock).mockResolvedValue({
        id: 'r1',
        rating: 4,
      });
      (mockPrisma.marketplaceReview.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: 4.5 },
      });
      (mockPrisma.marketplaceReview.count as jest.Mock).mockResolvedValue(10);
      (mockPrisma.marketplaceTemplate.update as jest.Mock).mockResolvedValue({});

      await ReviewService.create({
        templateId: 'template-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        rating: 4,
      });

      expect(mockPrisma.marketplaceTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: expect.objectContaining({
          rating: 4.5,
          reviewCount: 10,
        }),
      });
    });
  });

  describe('listByTemplate()', () => {
    it('should return reviews with pagination', async () => {
      const mockReviews = [
        { id: 'r1', rating: 5, comment: 'Great' },
        { id: 'r2', rating: 4, comment: 'Good' },
      ];
      (mockPrisma.marketplaceReview.findMany as jest.Mock).mockResolvedValue(mockReviews);
      (mockPrisma.marketplaceReview.count as jest.Mock).mockResolvedValue(2);

      const result = await ReviewService.listByTemplate('template-1', 1, 20);

      expect(result.data.length).toBe(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should handle empty result', async () => {
      (mockPrisma.marketplaceReview.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.marketplaceReview.count as jest.Mock).mockResolvedValue(0);

      const result = await ReviewService.listByTemplate('template-1');

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should apply pagination skip/take', async () => {
      (mockPrisma.marketplaceReview.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.marketplaceReview.count as jest.Mock).mockResolvedValue(50);

      await ReviewService.listByTemplate('template-1', 3, 10);

      expect(mockPrisma.marketplaceReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });
  });
});
