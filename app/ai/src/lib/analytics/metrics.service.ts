/**
 * VYENFITA Metrics Service
 * 
 * Time-series metrics storage & query.
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { logger } from '../observability/logger';

export type MetricAggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p50' | 'p95' | 'p99';
export type MetricInterval = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface MetricDefinition {
  name: string;
  description: string;
  unit: string;
  aggregation: MetricAggregation;
  tags?: string[];
}

export interface MetricQuery {
  tenantId: string;
  metricName: string;
  startTime: Date;
  endTime: Date;
  interval: MetricInterval;
  aggregation: MetricAggregation;
  filters?: Record<string, string>;
  groupBy?: string[];
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricSeries {
  metricName: string;
  interval: MetricInterval;
  aggregation: MetricAggregation;
  dataPoints: MetricDataPoint[];
  summary: {
    total: number;
    average: number;
    min: number;
    max: number;
    count: number;
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
  };
}

export class MetricsService {
  /**
   * Record a metric data point
   */
  static async record(
    tenantId: string,
    metricName: string,
    value: number,
    labels: Record<string, string> = {},
    timestamp: Date = new Date()
  ): Promise<void> {
    try {
      await prisma.metricDataPoint.create({
        data: {
          tenantId,
          metricName,
          value,
          labels: labels as any,
          timestamp,
        },
      });
    } catch (error) {
      logger.error('Failed to record metric', {
        tenantId,
        metricName,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Record multiple metric points in bulk
   */
  static async recordBulk(
    tenantId: string,
    points: Array<{
      metricName: string;
      value: number;
      labels?: Record<string, string>;
      timestamp?: Date;
    }>
  ): Promise<void> {
    try {
      await prisma.metricDataPoint.createMany({
        data: points.map((p) => ({
          tenantId,
          metricName: p.metricName,
          value: p.value,
          labels: (p.labels || {}) as any,
          timestamp: p.timestamp || new Date(),
        })),
      });
    } catch (error) {
      logger.error('Failed to record bulk metrics', {
        tenantId,
        count: points.length,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Query metrics with aggregation
   */
  static async query(query: MetricQuery): Promise<MetricSeries> {
    const { tenantId, metricName, startTime, endTime, interval, aggregation, filters } = query;

    // Fetch raw data points
    const where: any = {
      tenantId,
      metricName,
      timestamp: { gte: startTime, lte: endTime },
    };

    if (filters) {
      where.labels = { path: Object.keys(filters), equals: filters };
    }

    const points = await prisma.metricDataPoint.findMany({
      where,
      orderBy: { timestamp: 'asc' },
    });

    // Group by interval
    const grouped = this.groupByInterval(points, interval);

    // Aggregate each group
    const dataPoints: MetricDataPoint[] = [];
    for (const [timestamp, values] of grouped) {
      dataPoints.push({
        timestamp,
        value: this.aggregate(values, aggregation),
      });
    }

    // Compute summary
    const allValues = dataPoints.map((p) => p.value);
    const summary = this.computeSummary(allValues);

    return {
      metricName,
      interval,
      aggregation,
      dataPoints,
      summary,
    };
  }

  /**
   * List all metric names for a tenant
   */
  static async listMetrics(tenantId: string): Promise<string[]> {
    const result = await prisma.metricDataPoint.findMany({
      where: { tenantId },
      distinct: ['metricName'],
      select: { metricName: true },
    });

    return result.map((r) => r.metricName);
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static groupByInterval(
    points: any[],
    interval: MetricInterval
  ): Map<Date, number[]> {
    const groups = new Map<Date, number[]>();

    for (const point of points) {
      const key = this.truncateToInterval(point.timestamp, interval);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(point.value);
    }

    return groups;
  }

  private static truncateToInterval(date: Date, interval: MetricInterval): Date {
    const d = new Date(date);

    switch (interval) {
      case 'minute':
        d.setSeconds(0, 0);
        break;
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        break;
      case 'month':
        d.setHours(0, 0, 0, 0);
        d.setDate(1);
        break;
    }

    return d;
  }

  private static aggregate(values: number[], aggregation: MetricAggregation): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);

    switch (aggregation) {
      case 'sum':
        return values.reduce((s, v) => s + v, 0);
      case 'avg':
        return values.reduce((s, v) => s + v, 0) / values.length;
      case 'min':
        return sorted[0];
      case 'max':
        return sorted[sorted.length - 1];
      case 'count':
        return values.length;
      case 'p50':
        return this.percentile(sorted, 50);
      case 'p95':
        return this.percentile(sorted, 95);
      case 'p99':
        return this.percentile(sorted, 99);
      default:
        return 0;
    }
  }

  private static percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private static computeSummary(values: number[]): MetricSeries['summary'] {
    if (values.length === 0) {
      return {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        count: 0,
        trend: 'stable',
        percentChange: 0,
      };
    }

    const total = values.reduce((s, v) => s + v, 0);
    const average = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Trend: compare first half vs second half
    const mid = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, mid).reduce((s, v) => s + v, 0) / (mid || 1);
    const secondHalf = values.slice(mid).reduce((s, v) => s + v, 0) / (values.length - mid || 1);

    const percentChange = firstHalf > 0
      ? ((secondHalf - firstHalf) / firstHalf) * 100
      : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (percentChange > 5) trend = 'up';
    else if (percentChange < -5) trend = 'down';

    return {
      total,
      average,
      min,
      max,
      count: values.length,
      trend,
      percentChange,
    };
  }
}

export default MetricsService;
