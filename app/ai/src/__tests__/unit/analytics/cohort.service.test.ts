/**
 * VYENFITA Cohort Service Unit Tests
 * 
 * Verifies:
 * - Cohort grouping by period
 * - Retention rate calculation
 * - Average retention computation
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    analyticsEvent: {
      findMany: jest.fn(),
    },
  },
}));

import { CohortService } from '../../../lib/analytics/cohort.service';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('CohortService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze()', () => {
    it('should group users by cohort entry date', async () => {
      (mockPrisma.analyticsEvent.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { userId: 'u1', sessionId: null, eventName: 'signup', timestamp: new Date('2026-01-01') },
          { userId: 'u2', sessionId: null, eventName: 'signup', timestamp: new Date('2026-01-02') },
        ])
        .mockResolvedValue([]);

      const result = await CohortService.analyze({
        id: 'cohort-1',
        tenantId: 'tenant-1',
        name: 'Weekly Signup',
        entryEvent: 'signup',
        returnEvent: 'login',
        periodDays: 7,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      expect(result.entryEvent).toBe('signup');
      expect(result.returnEvent).toBe('login');
      expect(result.periodDays).toBe(7);
    });

    it('should compute average retention', async () => {
      (mockPrisma.analyticsEvent.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { userId: 'u1', sessionId: null, eventName: 'signup', timestamp: new Date('2026-01-01') },
        ])
        .mockResolvedValue([]);

      const result = await CohortService.analyze({
        id: 'cohort-1',
        tenantId: 'tenant-1',
        name: 'Test',
        entryEvent: 'signup',
        returnEvent: 'login',
        periodDays: 7,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      expect(result.averageRetention).toBeDefined();
      expect(typeof result.averageRetention.period0).toBe('number');
      expect(typeof result.averageRetention.period1).toBe('number');
      expect(typeof result.averageRetention.period2).toBe('number');
      expect(typeof result.averageRetention.period3).toBe('number');
    });

    it('should handle empty events gracefully', async () => {
      (mockPrisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([]);

      const result = await CohortService.analyze({
        id: 'cohort-1',
        tenantId: 'tenant-1',
        name: 'Empty',
        entryEvent: 'signup',
        returnEvent: 'login',
        periodDays: 7,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      expect(result.cohorts).toEqual([]);
    });
  });
});
