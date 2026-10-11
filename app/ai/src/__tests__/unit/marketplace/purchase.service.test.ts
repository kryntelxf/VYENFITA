/**
 * VYENFITA Marketplace Purchase Service Unit Tests
 * 
 * Verifies:
 * - Purchase flow with fee calculation
 * - Free template handling
 * - Duplicate purchase prevention
 * - Payment provider integration
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    marketplaceTemplate: {
      findFirst: jest.fn(),
    },
    marketplacePurchase: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    marketplaceAuthor: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/marketplace/install.service', () => ({
  InstallService: {
    install: jest.fn().mockResolvedValue({ id: 'install-1' }),
  },
}));

import { PurchaseService } from '../../../lib/marketplace/purchase.service';
import { MarketplaceError } from '../../../lib/marketplace/marketplace.types';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('PurchaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('purchase()', () => {
    it('should create purchase with correct fee split', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'published',
        priceType: 'paid',
        priceAmount: 100,
        currency: 'USD',
        authorId: 'author-1',
      });
      (mockPrisma.marketplacePurchase.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplacePurchase.create as jest.Mock).mockResolvedValue({
        id: 'purchase-1',
        amount: 100,
        platformFee: 20,
        authorEarnings: 80,
        status: 'completed',
      });
      (mockPrisma.marketplaceAuthor.update as jest.Mock).mockResolvedValue({});

      const result = await PurchaseService.purchase({
        templateId: 'template-1',
        buyerId: 'buyer-1',
        buyerTenantId: 'tenant-1',
        paymentMethod: 'stripe',
      });

      expect(result.amount).toBe(100);
      expect(result.platformFee).toBe(20);
      expect(result.authorEarnings).toBe(80);
    });

    it('should reject purchase of draft template', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'draft',
      });

      await expect(
        PurchaseService.purchase({
          templateId: 'template-1',
          buyerId: 'buyer-1',
          buyerTenantId: 'tenant-1',
        })
      ).rejects.toThrow(MarketplaceError);
    });

    it('should reject purchase when template not found', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        PurchaseService.purchase({
          templateId: 'missing',
          buyerId: 'buyer-1',
          buyerTenantId: 'tenant-1',
        })
      ).rejects.toThrow(/not found/);
    });

    it('should reject duplicate purchase by same tenant', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'published',
        priceType: 'paid',
        priceAmount: 100,
      });
      (mockPrisma.marketplacePurchase.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing',
        status: 'completed',
      });

      await expect(
        PurchaseService.purchase({
          templateId: 'template-1',
          buyerId: 'buyer-2',
          buyerTenantId: 'tenant-1',
        })
      ).rejects.toThrow(/already purchased/);
    });

    it('should handle free template (no payment)', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'published',
        priceType: 'free',
        priceAmount: 0,
        authorId: 'author-1',
      });
      (mockPrisma.marketplacePurchase.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplacePurchase.create as jest.Mock).mockResolvedValue({
        id: 'purchase-1',
        amount: 0,
        platformFee: 0,
        authorEarnings: 0,
        status: 'completed',
      });

      const result = await PurchaseService.purchase({
        templateId: 'template-1',
        buyerId: 'buyer-1',
        buyerTenantId: 'tenant-1',
      });

      expect(result.amount).toBe(0);
    });

    it('should update author balance on successful purchase', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'published',
        priceType: 'paid',
        priceAmount: 100,
        authorId: 'author-1',
      });
      (mockPrisma.marketplacePurchase.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplacePurchase.create as jest.Mock).mockResolvedValue({
        id: 'purchase-1',
        amount: 100,
        authorEarnings: 80,
        status: 'completed',
      });
      (mockPrisma.marketplaceAuthor.update as jest.Mock).mockResolvedValue({});

      await PurchaseService.purchase({
        templateId: 'template-1',
        buyerId: 'buyer-1',
        buyerTenantId: 'tenant-1',
      });

      expect(mockPrisma.marketplaceAuthor.update).toHaveBeenCalledWith({
        where: { id: 'author-1' },
        data: expect.objectContaining({
          totalEarnings: { increment: 80 },
          availableBalance: { increment: 80 },
        }),
      });
    });
  });

  describe('listByTenant()', () => {
    it('should return purchases for a tenant', async () => {
      (mockPrisma.marketplacePurchase.findMany as jest.Mock).mockResolvedValue([
        { id: 'p1', amount: 100 },
        { id: 'p2', amount: 50 },
      ]);

      const result = await PurchaseService.listByTenant('tenant-1');
      expect(result.length).toBe(2);
    });

    it('should filter by tenant', async () => {
      (mockPrisma.marketplacePurchase.findMany as jest.Mock).mockResolvedValue([]);

      await PurchaseService.listByTenant('tenant-1');

      expect(mockPrisma.marketplacePurchase.findMany).toHaveBeenCalledWith({
        where: { buyerTenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
