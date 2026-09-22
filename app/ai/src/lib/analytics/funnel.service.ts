/**
 * VYENFITA Funnel Analysis Service
 * 
 * Conversion funnel tracking & analysis.
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { logger } from '../observability/logger';

export interface FunnelStep {
  id: string;
  name: string;
  event: string;
  filters?: Record<string, any>;
}

export interface FunnelDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  steps: FunnelStep[];
  windowHours: number; // Time window for completing the funnel
  createdAt: Date;
  updatedAt: Date;
}

export interface FunnelAnalysis {
  funnelId: string;
  totalEntered: number;
  totalConverted: number;
  conversionRate: number;
  steps: Array<{
    id: string;
    name: string;
    count: number;
    percentOfTotal: number;
    percentFromPrevious: number;
    dropoffCount: number;
    dropoffPercent: number;
  }>;
  averageTimeToConvert?: number; // seconds
}

export class FunnelService {
  /**
   * Create funnel definition
   */
  static async create(input: {
    tenantId: string;
    name: string;
    description: string;
    steps: FunnelStep[];
    windowHours?: number;
  }): Promise<FunnelDefinition> {
    const funnel = await prisma.funnel.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        steps: input.steps as any,
        windowHours: input.windowHours || 24,
      },
    });

    logger.info('Funnel created', { funnelId: funnel.id, name: input.name });

    return funnel as any;
  }

  /**
   * Analyze funnel for a time period
   */
  static async analyze(
    funnelId: string,
    tenantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<FunnelAnalysis> {
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, tenantId },
    });

    if (!funnel) throw new Error('Funnel not found');

    const steps = funnel.steps as unknown as FunnelStep[];

    // Get all events in the time window
    const events = await prisma.analyticsEvent.findMany({
      where: {
        tenantId,
        timestamp: { gte: startTime, lte: endTime },
        eventName: { in: steps.map((s) => s.event) },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group events by session/user
    const userEvents = new Map<string, typeof events>();
    for (const event of events) {
      const userId = event.userId || event.sessionId || 'anonymous';
      if (!userEvents.has(userId)) userEvents.set(userId, []);
      userEvents.get(userId)!.push(event);
    }

    // Count conversions at each step
    const stepCounts: number[] = new Array(steps.length).fill(0);
    let totalTimeToConvert = 0;
    let convertedUsers = 0;

    for (const [, userEventList] of userEvents) {
      let currentStep = 0;
      let firstEventTime: number | null = null;

      for (const event of userEventList) {
        if (currentStep >= steps.length) break;

        const expectedEvent = steps[currentStep].event;
        if (event.eventName === expectedEvent) {
          if (currentStep === 0) {
            firstEventTime = event.timestamp.getTime();
          }
          stepCounts[currentStep]++;
          currentStep++;
        }
      }

      // If completed all steps
      if (currentStep === steps.length && firstEventTime) {
        const lastEvent = userEventList[userEventList.length - 1];
        const lastTime = lastEvent.timestamp.getTime();
        totalTimeToConvert += (lastTime - firstEventTime) / 1000;
        convertedUsers++;
      }
    }

    const totalEntered = stepCounts[0] || 0;
    const totalConverted = stepCounts[steps.length - 1] || 0;

    const analysis: FunnelAnalysis = {
      funnelId,
      totalEntered,
      totalConverted,
      conversionRate: totalEntered > 0 ? (totalConverted / totalEntered) * 100 : 0,
      steps: steps.map((step, i) => {
        const count = stepCounts[i];
        const previousCount = i === 0 ? count : stepCounts[i - 1];
        const dropoffCount = previousCount - count;

        return {
          id: step.id,
          name: step.name,
          count,
          percentOfTotal: totalEntered > 0 ? (count / totalEntered) * 100 : 0,
          percentFromPrevious: previousCount > 0 ? (count / previousCount) * 100 : 0,
          dropoffCount,
          dropoffPercent: previousCount > 0 ? (dropoffCount / previousCount) * 100 : 0,
        };
      }),
      averageTimeToConvert: convertedUsers > 0 ? totalTimeToConvert / convertedUsers : undefined,
    };

    return analysis;
  }

  /**
   * List funnels for tenant
   */
  static async list(tenantId: string): Promise<FunnelDefinition[]> {
    const funnels = await prisma.funnel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return funnels as any;
  }
}

export default FunnelService;
