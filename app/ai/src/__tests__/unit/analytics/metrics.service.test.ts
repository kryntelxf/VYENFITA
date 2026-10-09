/**
 * VYENFITA Metrics Service Unit Tests
 * 
 * Verifies:
 * - Aggregation logic (sum, avg, min, max, count, percentiles)
 * - Interval truncation
 * - Summary computation (trend, percentChange)
 * 
 * @version 1.0.0
 */

import { MetricsService } from '../../../lib/analytics/metrics.service';

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    metricDataPoint: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('MetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('record()', () => {
    it('should create a metric data point', async () => {
      (mockPrisma.metricDataPoint.create as jest.Mock).mockResolvedValue({});

      await MetricsService.record('tenant-1', 'requests', 100, { env: 'prod' });

      expect(mockPrisma.metricDataPoint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          metricName: 'requests',
          value: 100,
          labels: { env: 'prod' },
        }),
      });
    });

    it('should not throw on database error', async () => {
      (mockPrisma.metricDataPoint.create as jest.Mock).mockRejectedValue(
        new Error('DB error')
      );

      await expect(
        MetricsService.record('tenant-1', 'requests', 100)
      ).resolves.not.toThrow();
    });
  });

  describe('recordBulk()', () => {
    it('should create multiple data points at once', async () => {
      (mockPrisma.metricDataPoint.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await MetricsService.recordBulk('tenant-1', [
        { metricName: 'requests', value: 100 },
        { metricName: 'requests', value: 200 },
        { metricName: 'errors', value: 5 },
      ]);

      expect(mockPrisma.metricDataPoint.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ metricName: 'requests', value: 100 }),
          expect.objectContaining({ metricName: 'requests', value: 200 }),
          expect.objectContaining({ metricName: 'errors', value: 5 }),
        ]),
      });
    });

    it('should not throw on database error', async () => {
      (mockPrisma.metricDataPoint.createMany as jest.Mock).mockRejectedValue(
        new Error('DB error')
      );

      await expect(
        MetricsService.recordBulk('tenant-1', [{ metricName: 'x', value: 1 }])
      ).resolves.not.toThrow();
    });
  });

  describe('query()', () => {
    it('should return empty series when no data points', async () => {
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue([]);

      const result = await MetricsService.query({
        tenantId: 'tenant-1',
        metricName: 'requests',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-02'),
        interval: 'hour',
        aggregation: 'sum',
      });

      expect(result.metricName).toBe('requests');
      expect(result.dataPoints).toEqual([]);
      expect(result.summary.count).toBe(0);
    });

    it('should aggregate by hour', async () => {
      const points = [
        { timestamp: new Date('2026-01-01T10:00:00'), value: 10 },
        { timestamp: new Date('2026-01-01T10:30:00'), value: 20 },
        { timestamp: new Date('2026-01-01T11:00:00'), value: 30 },
      ];
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 'tenant-1',
        metricName: 'requests',
        startTime: new Date('2026-01-01T00:00:00'),
        endTime: new Date('2026-01-02T00:00:00'),
        interval: 'hour',
        aggregation: 'sum',
      });

      expect(result.dataPoints.length).toBe(2);
      expect(result.dataPoints[0].value).toBe(30);
      expect(result.dataPoints[1].value).toBe(30);
    });

    it('should aggregate sum correctly', async () => {
      const points = [
        { timestamp: new Date('2026-01-01T10:00:00'), value: 10 },
        { timestamp: new Date('2026-01-01T10:30:00'), value: 20 },
      ];
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 'tenant-1',
        metricName: 'x',
        startTime: new Date('2026-01-01T00:00:00'),
        endTime: new Date('2026-01-01T23:59:59'),
        interval: 'hour',
        aggregation: 'sum',
      });

      expect(result.dataPoints[0].value).toBe(30);
    });

    it('should aggregate avg correctly', async () => {
      const points = [
        { timestamp: new Date('2026-01-01T10:00:00'), value: 10 },
        { timestamp: new Date('2026-01-01T10:30:00'), value: 20 },
      ];
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 'tenant-1',
        metricName: 'x',
        startTime: new Date('2026-01-01T00:00:00'),
        endTime: new Date('2026-01-01T23:59:59'),
        interval: 'hour',
        aggregation: 'avg',
      });

      expect(result.dataPoints[0].value).toBe(15);
    });

    it('should aggregate min/max correctly', async () => {
      const points = [
        { timestamp: new Date('2026-01-01T10:00:00'), value: 50 },
        { timestamp: new Date('2026-01-01T10:30:00'), value: 10 },
        { timestamp: new Date('2026-01-01T10:45:00'), value: 30 },
      ];
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const minResult = await MetricsService.query({
        tenantId: 't',
        metricName: 'x',
        startTime: new Date('2026-01-01T00:00:00'),
        endTime: new Date('2026-01-01T23:59:59'),
        interval: 'hour',
        aggregation: 'min',
      });
      expect(minResult.dataPoints[0].value).toBe(10);

      const maxResult = await MetricsService.query({
        tenantId: 't',
        metricName: 'x',
        startTime: new Date('2026-01-01T00:00:00'),
        endTime: new Date('2026-01-01T23:59:59'),
        interval: 'hour',
        aggregation: 'max',
      });
      expect(maxResult.dataPoints[0].value).toBe(50);
    });

    it('should aggregate count correctly', async () => {
      const points = [
        { timestamp: new Date('2026-01-01T10:00:00'), value: 1 },
        { timestamp: new Date('2026-01-01T10:30:00'), value: 2 },
        { timestamp: new Date('2026-01-01T10:45:00'), value: 3 },
      ];
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 't',
        metricName: 'x',
        startTime: new Date('2026-01-01T00:00:00'),
        endTime: new Date('2026-01-01T23:59:59'),
        interval: 'hour',
        aggregation: 'count',
      });

      expect(result.dataPoints[0].value).toBe(3);
    });

    it('should compute p50 correctly', async () => {
      const points = [10, 20, 30, 40, 50].map((v, i) => ({
        timestamp: new Date(`2026-01-01T10:${i}0:00`),
        value: v,
      }));
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 't',
        metricName: 'x',
        startTime: new Date('2026-01-01T00:00:00'),
        endTime: new Date('2026-01-01T23:59:59'),
        interval: 'hour',
        aggregation: 'p50',
      });

      expect(result.dataPoints[0].value).toBe(30);
    });

    it('should compute p95 correctly', async () => {
      const points = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(`2026-01-01T10:00:${i}`),
        value: i + 1,
      }));
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 't',
        metricName: 'x',
        startTime: new Date('2026-01-01T00:00:00'),
        endTime: new Date('2026-01-01T23:59:59'),
        interval: 'hour',
        aggregation: 'p95',
      });

      expect(result.dataPoints[0].value).toBeGreaterThanOrEqual(95);
      expect(result.dataPoints[0].value).toBeLessThanOrEqual(96);
    });

    it('should compute summary with trend', async () => {
      const points = [10, 20, 30, 40].map((v, i) => ({
        timestamp: new Date(`2026-01-0${i + 1}T10:00:00`),
        value: v,
      }));
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 't',
        metricName: 'x',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-10'),
        interval: 'day',
        aggregation: 'sum',
      });

      expect(result.summary.trend).toBe('up');
      expect(result.summary.percentChange).toBeGreaterThan(0);
      expect(result.summary.total).toBe(100);
      expect(result.summary.min).toBe(10);
      expect(result.summary.max).toBe(40);
      expect(result.summary.count).toBe(4);
    });

    it('should detect downward trend', async () => {
      const points = [40, 30, 20, 10].map((v, i) => ({
        timestamp: new Date(`2026-01-0${i + 1}T10:00:00`),
        value: v,
      }));
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 't',
        metricName: 'x',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-10'),
        interval: 'day',
        aggregation: 'sum',
      });

      expect(result.summary.trend).toBe('down');
      expect(result.summary.percentChange).toBeLessThan(0);
    });

    it('should detect stable trend', async () => {
      const points = [20, 20, 20, 20].map((v, i) => ({
        timestamp: new Date(`2026-01-0${i + 1}T10:00:00`),
        value: v,
      }));
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue(points);

      const result = await MetricsService.query({
        tenantId: 't',
        metricName: 'x',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-10'),
        interval: 'day',
        aggregation: 'sum',
      });

      expect(result.summary.trend).toBe('stable');
    });
  });

  describe('listMetrics()', () => {
    it('should return distinct metric names', async () => {
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue([
        { metricName: 'requests' },
        { metricName: 'errors' },
      ]);

      const result = await MetricsService.listMetrics('tenant-1');
      expect(result).toEqual(['requests', 'errors']);
    });

    it('should return empty array for tenant with no metrics', async () => {
      (mockPrisma.metricDataPoint.findMany as jest.Mock).mockResolvedValue([]);

      const result = await MetricsService.listMetrics('empty-tenant');
      expect(result).toEqual([]);
    });
  });
});
