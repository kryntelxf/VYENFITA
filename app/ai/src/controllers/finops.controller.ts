/**
 * VYENFITA FinOps Controller
 * 
 * Endpoints for cost management, budget, and optimization.
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { CostAttributionService } from '../lib/finops/cost-attribution.service';
import { BudgetService } from '../lib/finops/budget.service';
import { OptimizationService } from '../lib/finops/optimization.service';
import { AnomalyDetectionService } from '../lib/finops/anomaly-detection.service';

export class FinOpsController {
  // ============================================================
  // COST BREAKDOWN
  // ============================================================

  /**
   * Get cost breakdown
   * GET /api/v1/finops/costs
   */
  async getCosts(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { startDate, endDate } = req.query;

      const start = startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const breakdown = await CostAttributionService.getBreakdown(
        req.user.tenantId,
        start,
        end
      );

      res.json({
        success: true,
        data: breakdown,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  /**
   * Get monthly trend
   * GET /api/v1/finops/costs/trend
   */
  async getTrend(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { months } = req.query;
      const monthsNum = months ? parseInt(months as string, 10) : 6;

      const trend = await CostAttributionService.getMonthlyTrend(
        req.user.tenantId,
        monthsNum
      );

      res.json({
        success: true,
        data: trend,
        count: trend.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  // ============================================================
  // BUDGETS
  // ============================================================

  /**
   * List budgets
   * GET /api/v1/finops/budgets
   */
  async listBudgets(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const budgets = await BudgetService.list(req.user.tenantId);

      const withStatus = await Promise.all(
        budgets.map(async (budget) => {
          const status = await BudgetService.getStatus(budget.id, req.user!.tenantId);
          return status;
        })
      );

      res.json({
        success: true,
        data: withStatus,
        count: budgets.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  /**
   * Create budget
   * POST /api/v1/finops/budgets
   */
  async createBudget(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { service, limit, currency, period, alertThresholds, enforce } = req.body;

      if (!limit || !period) {
        res.status(400).json({
          success: false,
          error: 'limit and period are required',
        });
        return;
      }

      const budget = await BudgetService.create({
        tenantId: req.user.tenantId,
        service,
        limit,
        currency,
        period,
        alertThresholds,
        enforce,
        createdBy: req.user.userId,
      });

      res.status(201).json({
        success: true,
        data: budget,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  /**
   * Get budget status
   * GET /api/v1/finops/budgets/:id
   */
  async getBudget(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const status = await BudgetService.getStatus(req.params.id, req.user.tenantId);

      if (!status) {
        res.status(404).json({ success: false, error: 'Budget not found' });
        return;
      }

      res.json({ success: true, data: status });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  /**
   * Delete budget
   * DELETE /api/v1/finops/budgets/:id
   */
  async deleteBudget(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const deleted = await BudgetService.delete(
        req.params.id,
        req.user.tenantId,
        req.user.userId
      );

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Budget not found' });
        return;
      }

      res.json({ success: true, message: 'Budget deleted' });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  // ============================================================
  // OPTIMIZATION
  // ============================================================

  /**
   * Get optimization recommendations
   * GET /api/v1/finops/optimizations
   */
  async getOptimizations(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { days } = req.query;
      const daysNum = days ? parseInt(days as string, 10) : 30;

      const recommendations = await OptimizationService.generateRecommendations(
        req.user.tenantId,
        daysNum
      );

      const totalSavings = recommendations.reduce(
        (sum, r) => sum + r.estimatedMonthlySavings,
        0
      );

      res.json({
        success: true,
        data: recommendations,
        summary: {
          count: recommendations.length,
          totalPotentialSavings: totalSavings,
          currency: 'USD',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  // ============================================================
  // ANOMALIES
  // ============================================================

  /**
   * Get cost anomalies
   * GET /api/v1/finops/anomalies
   */
  async getAnomalies(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { days } = req.query;
      const daysNum = days ? parseInt(days as string, 10) : 7;

      const anomalies = await AnomalyDetectionService.scanTenant(
        req.user.tenantId,
        daysNum
      );

      res.json({
        success: true,
        data: anomalies,
        count: anomalies.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  // ============================================================
  // SUMMARY (Customer-facing dashboard)
  // ============================================================

  /**
   * Get FinOps summary for tenant
   * GET /api/v1/finops/summary
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const tenantId = req.user.tenantId;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get current month cost
      const breakdown = await CostAttributionService.getBreakdown(
        tenantId,
        monthStart,
        now
      );

      // Get budgets
      const budgets = await BudgetService.list(tenantId);

      // Get optimization opportunities count
      const recommendations = await OptimizationService.generateRecommendations(
        tenantId,
        30
      );

      const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
      const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

      res.json({
        success: true,
        data: {
          currentMonth: {
            total: breakdown.total,
            currency: breakdown.currency,
            byService: breakdown.byService,
          },
          budgets: {
            count: budgets.length,
            totalLimit: totalBudget,
            totalSpent: totalSpent,
            utilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
          },
          optimization: {
            recommendations: recommendations.length,
            potentialSavings: recommendations.reduce(
              (sum, r) => sum + r.estimatedMonthlySavings,
              0
            ),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
}
