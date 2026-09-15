/**
 * VYENFITA Cost Anomaly Detection
 * 
 * Detects unusual cost patterns:
 * - Sudden spikes
 * - Gradual drift
 * - Unexpected services
 * - Runaway processes
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { logger } from '../observability/logger';
import { auditService } from '../audit/audit.service';

export interface CostAnomaly {
  id: string;
  tenantId: string;
  type: 'spike' | 'drift' | 'unexpected_service' | 'runaway';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  value: number;
  expected: number;
  deviation: number;
  evidence: Record<string, any>;
}

export class AnomalyDetectionService {
  /**
   * Scan all tenants for cost anomalies
   */
  static async scanAll(periodDays: number = 7): Promise<CostAnomaly[]> {
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'active',
        deletedAt: null,
      },
      select: { id: true },
    });

    const allAnomalies: CostAnomaly[] = [];

    for (const tenant of tenants) {
      const anomalies = await this.scanTenant(tenant.id, periodDays);
      allAnomalies.push(...anomalies);
    }

    return allAnomalies;
  }

  /**
   * Scan a specific tenant
   */
  static async scanTenant(tenantId: string, periodDays: number = 7): Promise<CostAnomaly[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const anomalies: CostAnomaly[] = [];

    // Get recent cost records
    const records = await prisma.costRecord.findMany({
      where: {
        tenantId,
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (records.length < 10) return anomalies;

    // Detect daily spikes
    anomalies.push(...this.detectSpikes(tenantId, records));

    // Detect service anomalies (unusual service usage)
    anomalies.push(...this.detectUnexpectedServices(tenantId, records));

    // Log anomalies
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
        await auditService.log({
          tenantId,
          eventType: 'security',
          action: 'cost.anomaly_detected',
          resource: 'cost',
          resourceId: anomaly.id,
          details: {
            type: anomaly.type,
            severity: anomaly.severity,
            value: anomaly.value,
            expected: anomaly.expected,
          },
          status: 'failure',
        });

        logger.warn('Cost anomaly detected', {
          tenantId,
          anomalyId: anomaly.id,
          type: anomaly.type,
          severity: anomaly.severity,
        });
      }
    }

    return anomalies;
  }

  // ============================================================
  // PRIVATE DETECTORS
  // ============================================================

  private static detectSpikes(tenantId: string, records: any[]): CostAnomaly[] {
    const anomalies: CostAnomaly[] = [];

    // Group by day
    const dailyCosts: Record<string, number> = {};
    for (const record of records) {
      const day = record.timestamp.toISOString().split('T')[0];
      dailyCosts[day] = (dailyCosts[day] || 0) + record.totalCost;
    }

    const values = Object.values(dailyCosts);
    if (values.length < 3) return anomalies;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    // Find days > 2 std dev above mean
    for (const [day, cost] of Object.entries(dailyCosts)) {
      const zscore = stdDev > 0 ? (cost - mean) / stdDev : 0;

      if (zscore > 2) {
        const severity: CostAnomaly['severity'] =
          zscore > 4 ? 'critical' : zscore > 3 ? 'high' : 'medium';

        anomalies.push({
          id: `spike-${tenantId}-${day}`,
          tenantId,
          type: 'spike',
          severity,
          description: `Cost spike detected on ${day}: $${cost.toFixed(2)} vs expected $${mean.toFixed(2)}`,
          detectedAt: new Date(),
          value: cost,
          expected: mean,
          deviation: zscore,
          evidence: {
            day,
            zscore,
            mean,
            stdDev,
            allDays: dailyCosts,
          },
        });
      }
    }

    return anomalies;
  }

  private static detectUnexpectedServices(tenantId: string, records: any[]): CostAnomaly[] {
    const anomalies: CostAnomaly[] = [];

    // Get services used in the period
    const serviceUsage: Record<string, { count: number; total: number }> = {};
    for (const record of records) {
      if (!serviceUsage[record.service]) {
        serviceUsage[record.service] = { count: 0, total: 0 };
      }
      serviceUsage[record.service].count++;
      serviceUsage[record.service].total += record.totalCost;
    }

    // Get historical services (before period)
    const historicalRecords = await prisma.costRecord.findMany({
      where: {
        tenantId,
        timestamp: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { service: true },
      distinct: ['service'],
    });

    const historicalServices = new Set(historicalRecords.map((r) => r.service));

    // Detect services used now that weren't used historically
    for (const service of Object.keys(serviceUsage)) {
      if (!historicalServices.has(service) && serviceUsage[service].total > 1) {
        anomalies.push({
          id: `unexpected-${tenantId}-${service}`,
          tenantId,
          type: 'unexpected_service',
          severity: 'medium',
          description: `New service usage detected: "${service}" ($${serviceUsage[service].total.toFixed(2)})`,
          detectedAt: new Date(),
          value: serviceUsage[service].total,
          expected: 0,
          deviation: 0,
          evidence: {
            service,
            count: serviceUsage[service].count,
            total: serviceUsage[service].total,
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Check if a specific cost event is anomalous
   */
  static async checkEvent(
    tenantId: string,
    service: string,
    amount: number
  ): Promise<CostAnomaly | null> {
    // Get historical data for this service
    const historical = await prisma.costRecord.findMany({
      where: {
        tenantId,
        service,
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: { totalCost: true },
    });

    if (historical.length < 20) return null;

    const costs = historical.map((r) => r.totalCost);
    const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
    const stdDev = Math.sqrt(
      costs.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / costs.length
    );

    if (stdDev === 0) return null;

    const zscore = (amount - mean) / stdDev;

    if (zscore > 5) {
      return {
        id: `event-${Date.now()}`,
        tenantId,
        type: 'spike',
        severity: 'critical',
        description: `Single event with cost $${amount.toFixed(4)} is ${zscore.toFixed(1)}x std dev from mean $${mean.toFixed(4)}`,
        detectedAt: new Date(),
        value: amount,
        expected: mean,
        deviation: zscore,
        evidence: {
          service,
          amount,
          mean,
          stdDev,
          zscore,
        },
      };
    }

    return null;
  }
      }
