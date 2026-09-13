/**
 * VYENFITA Cost Management Service
 * 
 * @version 1.0.1
 */

import { v4 as uuidv4 } from 'uuid';

export interface CostRecord {
  id: string;
  tenantId: string;
  userId: string;
  service: 'openai' | 'anthropic' | 'compute' | 'storage' | 'networking' | 'other';
  operation: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface Budget {
  id: string;
  tenantId: string;
  service: string;
  limit: number;
  used: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  resetAt: Date;
  alertThreshold: number;
  alerts: BudgetAlert[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAlert {
  id: string;
  budgetId: string;
  threshold: number;
  triggeredAt: Date;
  message: string;
  status: 'active' | 'resolved';
}

export interface CostOptimizationRecommendation {
  id: string;
  service: string;
  title: string;
  description: string;
  estimatedSavings: number;
  impact: 'low' | 'medium' | 'high';
  implementation: string;
  status: 'pending' | 'applied' | 'dismissed';
}

export class CostManagementService {
  private costRecords: Map<string, CostRecord>;
  private budgets: Map<string, Budget>;
  private recommendations: Map<string, CostOptimizationRecommendation>;

  constructor() {
    this.costRecords = new Map();
    this.budgets = new Map();
    this.recommendations = new Map();
  }

  recordCost(
    tenantId: string,
    userId: string,
    service: CostRecord['service'],
    operation: string,
    quantity: number,
    unitCost: number
  ): CostRecord {
    const record: CostRecord = {
      id: uuidv4(),
      tenantId,
      userId,
      service,
      operation,
      quantity,
      unitCost,
      totalCost: quantity * unitCost,
      timestamp: new Date(),
      metadata: {},
    };

    this.costRecords.set(record.id, record);
    this.checkBudgets(tenantId, service, record.totalCost);

    return record;
  }

  getCostRecords(
    tenantId: string,
    service?: string,
    timeRange?: { start: Date; end: Date }
  ): CostRecord[] {
    const result: CostRecord[] = [];
    for (const record of this.costRecords.values()) {
      if (record.tenantId !== tenantId) continue;
      if (service && record.service !== service) continue;
      if (timeRange) {
        if (record.timestamp < timeRange.start || record.timestamp > timeRange.end) continue;
      }
      result.push(record);
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getCostSummary(
    tenantId: string,
    timeRange?: { start: Date; end: Date }
  ): {
    total: number;
    byService: Record<string, number>;
    byUser: Record<string, number>;
    byOperation: Record<string, number>;
    daily: Record<string, number>;
  } {
    const records = this.getCostRecords(tenantId, undefined, timeRange);
    const summary = {
      total: 0,
      byService: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      byOperation: {} as Record<string, number>,
      daily: {} as Record<string, number>,
    };

    for (const record of records) {
      summary.total += record.totalCost;
      summary.byService[record.service] = (summary.byService[record.service] || 0) + record.totalCost;
      summary.byUser[record.userId] = (summary.byUser[record.userId] || 0) + record.totalCost;
      summary.byOperation[record.operation] = (summary.byOperation[record.operation] || 0) + record.totalCost;

      const day = record.timestamp.toDateString();
      summary.daily[day] = (summary.daily[day] || 0) + record.totalCost;
    }

    return summary;
  }

  createBudget(
    tenantId: string,
    service: string,
    limit: number,
    period: Budget['period'],
    alertThreshold: number = 80
  ): Budget {
    const budget: Budget = {
      id: uuidv4(),
      tenantId,
      service,
      limit,
      used: 0,
      period,
      resetAt: this.getNextResetDate(period),
      alertThreshold,
      alerts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.budgets.set(budget.id, budget);
    return budget;
  }

  updateBudget(id: string, updates: Partial<Budget>): Budget | undefined {
    const budget = this.budgets.get(id);
    if (!budget) return undefined;

    Object.assign(budget, updates);
    budget.updatedAt = new Date();
    this.budgets.set(id, budget);
    return budget;
  }

  getBudgets(tenantId: string): Budget[] {
    const result: Budget[] = [];
    for (const budget of this.budgets.values()) {
      if (budget.tenantId === tenantId) {
        result.push(budget);
      }
    }
    return result;
  }

  private checkBudgets(tenantId: string, service: string, cost: number): void {
    const budgets = this.getBudgets(tenantId).filter(
      (b) => b.service === service || b.service === 'all'
    );

    for (const budget of budgets) {
      budget.used += cost;

      if (budget.used > budget.limit) {
        this.triggerAlert(
          budget.id,
          `Budget exceeded for ${budget.service}: ${budget.used} / ${budget.limit}`
        );
      }

      const usagePercent = (budget.used / budget.limit) * 100;
      if (usagePercent >= budget.alertThreshold) {
        this.triggerAlert(
          budget.id,
          `Budget ${usagePercent.toFixed(1)}% used for ${budget.service}: ${budget.used} / ${budget.limit}`
        );
      }

      if (new Date() > budget.resetAt) {
        budget.used = 0;
        budget.resetAt = this.getNextResetDate(budget.period);
        budget.alerts = [];
      }

      this.budgets.set(budget.id, budget);
    }
  }

  private triggerAlert(budgetId: string, message: string): void {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    const alert: BudgetAlert = {
      id: uuidv4(),
      budgetId,
      threshold: (budget.used / budget.limit) * 100,
      triggeredAt: new Date(),
      message,
      status: 'active',
    };

    budget.alerts.push(alert);
    this.budgets.set(budgetId, budget);
  }

  private getNextResetDate(period: Budget['period']): Date {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.setHours(24, 0, 0, 0));
      case 'weekly':
        return new Date(now.setDate(now.getDate() + (7 - now.getDay())));
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() + 1, 1));
      case 'quarterly':
        return new Date(now.setMonth(now.getMonth() + 3, 1));
      case 'yearly':
        return new Date(now.setFullYear(now.getFullYear() + 1, 0, 1));
      default:
        return new Date(now.setMonth(now.getMonth() + 1, 1));
    }
  }

  generateRecommendations(tenantId: string): CostOptimizationRecommendation[] {
    const records = this.getCostRecords(tenantId);
    const recommendations: CostOptimizationRecommendation[] = [];

    const openAICosts = records.filter((r) => r.service === 'openai');
    if (openAICosts.length > 0) {
      const totalOpenAICost = openAICosts.reduce((sum, r) => sum + r.totalCost, 0);
      if (totalOpenAICost > 100) {
        recommendations.push({
          id: uuidv4(),
          service: 'openai',
          title: 'Use cached responses for similar queries',
          description: 'Enable response caching to reduce API calls for repeated queries.',
          estimatedSavings: totalOpenAICost * 0.3,
          impact: 'high',
          implementation: 'Enable caching in AI service configuration',
          status: 'pending',
        });
      }
    }

    const storageCosts = records.filter((r) => r.service === 'storage');
    if (storageCosts.length > 0) {
      recommendations.push({
        id: uuidv4(),
        service: 'storage',
        title: 'Implement data retention policy',
        description: 'Clean up old data to reduce storage costs.',
        estimatedSavings: storageCosts.reduce((sum, r) => sum + r.totalCost, 0) * 0.2,
        impact: 'medium',
        implementation: 'Configure data retention policy with auto-deletion',
        status: 'pending',
      });
    }

    const budgets = this.getBudgets(tenantId);
    if (budgets.length === 0) {
      recommendations.push({
        id: uuidv4(),
        service: 'all',
        title: 'Set up budget alerts',
        description: 'Create budgets to track and control spending across services.',
        estimatedSavings: 0,
        impact: 'medium',
        implementation: 'Create budgets with alert thresholds',
        status: 'pending',
      });
    }

    for (const rec of recommendations) {
      this.recommendations.set(rec.id, rec);
    }

    return recommendations;
  }

  applyRecommendation(id: string): boolean {
    const recommendation = this.recommendations.get(id);
    if (!recommendation) return false;

    recommendation.status = 'applied';
    this.recommendations.set(id, recommendation);
    return true;
  }

  /**
   * Get all recommendations
   * 
   * @param _tenantId - Tenant ID (reserved for future filtering)
   */
  getRecommendations(_tenantId: string): CostOptimizationRecommendation[] {
    return Array.from(this.recommendations.values());
  }
  }
