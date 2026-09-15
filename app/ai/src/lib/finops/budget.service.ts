/**
 * VYENFITA Budget Service
 * 
 * Manages budgets per tenant/service with:
 * - Budget creation & updates
 * - Real-time spend tracking
 * - Threshold alerts
 * - Automatic enforcement (optional)
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { logger } from '../observability/logger';
import { auditService } from '../audit/audit.service';

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Budget {
  id: string;
  tenantId: string;
  service: string; // 'all' or specific service
  limit: number;
  spent: number;
  currency: string;
  period: BudgetPeriod;
  resetAt: Date;
  alertThresholds: number[]; // e.g., [50, 80, 100]
  enforce: boolean; // block requests when exceeded
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetStatus {
  budget: Budget;
  utilization: number; // percentage
  remaining: number;
  isExceeded: boolean;
  isNearLimit: boolean;
  triggeredThresholds: number[];
}

const BUDGET_PERIOD_MS: Record<BudgetPeriod, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  quarterly: 90 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

export class BudgetService {
  /**
   * Create a new budget
   */
  static async create(params: {
    tenantId: string;
    service?: string;
    limit: number;
    currency?: string;
    period: BudgetPeriod;
    alertThresholds?: number[];
    enforce?: boolean;
    createdBy: string;
  }): Promise<Budget> {
    const budgetId = uuidv4();
    const now = new Date();
    const resetAt = new Date(now.getTime() + BUDGET_PERIOD_MS[params.period]);

    // Store budget in Secret table (reusing for metadata storage)
    await prisma.secret.create({
      data: {
        id: budgetId,
        tenantId: params.tenantId,
        name: `budget:${budgetId}`,
        description: `Budget for ${params.service || 'all services'} - ${params.limit} ${params.currency || 'USD'} ${params.period}`,
        type: 'budget',
        provider: 'finops',
        metadata: {
          service: params.service || 'all',
          limit: params.limit,
          spent: 0,
          currency: params.currency || 'USD',
          period: params.period,
          resetAt: resetAt.toISOString(),
          alertThresholds: params.alertThresholds || [50, 80, 100],
          enforce: params.enforce ?? false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        } as any,
      },
    });

    await auditService.log({
      tenantId: params.tenantId,
      userId: params.createdBy,
      eventType: 'create',
      action: 'budget.create',
      resource: 'budget',
      resourceId: budgetId,
      details: {
        service: params.service || 'all',
        limit: params.limit,
        period: params.period,
      },
      status: 'success',
    });

    logger.info('Budget created', {
      budgetId,
      tenantId: params.tenantId,
      limit: params.limit,
      period: params.period,
    });

    return {
      id: budgetId,
      tenantId: params.tenantId,
      service: params.service || 'all',
      limit: params.limit,
      spent: 0,
      currency: params.currency || 'USD',
      period: params.period,
      resetAt,
      alertThresholds: params.alertThresholds || [50, 80, 100],
      enforce: params.enforce ?? false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get budget by ID
   */
  static async get(budgetId: string, tenantId: string): Promise<Budget | null> {
    const record = await prisma.secret.findFirst({
      where: {
        id: budgetId,
        tenantId,
        type: 'budget',
        deletedAt: null,
      },
    });

    if (!record) return null;

    const metadata = record.metadata as any;

    return {
      id: record.id,
      tenantId: record.tenantId,
      service: metadata.service,
      limit: metadata.limit,
      spent: metadata.spent || 0,
      currency: metadata.currency,
      period: metadata.period,
      resetAt: new Date(metadata.resetAt),
      alertThresholds: metadata.alertThresholds || [50, 80, 100],
      enforce: metadata.enforce ?? false,
      createdAt: new Date(metadata.createdAt),
      updatedAt: new Date(metadata.updatedAt),
    };
  }

  /**
   * List budgets for a tenant
   */
  static async list(tenantId: string): Promise<Budget[]> {
    const records = await prisma.secret.findMany({
      where: {
        tenantId,
        type: 'budget',
        deletedAt: null,
      },
    });

    return records.map((record) => {
      const metadata = record.metadata as any;
      return {
        id: record.id,
        tenantId: record.tenantId,
        service: metadata.service,
        limit: metadata.limit,
        spent: metadata.spent || 0,
        currency: metadata.currency,
        period: metadata.period,
        resetAt: new Date(metadata.resetAt),
        alertThresholds: metadata.alertThresholds || [50, 80, 100],
        enforce: metadata.enforce ?? false,
        createdAt: new Date(metadata.createdAt),
        updatedAt: new Date(metadata.updatedAt),
      };
    });
  }

  /**
   * Add spend to a budget (called after each cost recording)
   */
  static async addSpend(
    tenantId: string,
    service: string,
    amount: number
  ): Promise<void> {
    // Find budgets that match (either 'all' or specific service)
    const budgets = await this.list(tenantId);
    const matchingBudgets = budgets.filter(
      (b) => b.service === 'all' || b.service === service
    );

    for (const budget of matchingBudgets) {
      const newSpent = budget.spent + amount;

      // Update spent in metadata
      const record = await prisma.secret.findUnique({
        where: { id: budget.id },
      });

      if (record) {
        const metadata = record.metadata as any;
        await prisma.secret.update({
          where: { id: budget.id },
          data: {
            metadata: {
              ...metadata,
              spent: newSpent,
              updatedAt: new Date().toISOString(),
            } as any,
          },
        });
      }

      // Check thresholds
      const utilization = (newSpent / budget.limit) * 100;

      for (const threshold of budget.alertThresholds) {
        if (utilization >= threshold) {
          logger.warn('Budget threshold triggered', {
            budgetId: budget.id,
            tenantId,
            threshold,
            utilization: utilization.toFixed(1),
            spent: newSpent,
            limit: budget.limit,
          });

          await auditService.log({
            tenantId,
            eventType: 'security',
            action: 'budget.threshold_reached',
            resource: 'budget',
            resourceId: budget.id,
            details: {
              threshold,
              utilization,
              spent: newSpent,
              limit: budget.limit,
              service: budget.service,
            },
            status: 'success',
          });
        }
      }

      // Check if exceeded
      if (newSpent > budget.limit) {
        logger.error('Budget exceeded', {
          budgetId: budget.id,
          tenantId,
          spent: newSpent,
          limit: budget.limit,
        });

        await auditService.log({
          tenantId,
          eventType: 'security',
          action: 'budget.exceeded',
          resource: 'budget',
          resourceId: budget.id,
          details: {
            spent: newSpent,
            limit: budget.limit,
            service: budget.service,
          },
          status: 'failure',
        });
      }
    }
  }

  /**
   * Check if a request should be allowed based on budget
   */
  static async checkAllowance(
    tenantId: string,
    service: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const budgets = await this.list(tenantId);
    const matchingBudgets = budgets.filter(
      (b) => b.service === 'all' || b.service === service
    );

    for (const budget of matchingBudgets) {
      if (!budget.enforce) continue;

      if (budget.spent >= budget.limit) {
        return {
          allowed: false,
          reason: `Budget exceeded for ${budget.service} (${budget.spent.toFixed(2)}/${budget.limit} ${budget.currency})`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get budget status
   */
  static async getStatus(budgetId: string, tenantId: string): Promise<BudgetStatus | null> {
    const budget = await this.get(budgetId, tenantId);
    if (!budget) return null;

    const utilization = (budget.spent / budget.limit) * 100;
    const remaining = Math.max(0, budget.limit - budget.spent);
    const isExceeded = budget.spent > budget.limit;
    const isNearLimit = utilization >= 80;

    const triggeredThresholds = budget.alertThresholds.filter(
      (t) => utilization >= t
    );

    return {
      budget,
      utilization,
      remaining,
      isExceeded,
      isNearLimit,
      triggeredThresholds,
    };
  }

  /**
   * Reset budgets that have passed their reset date
   */
  static async resetExpiredBudgets(): Promise<number> {
    const records = await prisma.secret.findMany({
      where: {
        type: 'budget',
        deletedAt: null,
      },
    });

    let resetCount = 0;
    const now = new Date();

    for (const record of records) {
      const metadata = record.metadata as any;
      const resetAt = new Date(metadata.resetAt);

      if (resetAt <= now) {
        const newResetAt = new Date(
          now.getTime() + BUDGET_PERIOD_MS[metadata.period as BudgetPeriod]
        );

        await prisma.secret.update({
          where: { id: record.id },
          data: {
            metadata: {
              ...metadata,
              spent: 0,
              resetAt: newResetAt.toISOString(),
              updatedAt: now.toISOString(),
            } as any,
          },
        });

        resetCount++;
      }
    }

    if (resetCount > 0) {
      logger.info(`Reset ${resetCount} expired budget(s)`);
    }

    return resetCount;
  }

  /**
   * Delete a budget
   */
  static async delete(budgetId: string, tenantId: string, deletedBy: string): Promise<boolean> {
    const budget = await this.get(budgetId, tenantId);
    if (!budget) return false;

    await prisma.secret.update({
      where: { id: budgetId },
      data: { deletedAt: new Date() },
    });

    await auditService.log({
      tenantId,
      userId: deletedBy,
      eventType: 'delete',
      action: 'budget.delete',
      resource: 'budget',
      resourceId: budgetId,
      status: 'success',
    });

    return true;
  }
  }
