/**
 * VYENFITA Cost Aggregator Service
 * 
 * Aggregates costs from multiple sources:
 * - AI provider costs (OpenAI, Anthropic)
 * - Compute costs (K8s pods)
 * - Storage costs (S3, DB)
 * - Network costs
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { logger } from '../observability/logger';

export interface CostSummary {
  tenantId: string;
  period: {
    start: Date;
    end: Date;
  };
  total: number;
  currency: string;
  breakdown: {
    ai: AICostBreakdown;
    compute: ComputeCostBreakdown;
    storage: StorageCostBreakdown;
    network: NetworkCostBreakdown;
  };
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}

export interface AICostBreakdown {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byOperation: Record<string, number>;
  tokens: number;
}

export interface ComputeCostBreakdown {
  total: number;
  byPod: Record<string, number>;
  cpuHours: number;
  memoryGBHours: number;
}

export interface StorageCostBreakdown {
  total: number;
  byBucket: Record<string, number>;
  byDatabase: Record<string, number>;
  gigabyteMonths: number;
}

export interface NetworkCostBreakdown {
  total: number;
  ingressGB: number;
  egressGB: number;
}

export interface CostAttribution {
  tenantId: string;
  userId?: string;
  service: string;
  operation: string;
  cost: number;
  quantity: number;
  unit: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export class CostAggregatorService {
  /**
   * Get cost summary for a tenant
   */
  static async getSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostSummary> {
    // Query cost records
    const costs = await prisma.costRecord.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Aggregate
    const ai: AICostBreakdown = {
      total: 0,
      byProvider: {},
      byModel: {},
      byOperation: {},
      tokens: 0,
    };

    const compute: ComputeCostBreakdown = {
      total: 0,
      byPod: {},
      cpuHours: 0,
      memoryGBHours: 0,
    };

    const storage: StorageCostBreakdown = {
      total: 0,
      byBucket: {},
      byDatabase: {},
      gigabyteMonths: 0,
    };

    const network: NetworkCostBreakdown = {
      total: 0,
      ingressGB: 0,
      egressGB: 0,
    };

    let total = 0;

    for (const cost of costs) {
      total += cost.totalCost;

      if (cost.service === 'openai' || cost.service === 'anthropic') {
        ai.total += cost.totalCost;
        ai.byProvider[cost.service] = (ai.byProvider[cost.service] || 0) + cost.totalCost;
        if (cost.model) {
          ai.byModel[cost.model] = (ai.byModel[cost.model] || 0) + cost.totalCost;
        }
        ai.byOperation[cost.description] = (ai.byOperation[cost.description] || 0) + cost.totalCost;
        ai.tokens += cost.quantity;
      } else if (cost.service === 'compute') {
        compute.total += cost.totalCost;
        compute.cpuHours += cost.quantity;
      } else if (cost.service === 'storage') {
        storage.total += cost.totalCost;
        storage.gigabyteMonths += cost.quantity;
      } else if (cost.service === 'networking') {
        network.total += cost.totalCost;
        network.egressGB += cost.quantity;
      }
    }

    // Calculate trend (compare to previous period)
    const periodDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const previousStart = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousEnd = startDate;

    const previousCosts = await prisma.costRecord.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
    });

    const previousTotal = previousCosts.reduce((sum, c) => sum + c.totalCost, 0);
    const percentChange = previousTotal > 0
      ? ((total - previousTotal) / previousTotal) * 100
      : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (percentChange > 5) trend = 'up';
    else if (percentChange < -5) trend = 'down';

    return {
      tenantId,
      period: { start: startDate, end: endDate },
      total,
      currency: 'USD',
      breakdown: { ai, compute, storage, network },
      trend,
      percentChange,
    };
  }

  /**
   * Aggregate costs by tenant across all tenants
   */
  static async getAllTenantsSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    tenants: Array<{ tenantId: string; total: number; percent: number }>;
  }> {
    const costs = await prisma.costRecord.groupBy({
      by: ['tenantId'],
      _sum: {
        totalCost: true,
      },
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const total = costs.reduce((sum, c) => sum + (c._sum.totalCost || 0), 0);

    const tenants = costs
      .map((c) => ({
        tenantId: c.tenantId,
        total: c._sum.totalCost || 0,
        percent: total > 0 ? ((c._sum.totalCost || 0) / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return { total, tenants };
  }

  /**
   * Get daily cost trend
   */
  static async getDailyTrend(
    tenantId: string,
    days: number = 30
  ): Promise<Array<{ date: string; cost: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const costs = await prisma.costRecord.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: startDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by day
    const dailyCosts = new Map<string, number>();

    for (const cost of costs) {
      const dateKey = cost.timestamp.toISOString().split('T')[0];
      dailyCosts.set(dateKey, (dailyCosts.get(dateKey) || 0) + cost.totalCost);
    }

    // Fill missing days with 0
    const result: Array<{ date: string; cost: number }> = [];
    const currentDate = new Date(startDate);

    while (currentDate <= new Date()) {
      const dateKey = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateKey,
        cost: dailyCosts.get(dateKey) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /**
   * Get top cost drivers for a tenant
   */
  static async getTopCostDrivers(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<
    Array<{
      service: string;
      description: string;
      cost: number;
      percent: number;
    }>
  > {
    const costs = await prisma.costRecord.groupBy({
      by: ['service', 'description'],
      _sum: {
        totalCost: true,
      },
      where: {
        tenantId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const total = costs.reduce((sum, c) => sum + (c._sum.totalCost || 0), 0);

    return costs
      .map((c) => ({
        service: c.service,
        description: c.description,
        cost: c._sum.totalCost || 0,
        percent: total > 0 ? ((c._sum.totalCost || 0) / total) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }
  }
