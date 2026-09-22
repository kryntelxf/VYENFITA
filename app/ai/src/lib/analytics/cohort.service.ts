/**
 * VYENFITA Cohort Analysis Service
 * 
 * Retention & behavior by user cohort.
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';

export interface CohortDefinition {
  id: string;
  tenantId: string;
  name: string;
  entryEvent: string; // Event that defines cohort entry
  returnEvent: string; // Event that defines "returning"
  periodDays: number; // Cohort period (weekly = 7, monthly = 30)
  startDate: Date;
  endDate: Date;
}

export interface CohortRetention {
  cohortDate: Date;
  cohortSize: number;
  periods: Array<{
    periodNumber: number;
    retained: number;
    retentionRate: number;
  }>;
}

export interface CohortAnalysis {
  entryEvent: string;
  returnEvent: string;
  periodDays: number;
  cohorts: CohortRetention[];
  averageRetention: {
    period0: number;
    period1: number;
    period2: number;
    period3: number;
  };
}

export class CohortService {
  /**
   * Analyze cohorts
   */
  static async analyze(input: CohortDefinition): Promise<CohortAnalysis> {
    const {
      tenantId,
      entryEvent,
      returnEvent,
      periodDays,
      startDate,
      endDate,
    } = input;

    // Get entry events
    const entryEvents = await prisma.analyticsEvent.findMany({
      where: {
        tenantId,
        eventName: entryEvent,
        timestamp: { gte: startDate, lte: endDate },
      },
    });

    // Group users by cohort (week/month of entry)
    const cohortMap = new Map<string, Set<string>>();
    const userEntryDate = new Map<string, Date>();

    for (const event of entryEvents) {
      const userId = event.userId || event.sessionId;
      if (!userId) continue;

      const cohortKey = this.getCohortKey(event.timestamp, periodDays);
      if (!cohortMap.has(cohortKey)) cohortMap.set(cohortKey, new Set());
      cohortMap.get(cohortKey)!.add(userId);
      userEntryDate.set(userId, event.timestamp);
    }

    // Analyze retention for each cohort
    const cohorts: CohortRetention[] = [];
    const maxPeriods = 8;

    for (const [cohortKey, users] of cohortMap) {
      const cohortDate = new Date(cohortKey);
      const periods: CohortRetention['periods'] = [];

      for (let period = 0; period < maxPeriods; period++) {
        const periodStart = new Date(cohortDate);
        periodStart.setDate(periodStart.getDate() + period * periodDays);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + periodDays);

        // Count retained users
        const returnedUsers = await prisma.analyticsEvent.findMany({
          where: {
            tenantId,
            eventName: returnEvent,
            userId: { in: Array.from(users) },
            timestamp: { gte: periodStart, lt: periodEnd },
          },
          distinct: ['userId'],
          select: { userId: true },
        });

        const retained = returnedUsers.length;
        periods.push({
          periodNumber: period,
          retained,
          retentionRate: users.size > 0 ? (retained / users.size) * 100 : 0,
        });
      }

      cohorts.push({
        cohortDate,
        cohortSize: users.size,
        periods,
      });
    }

    // Sort cohorts by date
    cohorts.sort((a, b) => a.cohortDate.getTime() - b.cohortDate.getTime());

    // Compute averages
    const averageRetention = {
      period0: this.average(cohorts.map((c) => c.periods[0]?.retentionRate || 0)),
      period1: this.average(cohorts.map((c) => c.periods[1]?.retentionRate || 0)),
      period2: this.average(cohorts.map((c) => c.periods[2]?.retentionRate || 0)),
      period3: this.average(cohorts.map((c) => c.periods[3]?.retentionRate || 0)),
    };

    return {
      entryEvent,
      returnEvent,
      periodDays,
      cohorts,
      averageRetention,
    };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static getCohortKey(date: Date, periodDays: number): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    // Truncate to period boundaries
    const dayOfYear = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000)
    );
    const periodIndex = Math.floor(dayOfYear / periodDays);

    const periodStart = new Date(d.getFullYear(), 0, 1);
    periodStart.setDate(periodStart.getDate() + periodIndex * periodDays);

    return periodStart.toISOString();
  }

  private static average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }
}

export default CohortService;
