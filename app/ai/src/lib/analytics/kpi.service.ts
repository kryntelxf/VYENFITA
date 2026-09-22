/**
 * VYENFITA KPI Service
 * 
 * Key Performance Indicators tracking.
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { logger } from '../observability/logger';

export type KPIStatus = 'on_track' | 'at_risk' | 'off_track' | 'unknown';
export type KPIDirection = 'increase' | 'decrease' | 'stable';
export type KPITrend = 'up' | 'down' | 'stable';

export interface KPIDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  
  // Target
  targetValue: number;
  targetDirection: 'above' | 'below' | 'equal';
  targetPeriod: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  
  // Current
  currentValue?: number;
  previousValue?: number;
  target?: number;
  
  // Status
  status?: KPIStatus;
  trend?: KPITrend;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIValue {
  value: number;
  timestamp: Date;
  status: KPIStatus;
  trend: KPITrend;
  percentToTarget: number;
  percentChange: number;
}

export interface KPIReport {
  kpi: KPIDefinition;
  current: KPIValue;
  history: Array<{ timestamp: Date; value: number }>;
  recommendation?: string;
}

export class KPIService {
  /**
   * Create a KPI definition
   */
  static async create(input: {
    tenantId: string;
    userId: string;
    name: string;
    description: string;
    unit: string;
    category: string;
    targetValue: number;
    targetDirection: 'above' | 'below' | 'equal';
    targetPeriod: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  }): Promise<KPIDefinition> {
    const kpi = await prisma.kPI.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        unit: input.unit,
        category: input.category,
        targetValue: input.targetValue,
        targetDirection: input.targetDirection,
        targetPeriod: input.targetPeriod,
        createdBy: input.userId,
      },
    });

    logger.info('KPI created', { kpiId: kpi.id, name: input.name });

    return kpi as any;
  }

  /**
   * Record a KPI value
   */
  static async recordValue(
    kpiId: string,
    tenantId: string,
    value: number,
    timestamp: Date = new Date()
  ): Promise<void> {
    const kpi = await prisma.kPI.findFirst({
      where: { id: kpiId, tenantId },
    });

    if (!kpi) throw new Error('KPI not found');

    // Get previous value for trend calculation
    const previous = await prisma.kPIValue.findFirst({
      where: { kpiId },
      orderBy: { timestamp: 'desc' },
    });

    // Calculate status
    const status = this.calculateStatus(value, kpi.targetValue, kpi.targetDirection as any);

    // Calculate trend
    const previousValue = previous?.value || 0;
    const percentChange = previousValue > 0
      ? ((value - previousValue) / previousValue) * 100
      : 0;

    let trend: KPITrend = 'stable';
    if (percentChange > 5) trend = 'up';
    else if (percentChange < -5) trend = 'down';

    await prisma.kPIValue.create({
      data: {
        kpiId,
        value,
        status,
        trend,
        percentChange,
        timestamp,
      },
    });
  }

  /**
   * Get KPI report
   */
  static async getReport(
    kpiId: string,
    tenantId: string,
    days: number = 30
  ): Promise<KPIReport> {
    const kpi = await prisma.kPI.findFirst({
      where: { id: kpiId, tenantId },
    });

    if (!kpi) throw new Error('KPI not found');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const values = await prisma.kPIValue.findMany({
      where: {
        kpiId,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (values.length === 0) {
      throw new Error('No KPI values found');
    }

    const current = values[values.length - 1];

    // Calculate percent to target
    const percentToTarget = this.calculatePercentToTarget(
      current.value,
      kpi.targetValue,
      kpi.targetDirection as any
    );

    const report: KPIReport = {
      kpi: kpi as any,
      current: {
        value: current.value,
        timestamp: current.timestamp,
        status: current.status as KPIStatus,
        trend: current.trend as KPITrend,
        percentToTarget,
        percentChange: current.percentChange,
      },
      history: values.map((v) => ({
        timestamp: v.timestamp,
        value: v.value,
      })),
    };

    // Generate recommendation
    report.recommendation = this.generateRecommendation(report);

    return report;
  }

  /**
   * List all KPIs for tenant
   */
  static async list(tenantId: string, category?: string): Promise<KPIDefinition[]> {
    const where: any = { tenantId };
    if (category) where.category = category;

    const kpis = await prisma.kPI.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    // Enrich each with latest value
    const enriched = await Promise.all(
      kpis.map(async (kpi) => {
        const latest = await prisma.kPIValue.findFirst({
          where: { kpiId: kpi.id },
          orderBy: { timestamp: 'desc' },
        });

        return {
          ...kpi,
          currentValue: latest?.value,
          status: latest?.status,
          trend: latest?.trend,
        };
      })
    );

    return enriched as any;
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static calculateStatus(
    value: number,
    target: number,
    direction: 'above' | 'below' | 'equal'
  ): KPIStatus {
    const percentToTarget = this.calculatePercentToTarget(value, target, direction);

    if (direction === 'above') {
      if (value >= target) return 'on_track';
      if (percentToTarget >= 90) return 'at_risk';
      return 'off_track';
    }

    if (direction === 'below') {
      if (value <= target) return 'on_track';
      if (percentToTarget >= 90) return 'at_risk';
      return 'off_track';
    }

    // equal
    const diff = Math.abs(value - target);
    if (diff <= target * 0.05) return 'on_track';
    if (diff <= target * 0.15) return 'at_risk';
    return 'off_track';
  }

  private static calculatePercentToTarget(
    value: number,
    target: number,
    direction: 'above' | 'below' | 'equal'
  ): number {
    if (target === 0) return 0;

    if (direction === 'above') {
      return (value / target) * 100;
    }

    if (direction === 'below') {
      // For "lower is better", invert
      if (value <= target) return 100;
      return (target / value) * 100;
    }

    // equal
    return 100 - (Math.abs(value - target) / target) * 100;
  }

  private static generateRecommendation(report: KPIReport): string | undefined {
    const { current, kpi } = report;

    if (current.status === 'on_track') {
      return `On track to meet target of ${kpi.targetValue} ${kpi.unit}. Keep up the good work.`;
    }

    if (current.status === 'at_risk') {
      return `Approaching target but not there yet (${current.percentToTarget.toFixed(1)}% to goal). Consider additional actions.`;
    }

    if (current.status === 'off_track') {
      if (current.trend === 'down') {
        return `Off track and declining. Urgent intervention needed. Current: ${current.value} ${kpi.unit}, Target: ${kpi.targetValue} ${kpi.unit}.`;
      }
      if (current.trend === 'up') {
        return `Off track but improving. Continue current actions.`;
      }
      return `Off track and stable. Review strategy.`;
    }

    return undefined;
  }
}

export default KPIService;
