/**
 * VYENFITA NL Query Service Unit Tests
 * 
 * Verifies:
 * - Question interpretation
 * - Data querying
 * - Answer generation
 * - Follow-up question generation
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/ai/ai.service', () => ({
  getAIService: jest.fn(() => ({
    complete: jest.fn(),
  })),
}));

jest.mock('../../../lib/analytics/metrics.service', () => ({
  MetricsService: {
    listMetrics: jest.fn(),
    query: jest.fn(),
  },
}));

jest.mock('../../../lib/analytics/kpi.service', () => ({
  KPIService: {
    list: jest.fn(),
  },
}));

import { NLQueryService } from '../../../lib/analytics/nl-query.service';
import { getAIService } from '../../../lib/ai/ai.service';
import { MetricsService } from '../../../lib/analytics/metrics.service';
import { KPIService } from '../../../lib/analytics/kpi.service';

describe('NLQueryService', () => {
  let mockAI: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAI = {
      complete: jest.fn(),
    };
    (getAIService as jest.Mock).mockReturnValue(mockAI);

    (MetricsService.listMetrics as jest.Mock).mockResolvedValue(['revenue', 'users']);
    (KPIService.list as jest.Mock).mockResolvedValue([]);
  });

  describe('ask()', () => {
    it('should interpret question and return answer', async () => {
      mockAI.complete
        .mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'metrics_query',
            metrics: ['revenue'],
            timeframe: 'month',
            aggregation: 'sum',
          }),
          usage: { totalTokens: 100, promptTokens: 80, completionTokens: 20 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            answer: 'Revenue this month is $50,000.',
            confidence: 0.9,
          }),
          usage: { totalTokens: 80, promptTokens: 60, completionTokens: 20 },
        });

      (MetricsService.query as jest.Mock).mockResolvedValue({
        metricName: 'revenue',
        dataPoints: [],
        summary: { total: 50000 },
      });

      const result = await NLQueryService.ask({
        tenantId: 'tenant-1',
        userId: 'user-1',
        question: 'What is my revenue this month?',
      });

      expect(result.question).toBe('What is my revenue this month?');
      expect(result.answer).toContain('50,000');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return follow-up questions', async () => {
      mockAI.complete
        .mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'metrics_query',
            metrics: ['revenue'],
          }),
          usage: { totalTokens: 50, promptTokens: 40, completionTokens: 10 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ answer: 'Test answer', confidence: 0.8 }),
          usage: { totalTokens: 40, promptTokens: 30, completionTokens: 10 },
        });

      (MetricsService.query as jest.Mock).mockResolvedValue({
        metricName: 'revenue',
        dataPoints: [],
        summary: { total: 1000 },
      });

      const result = await NLQueryService.ask({
        tenantId: 'tenant-1',
        userId: 'user-1',
        question: 'Show revenue',
      });

      expect(result.followUpQuestions).toBeDefined();
      expect(Array.isArray(result.followUpQuestions)).toBe(true);
    });

    it('should handle KPI intent', async () => {
      mockAI.complete
        .mockResolvedValueOnce({
          content: JSON.stringify({ intent: 'kpi_status' }),
          usage: { totalTokens: 30, promptTokens: 25, completionTokens: 5 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            answer: 'All KPIs are on track.',
            confidence: 0.85,
          }),
          usage: { totalTokens: 40, promptTokens: 30, completionTokens: 10 },
        });

      (KPIService.list as jest.Mock).mockResolvedValue([
        { id: 'kpi-1', name: 'Revenue', currentValue: 100, status: 'on_track' },
      ]);

      const result = await NLQueryService.ask({
        tenantId: 'tenant-1',
        userId: 'user-1',
        question: 'How are my KPIs?',
      });

      expect(result.answer).toBeDefined();
      expect(KPIService.list).toHaveBeenCalled();
    });

    it('should handle malformed AI response gracefully', async () => {
      mockAI.complete
        .mockResolvedValueOnce({
          content: 'not valid json',
          usage: { totalTokens: 30, promptTokens: 25, completionTokens: 5 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ answer: 'Default answer', confidence: 0.5 }),
          usage: { totalTokens: 40, promptTokens: 30, completionTokens: 10 },
        });

      const result = await NLQueryService.ask({
        tenantId: 'tenant-1',
        userId: 'user-1',
        question: 'Test question',
      });

      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();
    });

    it('should include visualizations for metrics', async () => {
      mockAI.complete
        .mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'metrics_query',
            metrics: ['revenue'],
          }),
          usage: { totalTokens: 40, promptTokens: 30, completionTokens: 10 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ answer: 'Revenue is $5000', confidence: 0.9 }),
          usage: { totalTokens: 40, promptTokens: 30, completionTokens: 10 },
        });

      (MetricsService.query as jest.Mock).mockResolvedValue({
        metricName: 'revenue',
        dataPoints: [{ timestamp: new Date(), value: 5000 }],
        summary: { total: 5000 },
      });

      const result = await NLQueryService.ask({
        tenantId: 'tenant-1',
        userId: 'user-1',
        question: 'Show me revenue',
      });

      expect(result.visualizations).toBeDefined();
      expect(result.visualizations?.length).toBeGreaterThan(0);
    });
  });
});
