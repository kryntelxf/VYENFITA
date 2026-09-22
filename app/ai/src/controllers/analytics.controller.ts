/**
 * VYENFITA Analytics Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { MetricsService } from '../lib/analytics/metrics.service';
import { KPIService } from '../lib/analytics/kpi.service';
import { FunnelService } from '../lib/analytics/funnel.service';
import { CohortService } from '../lib/analytics/cohort.service';
import { PredictiveService } from '../lib/analytics/predictive.service';
import { NLQueryService } from '../lib/analytics/nl-query.service';

export class AnalyticsController {
  // ============================================================
  // METRICS
  // ============================================================

  async queryMetrics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const {
        metricName,
        startTime,
        endTime,
        interval = 'day',
        aggregation = 'sum',
      } = req.query;

      if (!metricName || !startTime || !endTime) {
        res.status(400).json({
          success: false,
          error: 'metricName, startTime, endTime are required',
        });
        return;
      }

      const result = await MetricsService.query({
        tenantId: req.user.tenantId,
        metricName: metricName as string,
        startTime: new Date(startTime as string),
        endTime: new Date(endTime as string),
        interval: interval as any,
        aggregation: aggregation as any,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async listMetrics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const metrics = await MetricsService.listMetrics(req.user.tenantId);
      res.json({ success: true, data: metrics });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // ============================================================
  // KPIs
  // ============================================================

  async createKPI(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const kpi = await KPIService.create({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        ...req.body,
      });

      res.status(201).json({ success: true, data: kpi });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async listKPIs(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const kpis = await KPIService.list(req.user.tenantId, req.query.category as string);
      res.json({ success: true, data: kpis });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getKPIReport(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const report = await KPIService.getReport(req.params.id, req.user.tenantId, days);

      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // ============================================================
  // FUNNEL
  // ============================================================

  async createFunnel(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const funnel = await FunnelService.create({
        tenantId: req.user.tenantId,
        ...req.body,
      });

      res.status(201).json({ success: true, data: funnel });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async analyzeFunnel(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { startTime, endTime } = req.query;

      const analysis = await FunnelService.analyze(
        req.params.id,
        req.user.tenantId,
        new Date((startTime as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        new Date((endTime as string) || new Date().toISOString())
      );

      res.json({ success: true, data: analysis });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async listFunnels(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const funnels = await FunnelService.list(req.user.tenantId);
      res.json({ success: true, data: funnels });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // ============================================================
  // COHORT
  // ============================================================

  async analyzeCohort(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const {
        entryEvent,
        returnEvent,
        periodDays = 7,
        startDate,
        endDate,
      } = req.body;

      const analysis = await CohortService.analyze({
        id: 'temp',
        tenantId: req.user.tenantId,
        name: 'Cohort Analysis',
        entryEvent,
        returnEvent,
        periodDays,
        startDate: new Date(startDate || Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(endDate || Date.now()),
      });

      res.json({ success: true, data: analysis });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // ============================================================
  // PREDICTIVE
  // ============================================================

  async forecast(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { metricName, horizon = 30, history } = req.body;

      if (!history || !Array.isArray(history)) {
        res.status(400).json({ success: false, error: 'history array is required' });
        return;
      }

      const result = PredictiveService.autoForecast(
        history.map((h: any) => ({
          timestamp: new Date(h.timestamp),
          value: h.value,
        })),
        horizon,
        metricName
      );

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // ============================================================
  // NATURAL LANGUAGE QUERY
  // ============================================================

  async ask(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { question, context } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ success: false, error: 'question is required' });
        return;
      }

      const result = await NLQueryService.ask({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        question,
        context,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
        }
