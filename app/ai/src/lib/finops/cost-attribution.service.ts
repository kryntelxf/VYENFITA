/**
 * VYENFITA Cost Attribution Service
 * 
 * Attributes every cost to a tenant, user, service, and operation.
 * This is the foundation of FinOps — no cost without attribution.
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { logger } from '../observability/logger';

export type CostService =
  | 'ai_openai'
  | 'ai_anthropic'
  | 'ai_other'
  | 'compute'
  | 'storage'
  | 'network'
  | 'database'
  | 'cache'
  | 'other';

export interface CostAttribution {
  tenantId: string;
  userId?: string;
  service: CostService;
  operation: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface CostBreakdown {
  total: number;
  currency: string;
  period: { start: Date; end: Date };
  byService: Record<string, number>;
  byOperation: Record<string, number>;
  byUser: Record<string, number>;
  byDay: Record<string, number>;
}

export class CostAttributionService {
  /**
   * Record a cost with full attribution
   */
  static async record(attribution: CostAttribution): Promise<void> {
    try {
      // Create usage record
      const usageRecord = await prisma.usageRecord.create({
        data: {
          tenantId: attribution.tenantId,
          userId: attribution.userId,
          service: attribution.service,
          operation: attribution.operation,
          quantity: attribution.quantity,
          unit: attribution.unit,
          metadata: attribution.metadata || {},
        },
      });

      // Create cost record
      await prisma.costRecord.create({
        data: {
          tenantId: attribution.tenantId,
          usageRecordId: usageRecord.id,
          service: attribution.service,
          description: `${attribution.operation} (${attribution.quantity} ${attribution.unit})`,
          quantity: attribution.quantity,
          unitCost: attribution.unitCost,
          totalCost: attribution.totalCost,
          currency: attribution.currency,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
    } catch (error) {
      // Never break main flow due to cost tracking
      logger.error('Failed to record cost attribution', {
        error: error instanceof Error ? error.message : 'Unknown',
        attribution,
      });
    }
  }

  /**
   * Get cost breakdown for a tenant
   */
  static async getBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostBreakdown> {
    const records = await prisma.costRecord.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        usageRecord: true,
      },
    });

    const breakdown: CostBreakdown = {
      total: 0,
      currency: 'USD',
      period: { start: startDate, end: endDate },
      byService: {},
      byOperation: {},
      byUser: {},
      byDay: {},
    };

    for (const record of records) {
      breakdown.total += record.totalCost;

      // By service
      breakdown.byService[record.service] =
        (breakdown.byService[record.service] || 0) + record.totalCost;

      // By operation
      const operation = record.usageRecord?.operation || 'unknown';
      breakdown.byOperation[operation] =
        (breakdown.byOperation[operation] || 0) + record.totalCost;

      // By user
      const userId = record.usageRecord?.userId || 'unknown';
      breakdown.byUser[userId] =
        (breakdown.byUser[userId] || 0) + record.totalCost;

      // By day
      const day = record.timestamp.toISOString().split('T')[0];
      breakdown.byDay[day] = (breakdown.byDay[day] || 0) + record.totalCost;
    }

    return breakdown;
  }

  /**
   * Get monthly cost trend for a tenant
   */
  static async getMonthlyTrend(
    tenantId: string,
    months: number = 6
  ): Promise<Array<{ month: string; total: number; byService: Record<string, number> }>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const records = await prisma.costRecord.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const monthly: Record<string, { total: number; byService: Record<string, number> }> = {};

    for (const record of records) {
      const month = record.timestamp.toISOString().substring(0, 7); // YYYY-MM

      if (!monthly[month]) {
        monthly[month] = { total: 0, byService: {} };
      }

      monthly[month].total += record.totalCost;
      monthly[month].byService[record.service] =
        (monthly[month].byService[record.service] || 0) + record.totalCost;
    }

    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
  }

  /**
   * Get top spenders (tenants) — for internal operations
   */
  static async getTopSpenders(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ tenantId: string; total: number }>> {
    const records = await prisma.costRecord.groupBy({
      by: ['tenantId'],
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        totalCost: true,
      },
      orderBy: {
        _sum: {
          totalCost: 'desc',
        },
      },
      take: limit,
    });

    return records.map((r) => ({
      tenantId: r.tenantId,
      total: r._sum.totalCost || 0,
    }));
  }
  }
