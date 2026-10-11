/**
 * VYENFITA Marketplace Creator Service Unit Tests
 * 
 * Verifies:
 * - Creator profile CRUD
 * - Earnings calculation
 * - Payout request validation
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    marketplaceAuthor: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    marketplacePayout: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { CreatorService } from '../../../lib/marketplace/creator.service';
import { MarketplaceError } from '../../../lib/marketplace/marketplace.types';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('CreatorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile()', () => {
    it('should create creator profile', async () => {
      (mockPrisma.marketplaceAuthor.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplaceAuthor.create as jest.Mock).mockResolvedValue({
        id: 'author-1',
        userId: 'user-1',
        displayName: 'Test Creator',
      });

      const result = await CreatorService.createProfile({
        userId: 'user-1',
        displayName: 'Test Creator',
        bio: 'A creator',
      });

      expect(result.displayName).toBe('Test Creator');
    });

    it('should reject when user already has profile', async () => {
      (mockPrisma.marketplaceAuthor.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing',
        userId: 'user-1',
      });

      await expect(
        CreatorService.createProfile({
          userId: 'user-1',
          displayName: 'Test',
        })
      ).rejects.toThrow(/already has a creator profile/);
    });

    it('should reject empty display name', async () => {
      await expect(
        CreatorService.createProfile({
          userId: 'user-1',
          displayName: '',
        })
      ).rejects.toThrow(MarketplaceError);
    });
  });

  describe('getProfileByUserId()', () => {
    it('should return creator profile when found', async () => {
      (mockPrisma.marketplaceAuthor.findFirst as jest.Mock).mockResolvedValue({
        id: 'author-1',
        userId: 'user-1',
      });

      const result = await CreatorService.getProfileByUserId('user-1');
      expect(result?.id).toBe('author-1');
    });

    it('should return null when no profile exists', async () => {
      (mockPrisma.marketplaceAuthor.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await CreatorService.getProfileByUserId('user-1');
      expect(result).toBeNull();
    });
  });

  describe('getEarnings()', () => {
    it('should return earnings summary', async () => {
      (mockPrisma.marketplaceAuthor.findUnique as jest.Mock).mockResolvedValue({
        totalEarnings: 1000,
        availableBalance: 800,
        pendingBalance: 200,
        totalPaidOut: 500,
        currency: 'USD',
      });
      (mockPrisma.marketplacePayout.findMany as jest.Mock).mockResolvedValue([
        { id: 'payout-1', amount: 500, status: 'completed' },
      ]);

      const result = await CreatorService.getEarnings('author-1');

      expect(result.totalEarnings).toBe(1000);
      expect(result.availableBalance).toBe(800);
      expect(result.payoutHistory.length).toBe(1);
    });
  });

  describe('requestPayout()', () => {
    it('should create payout request when balance sufficient', async () => {
      (mockPrisma.marketplaceAuthor.findUnique as jest.Mock).mockResolvedValue({
        id: 'author-1',
        availableBalance: 500,
        payoutEnabled: true,
      });
      (mockPrisma.marketplacePayout.create as jest.Mock).mockResolvedValue({
        id: 'payout-1',
        amount: 400,
        status: 'pending',
      });

      const result = await CreatorService.requestPayout('author-1', 400);

      expect(result.amount).toBe(400);
      expect(result.status).toBe('pending');
    });

    it('should reject payout above available balance', async () => {
      (mockPrisma.marketplaceAuthor.findUnique as jest.Mock).mockResolvedValue({
        id: 'author-1',
        availableBalance: 100,
        payoutEnabled: true,
      });

      await expect(
        CreatorService.requestPayout('author-1', 500)
      ).rejects.toThrow(/insufficient/i);
    });

    it('should reject payout below minimum threshold', async () => {
      (mockPrisma.marketplaceAuthor.findUnique as jest.Mock).mockResolvedValue({
        id: 'author-1',
        availableBalance: 500,
        payoutEnabled: true,
      });

      await expect(
        CreatorService.requestPayout('author-1', 1)
      ).rejects.toThrow(/minimum/i);
    });

    it('should reject when payout not enabled', async () => {
      (mockPrisma.marketplaceAuthor.findUnique as jest.Mock).mockResolvedValue({
        id: 'author-1',
        availableBalance: 500,
        payoutEnabled: false,
      });

      await expect(
        CreatorService.requestPayout('author-1', 100)
      ).rejects.toThrow(/not enabled/i);
    });
  });
});
