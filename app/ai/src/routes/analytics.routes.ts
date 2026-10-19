/**
 * VYENFITA Analytics Routes (Minimal)
 *
 * Metrics, KPIs, funnels, cohort, predictive, and NL query endpoints.
 *
 * All endpoints require authentication. Tenant isolation is enforced
 * via req.user.tenantId (from JWT).
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

// ============================================================
// AGGREGATION HELPERS
// ============================================================

function truncateToInterval(date: Date, interval: string): Date {
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
    default:
      d.setHours(0, 0, 0, 0);
  }
  return d;
}

function aggregateValues(values: number[], method: string): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  switch (method) {
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
      return sorted[Math.floor(sorted.length * 0.5)];
    case 'p95':
      return sorted[Math.floor(sorted.length * 0.95)];
    case 'p99':
      return sorted[Math.floor(sorted.length * 0.99)];
    default:
      return values.reduce((s, v) => s + v, 0);
  }
}

// ============================================================
// ROUTER
// ============================================================

export function createAnalyticsRouter(): Router {
  const router = Router();

  router.use(authenticate);

  // ============================================================
  // METRICS — QUERY
  // ============================================================

  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const metricName = req.query.metricName as string | undefined;
      const startTime = req.query.startTime as string | undefined;
      const endTime = req.query.endTime as string | undefined;
      const interval = (req.query.interval as string) || 'day';
      const aggregation = (req.query.aggregation as string) || 'sum';

      if (!metricName || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: 'metricName, startTime, endTime are required',
        });
      }

      const points = await prisma.metricDataPoint.findMany({
        where: {
          tenantId,
          metricName,
          timestamp: {
            gte: new Date(startTime),
            lte: new Date(endTime),
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      // Group by interval
      const grouped = new Map<number, number[]>();
      for (const p of points) {
        const key = truncateToInterval(p.timestamp, interval).getTime();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(p.value);
      }

      const dataPoints = Array.from(grouped.entries())
        .map(([ts, vals]) => ({
          timestamp: new Date(ts).toISOString(),
          value: aggregateValues(vals, aggregation),
        }))
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

      return res.json({
        success: true,
        data: {
          metricName,
          interval,
          aggregation,
          dataPoints,
          summary: {
            count: dataPoints.length,
            total: dataPoints.reduce((s, d) => s + d.value, 0),
            average:
              dataPoints.length > 0
                ? dataPoints.reduce((s, d) => s + d.value, 0) /
                  dataPoints.length
                : 0,
            min: dataPoints.length > 0
              ? Math.min(...dataPoints.map((d) => d.value))
              : 0,
            max: dataPoints.length > 0
              ? Math.max(...dataPoints.map((d) => d.value))
              : 0,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Metrics query failed',
      });
    }
  });

  // ============================================================
  // METRICS — RECORD
  // ============================================================

  router.post('/metrics/record', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { metricName, value, labels, timestamp } = req.body;

      if (!metricName || typeof metricName !== 'string') {
        return res
          .status(400)
          .json({ success: false, error: 'metricName is required' });
      }
      if (typeof value !== 'number') {
        return res
          .status(400)
          .json({ success: false, error: 'value must be a number' });
      }

      const point = await prisma.metricDataPoint.create({
        data: {
          tenantId,
          metricName,
          value,
          labels: labels || {},
          timestamp: timestamp ? new Date(timestamp) : new Date(),
        },
      });

      return res.status(201).json({ success: true, data: point });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to record metric',
      });
    }
  });

  // ============================================================
  // KPIs — LIST
  // ============================================================

  router.get('/kpis', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const category = req.query.category as string | undefined;

      const where: any = { tenantId };
      if (category) where.category = category;

      const kpis = await prisma.kPI.findMany({
        where,
        orderBy: { name: 'asc' },
      });

      // Enrich with latest value
      const enriched = await Promise.all(
        kpis.map(async (kpi) => {
          const latest = await prisma.kPIValue.findFirst({
            where: { kpiId: kpi.id },
            orderBy: { timestamp: 'desc' },
          });
          return {
            ...kpi,
            currentValue: latest?.value,
            status: latest?.status,
            trend: latest?.trend,
          };
        })
      );

      return res.json({ success: true, data: enriched, count: enriched.length });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list KPIs',
      });
    }
  });

  // ============================================================
  // KPIs — CREATE
  // ============================================================

  router.post('/kpis', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const {
        name,
        description,
        unit,
        category,
        targetValue,
        targetDirection,
        targetPeriod,
      } = req.body;

      if (!name || typeof name !== 'string') {
        return res
          .status(400)
          .json({ success: false, error: 'name is required' });
      }
      if (typeof targetValue !== 'number') {
        return res
          .status(400)
          .json({ success: false, error: 'targetValue must be a number' });
      }
      if (!['above', 'below', 'equal'].includes(targetDirection)) {
        return res.status(400).json({
          success: false,
          error: 'targetDirection must be above|below|equal',
        });
      }

      const kpi = await prisma.kPI.create({
        data: {
          tenantId,
          name,
          description: description || null,
          unit: unit || 'count',
          category: category || 'general',
          targetValue,
          targetDirection,
          targetPeriod: targetPeriod || 'monthly',
          createdBy: userId,
        },
      });

      return res.status(201).json({ success: true, data: kpi });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create KPI',
      });
    }
  });

  // ============================================================
  // KPIs — REPORT
  // ============================================================

  router.get('/kpis/:id/report', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const days = parseInt(req.query.days as string || '30', 10);

      const kpi = await prisma.kPI.findFirst({
        where: { id, tenantId },
      });

      if (!kpi) {
        return res
          .status(404)
          .json({ success: false, error: 'KPI not found' });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const values = await prisma.kPIValue.findMany({
        where: { kpiId: id, timestamp: { gte: startDate } },
        orderBy: { timestamp: 'asc' },
      });

      const current = values[values.length - 1];

      return res.json({
        success: true,
        data: {
          kpi,
          current: current || null,
          history: values.map((v) => ({
            timestamp: v.timestamp.toISOString(),
            value: v.value,
            status: v.status,
          })),
          count: values.length,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'KPI report failed',
      });
    }
  });

  // ============================================================
  // FUNNELS — CREATE
  // ============================================================

  router.post('/funnels', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, description, steps, windowHours } = req.body;

      if (!name || typeof name !== 'string') {
        return res
          .status(400)
          .json({ success: false, error: 'name is required' });
      }
      if (!Array.isArray(steps) || steps.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'steps must be a non-empty array' });
      }

      const funnel = await prisma.funnel.create({
        data: {
          tenantId,
          name,
          description: description || null,
          steps,
          windowHours: windowHours || 24,
        },
      });

      return res.status(201).json({ success: true, data: funnel });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create funnel',
      });
    }
  });

  // ============================================================
  // FUNNELS — LIST
  // ============================================================

  router.get('/funnels', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const funnels = await prisma.funnel.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({
        success: true,
        data: funnels,
        count: funnels.length,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list funnels',
      });
    }
  });

  // ============================================================
  // FUNNELS — ANALYZE
  // ============================================================

  router.get('/funnels/:id/analyze', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const startTime = req.query.startTime as string | undefined;
      const endTime = req.query.endTime as string | undefined;

      const funnel = await prisma.funnel.findFirst({
        where: { id, tenantId },
      });
      if (!funnel) {
        return res
          .status(404)
          .json({ success: false, error: 'Funnel not found' });
      }

      const start = startTime
        ? new Date(startTime)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endTime ? new Date(endTime) : new Date();

      const steps = funnel.steps as any[];
      const events = await prisma.analyticsEvent.findMany({
        where: {
          tenantId,
          timestamp: { gte: start, lte: end },
          eventName: { in: steps.map((s: any) => s.event) },
        },
        orderBy: { timestamp: 'asc' },
      });

      // Group by user
      const userEvents = new Map<string, typeof events>();
      for (const ev of events) {
        const uid = ev.userId || ev.sessionId || 'anonymous';
        if (!userEvents.has(uid)) userEvents.set(uid, []);
        userEvents.get(uid)!.push(ev);
      }

      const stepCounts = new Array(steps.length).fill(0);
      for (const [, list] of userEvents) {
        let cur = 0;
        for (const ev of list) {
          if (cur >= steps.length) break;
          if (ev.eventName === steps[cur].event) {
            stepCounts[cur]++;
            cur++;
          }
        }
      }

      const totalEntered = stepCounts[0] || 0;
      const totalConverted = stepCounts[steps.length - 1] || 0;

      return res.json({
        success: true,
        data: {
          funnelId: id,
          totalEntered,
          totalConverted,
          conversionRate:
            totalEntered > 0 ? (totalConverted / totalEntered) * 100 : 0,
          steps: steps.map((s: any, i: number) => ({
            id: s.id,
            name: s.name,
            count: stepCounts[i],
            percentOfTotal:
              totalEntered > 0 ? (stepCounts[i] / totalEntered) * 100 : 0,
          })),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Funnel analysis failed',
      });
    }
  });

  // ============================================================
  // COHORT — ANALYZE
  // ============================================================

  router.post('/cohort/analyze', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const {
        entryEvent,
        returnEvent,
        periodDays = 7,
        startDate,
        endDate,
      } = req.body;

      if (!entryEvent || !returnEvent) {
        return res.status(400).json({
          success: false,
          error: 'entryEvent and returnEvent are required',
        });
      }

      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const entryEvents = await prisma.analyticsEvent.findMany({
        where: {
          tenantId,
          eventName: entryEvent,
          timestamp: { gte: start, lte: end },
        },
      });

      // Group users by cohort
      const cohortMap = new Map<string, Set<string>>();
      for (const ev of entryEvents) {
        const uid = ev.userId || ev.sessionId;
        if (!uid) continue;
        const d = new Date(ev.timestamp);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString();
        if (!cohortMap.has(key)) cohortMap.set(key, new Set());
        cohortMap.get(key)!.add(uid);
      }

      const cohorts = Array.from(cohortMap.entries()).map(
        ([cohortDate, users]) => ({
          cohortDate,
          cohortSize: users.size,
        })
      );

      return res.json({
        success: true,
        data: {
          entryEvent,
          returnEvent,
          periodDays,
          cohorts,
          totalCohorts: cohorts.length,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Cohort analysis failed',
      });
    }
  });

  // ============================================================
  // PREDICT — LINEAR FORECAST
  // ============================================================

  router.post('/predict', async (req: Request, res: Response) => {
    try {
      const { history, horizon = 7, metricName } = req.body;

      if (!Array.isArray(history) || history.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'history must be an array with at least 2 points',
        });
      }

      // Linear regression
      const baseTime = new Date(history[0].timestamp).getTime();
      const xs = history.map(
        (h: any) =>
          (new Date(h.timestamp).getTime() - baseTime) / (24 * 60 * 60 * 1000)
      );
      const ys = history.map((h: any) => h.value);

      const n = xs.length;
      const sumX = xs.reduce((s: number, x: number) => s + x, 0);
      const sumY = ys.reduce((s: number, y: number) => s + y, 0);
      const sumXY = xs.reduce(
        (s: number, x: number, i: number) => s + x * ys[i],
        0
      );
      const sumX2 = xs.reduce((s: number, x: number) => s + x * x, 0);

      const slope =
        (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
      const intercept = (sumY - slope * sumX) / n;

      const residuals = ys.map(
        (y: number, i: number) => y - (intercept + slope * xs[i])
      );
      const stdDev = Math.sqrt(
        residuals.reduce((s: number, r: number) => s + r * r, 0) / n
      );

      const lastX = xs[xs.length - 1];
      const lastTime = new Date(history[history.length - 1].timestamp).getTime();

      const dataPoints = [];
      for (let i = 1; i <= horizon; i++) {
        const futureX = lastX + i;
        const predicted = intercept + slope * futureX;
        dataPoints.push({
          timestamp: new Date(
            lastTime + i * 24 * 60 * 60 * 1000
          ).toISOString(),
          value: predicted,
          confidence: {
            lower: predicted - 1.96 * stdDev,
            upper: predicted + 1.96 * stdDev,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          metric: metricName || 'metric',
          model: 'linear',
          horizon,
          dataPoints,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Prediction failed',
      });
    }
  });

  // ============================================================
  // ASK — NATURAL LANGUAGE QUERY
  // ============================================================

  router.post('/ask', async (req: Request, res: Response) => {
    try {
      const { question } = req.body;

      if (!question || typeof question !== 'string') {
        return res
          .status(400)
          .json({ success: false, error: 'question is required' });
      }

      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      if (!hasOpenAI) {
        return res.json({
          success: true,
          data: {
            question,
            answer:
              '[MOCK] NL query requires OPENAI_API_KEY to be configured. ' +
              'Set OPENAI_API_KEY to enable natural language analytics.',
            confidence: 0,
            mock: true,
          },
        });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a business analyst. Answer concisely based on the question. Output plain text.',
            },
            { role: 'user', content: question },
          ],
          temperature: 0.3,
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        return res.status(502).json({
          success: false,
          error: `AI provider error: ${response.status}`,
        });
      }

      const data: any = await response.json();

      return res.json({
        success: true,
        data: {
          question,
          answer: data.choices?.[0]?.message?.content || '',
          confidence: 0.8,
          mock: false,
          tokensUsed: data.usage?.total_tokens || 0,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'NL query failed',
      });
    }
  });

  return router;
}
