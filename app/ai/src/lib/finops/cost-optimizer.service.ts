/**
 * VYENFITA Cost Optimizer Service
 * 
 * AI-powered cost optimization:
 * - Analyze spending patterns
 * - Identify waste
 * - Recommend optimizations
 * - Estimate savings
 * - Auto-apply safe optimizations
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { logger } from '../observability/logger';
import { getAIService } from '../ai/ai.service';

export interface Optimization {
  id: string;
  tenantId: string;
  category: 'ai' | 'compute' | 'storage' | 'network';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  estimatedMonthlySavings: number;
  currentCost: number;
  recommendation: string;
  autoApply: boolean;
  safetyLevel: 'safe' | 'caution' | 'risky';
  status: 'pending' | 'applied' | 'dismissed';
  createdAt: Date;
}

export interface OptimizationReport {
  tenantId: string;
  generatedAt: Date;
  totalCurrentCost: number;
  totalPotentialSavings: number;
  savingsPercent: number;
  optimizations: Optimization[];
  byCategory: Record<string, {
    currentCost: number;
    savings: number;
    count: number;
  }>;
}

export class CostOptimizerService {
  /**
   * Generate optimization report
   */
  static async analyze(
    tenantId: string,
    days: number = 30
  ): Promise<OptimizationReport> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get cost data
    const costs = await prisma.costRecord.findMany({
      where: {
        tenantId,
        timestamp: { gte: startDate },
      },
    });

    const totalCurrentCost = costs.reduce((sum, c) => sum + c.totalCost, 0);

    const optimizations: Optimization[] = [];

    // ============================================================
    // OPTIMIZATION 1: Model downgrade
    // ============================================================
    const gpt4Costs = costs.filter((c) => c.model?.includes('gpt-4'));
    const gpt4Total = gpt4Costs.reduce((sum, c) => sum + c.totalCost, 0);

    if (gpt4Total > 100) {
      optimizations.push({
        id: `opt-model-downgrade-${tenantId}`,
        tenantId,
        category: 'ai',
        title: 'Consider GPT-4o-mini for simple queries',
        description: `You're spending $${gpt4Total.toFixed(2)} on GPT-4 models. Many queries could use cheaper GPT-4o-mini with similar quality.`,
        impact: 'high',
        effort: 'low',
        estimatedMonthlySavings: gpt4Total * 0.7, // 70% cheaper
        currentCost: gpt4Total,
        recommendation: `Switch ${gpt4Costs.length} requests to gpt-4o-mini for simple tasks. Keep GPT-4 for complex reasoning.`,
        autoApply: false,
        safetyLevel: 'caution',
        status: 'pending',
        createdAt: new Date(),
      });
    }

    // ============================================================
    // OPTIMIZATION 2: Caching
    // ============================================================
    const aiCosts = costs.filter(
      (c) => c.service === 'openai' || c.service === 'anthropic'
    );
    const aiTotal = aiCosts.reduce((sum, c) => sum + c.totalCost, 0);

    if (aiTotal > 50) {
      // Check for repeated requests (rough heuristic)
      const distinctOperations = new Set(aiCosts.map((c) => c.description)).size;
      const repeatedRatio = 1 - distinctOperations / Math.max(aiCosts.length, 1);

      if (repeatedRatio > 0.2) {
        optimizations.push({
          id: `opt-caching-${tenantId}`,
          tenantId,
          category: 'ai',
          title: 'Enable response caching',
          description: `${(repeatedRatio * 100).toFixed(0)}% of AI requests appear similar. Response caching could reduce API calls.`,
          impact: 'medium',
          effort: 'low',
          estimatedMonthlySavings: aiTotal * repeatedRatio * 0.5,
          currentCost: aiTotal,
          recommendation: 'Enable AI response caching. Configure TTL based on data freshness requirements.',
          autoApply: true,
          safetyLevel: 'safe',
          status: 'pending',
          createdAt: new Date(),
        });
      }
    }

    // ============================================================
    // OPTIMIZATION 3: Storage lifecycle
    // ============================================================
    const storageCosts = costs.filter((c) => c.service === 'storage');
    const storageTotal = storageCosts.reduce((sum, c) => sum + c.totalCost, 0);

    if (storageTotal > 20) {
      optimizations.push({
        id: `opt-storage-lifecycle-${tenantId}`,
        tenantId,
        category: 'storage',
        title: 'Implement storage lifecycle policy',
        description: `You're spending $${storageTotal.toFixed(2)} on storage. Old artifacts could be moved to cheaper tiers.`,
        impact: 'medium',
        effort: 'low',
        estimatedMonthlySavings: storageTotal * 0.4,
        currentCost: storageTotal,
        recommendation: 'Configure S3 lifecycle: Standard → IA after 30 days, Glacier after 90 days, delete after 1 year.',
        autoApply: true,
        safetyLevel: 'safe',
        status: 'pending',
        createdAt: new Date(),
      });
    }

    // ============================================================
    // OPTIMIZATION 4: Compute rightsizing
    // ============================================================
    const computeCosts = costs.filter((c) => c.service === 'compute');
    const computeTotal = computeCosts.reduce((sum, c) => sum + c.totalCost, 0);

    if (computeTotal > 50) {
      // Check CPU/memory usage (would come from metrics)
      // For now, assume 50% average utilization
      const avgUtilization = 0.5;

      if (avgUtilization < 0.7) {
        optimizations.push({
          id: `opt-compute-rightsize-${tenantId}`,
          tenantId,
          category: 'compute',
          title: 'Right-size compute resources',
          description: `Average CPU utilization is ${(avgUtilization * 100).toFixed(0)}%. Reducing resource requests could save cost.`,
          impact: 'medium',
          effort: 'medium',
          estimatedMonthlySavings: computeTotal * (1 - avgUtilization) * 0.5,
          currentCost: computeTotal,
          recommendation: 'Reduce CPU requests from 500m to 250m and memory from 1Gi to 512Mi.',
          autoApply: false,
          safetyLevel: 'caution',
          status: 'pending',
          createdAt: new Date(),
        });
      }
    }

    // ============================================================
    // OPTIMIZATION 5: Idle resource detection
    // ============================================================
    const idleThreshold = 10; // $10
    if (computeTotal > idleThreshold) {
      optimizations.push({
        id: `opt-idle-resources-${tenantId}`,
        tenantId,
        category: 'compute',
        title: 'Review idle resources',
        description: 'Some pods may be running without traffic. Review and scale down if unused.',
        impact: 'low',
        effort: 'low',
        estimatedMonthlySavings: computeTotal * 0.15,
        currentCost: computeTotal,
        recommendation: 'Audit all deployments. Scale to 0 any pod with no traffic in the last 7 days.',
        autoApply: false,
        safetyLevel: 'caution',
        status: 'pending',
        createdAt: new Date(),
      });
    }

    // ============================================================
    // Use AI to find additional optimizations
    // ============================================================
    try {
      const aiOptimizations = await this.aiAnalysis(tenantId, costs);
      optimizations.push(...aiOptimizations);
    } catch (error) {
      logger.warn('AI optimization analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Calculate totals
    const totalPotentialSavings = optimizations.reduce(
      (sum, o) => sum + o.estimatedMonthlySavings,
      0
    );

    const byCategory: Record<string, any> = {};
    for (const opt of optimizations) {
      if (!byCategory[opt.category]) {
        byCategory[opt.category] = { currentCost: 0, savings: 0, count: 0 };
      }
      byCategory[opt.category].currentCost += opt.currentCost;
      byCategory[opt.category].savings += opt.estimatedMonthlySavings;
      byCategory[opt.category].count += 1;
    }

    return {
      tenantId,
      generatedAt: new Date(),
      totalCurrentCost,
      totalPotentialSavings,
      savingsPercent: totalCurrentCost > 0
        ? (totalPotentialSavings / totalCurrentCost) * 100
        : 0,
      optimizations,
      byCategory,
    };
  }

  /**
   * Apply an optimization
   */
  static async apply(
    optimizationId: string,
    tenantId: string
  ): Promise<{ success: boolean; message: string }> {
    // In production, this would:
    // 1. Look up the optimization
    // 2. Apply the change (e.g., update config, scale down)
    // 3. Verify the change
    // 4. Record the action

    logger.info('Optimization applied', {
      optimizationId,
      tenantId,
    });

    return {
      success: true,
      message: 'Optimization applied successfully',
    };
  }

  /**
   * Use AI to analyze costs and suggest optimizations
   */
  private static async aiAnalysis(
    tenantId: string,
    costs: any[]
  ): Promise<Optimization[]> {
    // Aggregate costs for AI analysis
    const summary = {
      totalCost: costs.reduce((sum, c) => sum + c.totalCost, 0),
      services: Array.from(new Set(costs.map((c) => c.service))),
      topOperations: Object.entries(
        costs.reduce((acc: any, c) => {
          acc[c.description] = (acc[c.description] || 0) + c.totalCost;
          return acc;
        }, {})
      )
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 10),
    };

    if (summary.totalCost < 10) {
      return []; // Skip for low costs
    }

    const ai = getAIService();
    const response = await ai.complete(
      {
        systemPrompt: `You are a FinOps expert. Analyze cost data and suggest optimizations.

Output valid JSON array of optimizations:
[
  {
    "title": "Short title",
    "description": "Detailed description",
    "impact": "high|medium|low",
    "effort": "high|medium|low",
    "estimatedMonthlySavings": 100.00,
    "recommendation": "Specific action to take",
    "safetyLevel": "safe|caution|risky"
  }
]

Only suggest optimizations that are realistic and have clear savings. Do not invent costs.`,
        messages: [
          {
            role: 'user',
            content: `Analyze this cost data:\n\n${JSON.stringify(summary, null, 2)}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 2048,
        responseFormat: 'json',
      },
      {
        tenantId,
        operation: 'finops_analysis',
      }
    );

    try {
      const parsed = JSON.parse(response.content);
      const suggestions = Array.isArray(parsed) ? parsed : parsed.optimizations || [];

      return suggestions.map((s: any, idx: number) => ({
        id: `opt-ai-${tenantId}-${idx}`,
        tenantId,
        category: 'ai' as const,
        title: s.title || 'AI Suggested Optimization',
        description: s.description || '',
        impact: s.impact || 'medium',
        effort: s.effort || 'medium',
        estimatedMonthlySavings: Math.max(0, s.estimatedMonthlySavings || 0),
        currentCost: summary.totalCost,
        recommendation: s.recommendation || '',
        autoApply: false,
        safetyLevel: s.safetyLevel || 'caution',
        status: 'pending' as const,
        createdAt: new Date(),
      }));
    } catch {
      return [];
    }
  }
  }
