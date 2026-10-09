/**
 * VYENFITA KPI Service Unit Tests
 * 
 * Verifies:
 * - KPI creation
 * - KPI value recording
 * - Status calculation (on_track, at_risk, off_track)
 * - Report generation
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    kPI: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    kPIValue: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { KPIService } from '../../../lib/analytics/kpi.service';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('KPIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a KPI with valid input', async () => {
      const mockKPI = {
        id: 'kpi-1',
        tenantId: 'tenant-1',
        name: 'Monthly Revenue',
        description: 'Total monthly revenue',
        unit: 'USD',
        category: 'revenue',
        targetValue: 100000,
        targetDirection: 'above',
        targetPeriod: 'monthly',
        createdBy: 'user-1',
      };
      (mockPrisma.kPI.create as jest.Mock).mockResolvedValue(mockKPI);

      const result = await KPIService.create({
        tenantId: 'tenant-1',
        userId: 'user-1',
        name: 'Monthly Revenue',
        description: 'Total monthly revenue',
        unit: 'USD',
        category: 'revenue',
        targetValue: 100000,
        targetDirection: 'above',
        targetPeriod: 'monthly',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.kPI.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordValue()', () => {
    it('should record a KPI value and calculate status', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue({
        id: 'kpi-1',
        tenantId: 'tenant-1',
        targetValue: 100,
        targetDirection: 'above',
      });
      (mockPrisma.kPIValue.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.kPIValue.create as jest.Mock).mockResolvedValue({});

      await KPIService.recordValue('kpi-1', 'tenant-1', 120);

      expect(mockPrisma.kPIValue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kpiId: 'kpi-1',
          value: 120,
          status: 'on_track',
        }),
      });
    });

    it('should throw when KPI not found', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        KPIService.recordValue('missing-kpi', 'tenant-1', 100)
      ).rejects.toThrow('KPI not found');
    });

    it('should mark as at_risk when at 90% of target (above)', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue({
        id: 'kpi-1',
        tenantId: 'tenant-1',
        targetValue: 100,
        targetDirection: 'above',
      });
      (mockPrisma.kPIValue.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.kPIValue.create as jest.Mock).mockResolvedValue({});

      await KPIService.recordValue('kpi-1', 'tenant-1', 90);

      expect(mockPrisma.kPIValue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'at_risk' }),
      });
    });

    it('should mark as off_track when below 90% of target (above)', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue({
        id: 'kpi-1',
        tenantId: 'tenant-1',
        targetValue: 100,
        targetDirection: 'above',
      });
      (mockPrisma.kPIValue.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.kPIValue.create as jest.Mock).mockResolvedValue({});

      await KPIService.recordValue('kpi-1', 'tenant-1', 50);

      expect(mockPrisma.kPIValue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'off_track' }),
      });
    });

    it('should mark as on_track when at or below target (below direction)', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue({
        id: 'kpi-1',
        tenantId: 'tenant-1',
        targetValue: 100,
        targetDirection: 'below',
      });
      (mockPrisma.kPIValue.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.kPIValue.create as jest.Mock).mockResolvedValue({});

      await KPIService.recordValue('kpi-1', 'tenant-1', 80);

      expect(mockPrisma.kPIValue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'on_track' }),
      });
    });

    it('should calculate trend up when value increased >5%', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue({
        id: 'kpi-1',
        tenantId: 'tenant-1',
        targetValue: 100,
        targetDirection: 'above',
      });
      (mockPrisma.kPIValue.findFirst as jest.Mock).mockResolvedValue({ value: 100 });
      (mockPrisma.kPIValue.create as jest.Mock).mockResolvedValue({});

      await KPIService.recordValue('kpi-1', 'tenant-1', 110);

      expect(mockPrisma.kPIValue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ trend: 'up' }),
      });
    });

    it('should calculate trend stable when value change <5%', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue({
        id: 'kpi-1',
        tenantId: 'tenant-1',
        targetValue: 100,
        targetDirection: 'above',
      });
      (mockPrisma.kPIValue.findFirst as jest.Mock).mockResolvedValue({ value: 100 });
      (mockPrisma.kPIValue.create as jest.Mock).mockResolvedValue({});

      await KPIService.recordValue('kpi-1', 'tenant-1', 102);

      expect(mockPrisma.kPIValue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ trend: 'stable' }),
      });
    });
  });

  describe('getReport()', () => {
    it('should generate report from historical values', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue({
        id: 'kpi-1',
        tenantId: 'tenant-1',
        name: 'Revenue',
        unit: 'USD',
        targetValue: 100,
        targetDirection: 'above',
      });
      (mockPrisma.kPIValue.findMany as jest.Mock).mockResolvedValue([
        { value: 80, timestamp: new Date(), status: 'off_track', trend: 'up', percentChange: 5 },
        { value: 90, timestamp: new Date(), status: 'at_risk', trend: 'up', percentChange: 12.5 },
        { value: 95, timestamp: new Date(), status: 'at_risk', trend: 'up', percentChange: 5.5 },
      ]);

      const report = await KPIService.getReport('kpi-1', 'tenant-1', 30);

      expect(report.current.value).toBe(95);
      expect(report.history.length).toBe(3);
      expect(report.recommendation).toBeDefined();
    });

    it('should throw when KPI not found', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(KPIService.getReport('missing', 'tenant-1')).rejects.toThrow(
        'KPI not found'
      );
    });

    it('should throw when no values in period', async () => {
      (mockPrisma.kPI.findFirst as jest.Mock).mockResolvedValue({
        id: 'kpi-1',
        tenantId: 'tenant-1',
        targetValue: 100,
        targetDirection: 'above',
      });
      (mockPrisma.kPIValue.findMany as jest.Mock).mockResolvedValue([]);

      await expect(KPIService.getReport('kpi-1', 'tenant-1')).rejects.toThrow(
        'No KPI values found'
      );
    });
  });

  describe('list()', () => {
    it('should list all KPIs for tenant', async () => {
      (mockPrisma.kPI.findMany as jest.Mock).mockResolvedValue([
        { id: 'kpi-1', name: 'Revenue', targetValue: 100 },
        { id: 'kpi-2', name: 'Users', targetValue: 1000 },
      ]);
      (mockPrisma.kPIValue.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await KPIService.list('tenant-1');
      expect(result.length).toBe(2);
    });

    it('should filter by category when provided', async () => {
      (mockPrisma.kPI.findMany as jest.Mock).mockResolvedValue([]);

      await KPIService.list('tenant-1', 'revenue');

      expect(mockPrisma.kPI.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', category: 'revenue' },
        orderBy: { name: 'asc' },
      });
    });
  });
});
