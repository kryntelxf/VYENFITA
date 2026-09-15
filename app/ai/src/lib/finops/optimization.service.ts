/**
 * VYENFITA Cost Optimization Service
 * 
 * Analyzes usage data and generates actionable recommendations:
 * - Cache opportunities
 * - Model downgrades
 * - Batching opportunities
 * - Unused resource identification
 * - Redundancy removal
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { CostAttributionService } from './cost-attribution.service';
import { BudgetService } from './budget.service';

export interface OptimizationRecommendation {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  estimatedMonthlySavings: number;
  estimatedSavingsPercentage: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: number; // 1-10, higher = more important
  category: 'caching' | 'model_selection' | 'batching' | 'cleanup' | 'architecture';
  actionRequired: string;
  evidence: Record<string, any>;
}

export class OptimizationService {
  /**
   * Generate recommendations for a tenant
   */
  static async generateRecommendations(
    tenantId: string,
    days: number = 30
  ): Promise<OptimizationRecommendation[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const recommendations: OptimizationRecommendation[] = [];

    // 1. Analyze AI cost (biggest lever usually)
    recommendations.push(...(await this.analyzeAICosts(tenantId, startDate, endDate)));

    // 2. Analyze usage patterns for caching
    recommendations.push(...(await this.analyzeCachingOpportunities(tenantId, startDate, endDate)));

    // 3. Detect unused budgets/resources
    recommendations.push(...(await this.analyzeBudgets(tenantId)));

    // 4. Detect unusual patterns (spikes, waste)
    recommendations.push(...(await this.analyzeSpikes(tenantId, startDate, endDate)));

    // Sort by priority (highest first)
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  // ============================================================
  // PRIVATE ANALYSIS FUNCTIONS
  // ============================================================

  private static async analyzeAICosts(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    const aiRecords = await prisma.costRecord.findMany({
      where: {
        tenantId,
        service: { in: ['ai_openai', 'ai_anthropic', 'ai_other'] },
        timestamp: { gte: startDate, lte: endDate },
      },
    });

    if (aiRecords.length === 0) return recommendations;

    const totalAICost = aiRecords.reduce((sum, r) => sum + r.totalCost, 0);
    const averageCost = totalAICost / aiRecords.length;

    // Detect high-cost requests
    const expensiveRequests = aiRecords.filter((r) => r.totalCost > averageCost * 5);

    if (expensiveRequests.length > 10) {
      const savings = expensiveRequests.reduce((sum, r) => sum + r.totalCost * 0.3, 0);

      recommendations.push({
        id: 'ai-cost-optimization',
        tenantId,
        title: 'Reduce high-cost AI requests',
        description: `Detected ${expensiveRequests.length} AI requests that cost 5x the average. Consider using a smaller model for these requests or implementing request caching.`,
        estimatedMonthlySavings: savings * (30 / 30),
        estimatedSavingsPercentage: (savings / totalAICost) * 100,
        effort: 'medium',
        impact: 'high',
        priority: 9,
        category: 'model_selection',
        actionRequired: 'Review high-cost requests and identify which can use cheaper models',
        evidence: {
          totalAICost,
          averageCost,
          expensiveRequestCount: expensiveRequests.length,
          topCosts: expensiveRequests.slice(0, 5).map((r) => r.totalCost),
        },
      });
    }

    // Detect opportunity to switch to cheaper model
    const openaiRecords = aiRecords.filter((r) => r.service === 'ai_openai');
    const anthropicRecords = aiRecords.filter((r) => r.service === 'ai_anthropic');

    if (openaiRecords.length > anthropicRecords.length * 2) {
      recommendations.push({
        id: 'multi-provider-strategy',
        tenantId,
        title: 'Diversify AI providers',
        description: `You're heavily dependent on OpenAI (${openaiRecords.length} vs ${anthropicRecords.length} requests). Consider distributing to reduce risk and potentially optimize costs.`,
        estimatedMonthlySavings: totalAICost * 0.1,
        estimatedSavingsPercentage: 10,
        effort: 'medium',
        impact: 'medium',
        priority: 6,
        category: 'model_selection',
        actionRequired: 'Evaluate Anthropic for suitable workloads',
        evidence: {
          openaiRequests: openaiRecords.length,
          anthropicRequests: anthropicRecords.length,
        },
      });
    }

    return recommendations;
  }

  private static async analyzeCachingOpportunities(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Find repeated operations
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        tenantId,
        timestamp: { gte: startDate, lte: endDate },
      },
    });

    if (usageRecords.length < 100) return recommendations;

    // Group by operation and hash of metadata (simplified)
    const operationCounts: Record<string, number> = {};

    for (const record of usageRecords) {
      const key = `${record.service}:${record.operation}`;
      operationCounts[key] = (operationCounts[key] || 0) + 1;
    }

    const totalOps = Object.values(operationCounts).reduce((a, b) => a + b, 0);

    // Detect operations that might benefit from caching
    for (const [operation, count] of Object.entries(operationCounts)) {
      if (count > totalOps * 0.3) {
        const record = usageRecords.find(
          (r) => `${r.service}:${r.operation}` === operation
        );

        if (!record) continue;

        const potentialSavings = 0.5; // Assume 50% cache hit rate

        recommendations.push({
          id: `cache-${operation}`,
          tenantId,
          title: `Enable caching for "${operation}"`,
          description: `Operation "${operation}" accounts for ${((count / totalOps) * 100).toFixed(1)}% of all operations. Enable response caching to reduce duplicate work.`,
          estimatedMonthlySavings: 0,
          estimatedSavingsPercentage: potentialSavings * 100,
          effort: 'low',
          impact: 'high',
          priority: 8,
          category: 'caching',
          actionRequired: 'Enable response caching in AI service configuration',
          evidence: {
            operation,
            count,
            totalOps,
            percentageOfTotal: (count / totalOps) * 100,
          },
        });
      }
    }

    return recommendations;
  }

  private static async analyzeBudgets(tenantId: string): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    const budgets = await BudgetService.list(tenantId);

    if (budgets.length === 0) {
      recommendations.push({
        id: 'no-budgets-configured',
        tenantId,
        title: 'No budgets configured',
        description:
          'You have no spending budgets configured. This exposes you to unexpected costs. Set up budgets with alert thresholds to prevent overspend.',
        estimatedMonthlySavings: 0,
        estimatedSavingsPercentage: 0,
        effort: 'low',
        impact: 'high',
        priority: 10,
        category: 'cleanup',
        actionRequired: 'Create budgets for AI, compute, storage services',
        evidence: { budgetCount: 0 },
      });

      return recommendations;
    }

    // Check for budgets with low utilization (over-provisioned)
    for (const budget of budgets) {
      const utilization = (budget.spent / budget.limit) * 100;

      if (utilization < 20 && budget.limit > 100) {
        recommendations.push({
          id: `overprovisioned-${budget.id}`,
          tenantId,
          title: `Budget "${budget.service}" is over-provisioned`,
          description: `Budget for "${budget.service}" has only ${utilization.toFixed(1)}% utilization (${budget.spent.toFixed(2)}/${budget.limit}). Consider reducing the limit or reallocating.`,
          estimatedMonthlySavings: 0,
          estimatedSavingsPercentage: 0,
          effort: 'low',
          impact: 'low',
          priority: 4,
          category: 'cleanup',
          actionRequired: 'Review and adjust budget limit',
          evidence: {
            budgetId: budget.id,
            service: budget.service,
            utilization,
            spent: budget.spent,
            limit: budget.limit,
          },
        });
      }
    }

    return recommendations;
  }

  private static async analyzeSpikes(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    const breakdown = await CostAttributionService.getBreakdown(
      tenantId,
      startDate,
      endDate
    );

    const dailyCosts = Object.values(breakdown.byDay);

    if (dailyCosts.length < 7) return recommendations;

    const average = dailyCosts.reduce((a, b) => a + b, 0) / dailyCosts.length;
    const stdDev = Math.sqrt(
      dailyCosts.reduce((sum, cost) => sum + Math.pow(cost - average, 2), 0) / dailyCosts.length
    );

    // Find days with cost > 2x standard deviation above mean
    const spikes = Object.entries(breakdown.byDay).filter(
      ([, cost]) => cost > average + 2 * stdDev
    );

    if (spikes.length > 0) {
      const spikeCost = spikes.reduce((sum, [, cost]) => sum + (cost - average), 0);

      recommendations.push({
        id: 'cost-spike-detected',
        tenantId,
        title: 'Unusual cost spikes detected',
        description: `Detected ${spikes.length} days with abnormally high costs. Investigate the cause to prevent recurring overages.`,
        estimatedMonthlySavings: spikeCost,
        estimatedSavingsPercentage: (spikeCost / breakdown.total) * 100,
        effort: 'medium',
        impact: 'medium',
        priority: 7,
        category: 'architecture',
        actionRequired: 'Investigate cost spike causes and add safeguards',
        evidence: {
          spikeDays: spikes.map(([day, cost]) => ({ day, cost })),
          average,
          stdDev,
        },
      });
    }

    return recommendations;
  }
  }
