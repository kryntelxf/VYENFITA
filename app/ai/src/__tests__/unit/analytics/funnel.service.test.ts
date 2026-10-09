/**
 * VYENFITA Funnel Service Unit Tests
 * 
 * Verifies:
 * - Funnel creation
 * - Analysis with mocked analytics events
 * - Conversion rate calculation
 * - Dropoff calculation
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    funnel: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    analyticsEvent: {
      findMany: jest.fn(),
    },
  },
}));

import { FunnelService } from '../../../lib/analytics/funnel.service';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('FunnelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a funnel with valid steps', async () => {
      const mockFunnel = {
        id: 'funnel-1',
        tenantId: 'tenant-1',
        name: 'Signup Funnel',
        description: 'User signup conversion',
        steps: [
          { id: 'step-1', name: 'Visit', event: 'page_view' },
          { id: 'step-2', name: 'Signup', event: 'user_signup' },
        ],
        windowHours: 24,
      };
      (mockPrisma.funnel.create as jest.Mock).mockResolvedValue(mockFunnel);

      const result = await FunnelService.create({
        tenantId: 'tenant-1',
        name: 'Signup Funnel',
        description: 'User signup conversion',
        steps: [
          { id: 'step-1', name: 'Visit', event: 'page_view' },
          { id: 'step-2', name: 'Signup', event: 'user_signup' },
        ],
      });

      expect(result).toBeDefined();
      expect(mockPrisma.funnel.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('analyze()', () => {
    it('should calculate conversion rate for complete funnel', async () => {
      const funnel = {
        id: 'funnel-1',
        tenantId: 'tenant-1',
        steps: [
          { id: 's1', name: 'Visit', event: 'visit' },
          { id: 's2', name: 'Signup', event: 'signup' },
        ],
      };
      (mockPrisma.funnel.findFirst as jest.Mock).mockResolvedValue(funnel);

      (mockPrisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([
        { userId: 'u1', eventName: 'visit', timestamp: new Date('2026-01-01T10:00:00'), sessionId: null },
        { userId: 'u1', eventName: 'signup', timestamp: new Date('2026-01-01T10:05:00'), sessionId: null },
        { userId: 'u2', eventName: 'visit', timestamp: new Date('2026-01-01T11:00:00'), sessionId: null },
        { userId: 'u2', eventName: 'signup', timestamp: new Date('2026-01-01T11:10:00'), sessionId: null },
        { userId: 'u3', eventName: 'visit', timestamp: new Date('2026-01-01T12:00:00'), sessionId: null },
      ]);

      const result = await FunnelService.analyze(
        'funnel-1',
        'tenant-1',
        new Date('2026-01-01'),
        new Date('2026-01-02')
      );

      expect(result.totalEntered).toBe(3);
      expect(result.totalConverted).toBe(2);
      expect(result.conversionRate).toBeCloseTo((2 / 3) * 100, 0);
    });

    it('should throw when funnel not found', async () => {
      (mockPrisma.funnel.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        FunnelService.analyze('missing', 'tenant-1', new Date(), new Date())
      ).rejects.toThrow('Funnel not found');
    });

    it('should handle empty events gracefully', async () => {
      (mockPrisma.funnel.findFirst as jest.Mock).mockResolvedValue({
        id: 'funnel-1',
        tenantId: 'tenant-1',
        steps: [{ id: 's1', name: 'Visit', event: 'visit' }],
      });
      (mockPrisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([]);

      const result = await FunnelService.analyze(
        'funnel-1',
        'tenant-1',
        new Date('2026-01-01'),
        new Date('2026-01-02')
      );

      expect(result.totalEntered).toBe(0);
      expect(result.totalConverted).toBe(0);
      expect(result.conversionRate).toBe(0);
    });

    it('should compute step dropoffs', async () => {
      (mockPrisma.funnel.findFirst as jest.Mock).mockResolvedValue({
        id: 'funnel-1',
        tenantId: 'tenant-1',
        steps: [
          { id: 's1', name: 'Visit', event: 'visit' },
          { id: 's2', name: 'Signup', event: 'signup' },
        ],
      });
      (mockPrisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([
        { userId: 'u1', eventName: 'visit', timestamp: new Date('2026-01-01T10:00:00'), sessionId: null },
        { userId: 'u1', eventName: 'signup', timestamp: new Date('2026-01-01T10:05:00'), sessionId: null },
        { userId: 'u2', eventName: 'visit', timestamp: new Date('2026-01-01T11:00:00'), sessionId: null },
      ]);

      const result = await FunnelService.analyze(
        'funnel-1',
        'tenant-1',
        new Date('2026-01-01'),
        new Date('2026-01-02')
      );

      expect(result.steps.length).toBe(2);
      expect(result.steps[0].count).toBe(2);
      expect(result.steps[1].count).toBe(1);
      expect(result.steps[1].dropoffCount).toBe(1);
    });
  });

  describe('list()', () => {
    it('should list all funnels for tenant', async () => {
      (mockPrisma.funnel.findMany as jest.Mock).mockResolvedValue([
        { id: 'f1', name: 'Funnel 1' },
        { id: 'f2', name: 'Funnel 2' },
      ]);

      const result = await FunnelService.list('tenant-1');
      expect(result.length).toBe(2);
    });
  });
});
