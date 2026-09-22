/**
 * VYENFITA Natural Language Query Service
 * 
 * Allows users to ask business questions in plain English.
 * Uses AI to interpret question → query metrics.
 * 
 * @version 1.0.0
 */

import { getAIService } from '../ai/ai.service';
import { MetricsService } from './metrics.service';
import { KPIService } from './kpi.service';
import { logger } from '../observability/logger';

export interface NLQueryInput {
  tenantId: string;
  userId: string;
  question: string;
  context?: {
    availableMetrics?: string[];
    availableKPIs?: string[];
    timeframe?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
}

export interface NLQueryResult {
  question: string;
  answer: string;
  data?: {
    metrics?: any;
    kpis?: any[];
  };
  visualizations?: Array<{
    type: 'line' | 'bar' | 'pie' | 'metric';
    title: string;
    data: any;
  }>;
  confidence: number;
  followUpQuestions?: string[];
}

interface QueryInterpretation {
  intent: 'metrics_query' | 'kpi_status' | 'comparison' | 'trend' | 'unknown';
  metrics?: string[];
  timeframe?: string;
  aggregation?: string;
  groupBy?: string;
}

export class NLQueryService {
  /**
   * Answer a natural language business question
   */
  static async ask(input: NLQueryInput): Promise<NLQueryResult> {
    const ai = getAIService();

    // Step 1: Get available metrics & KPIs
    const availableMetrics = input.context?.availableMetrics || (await MetricsService.listMetrics(input.tenantId));
    const availableKPIs = input.context?.availableKPIs || ((await KPIService.list(input.tenantId)).map((k) => k.name));

    // Step 2: Interpret the question
    const interpretation = await this.interpretQuestion(
      input.question,
      availableMetrics,
      availableKPIs
    );

    // Step 3: Execute the query
    const data = await this.executeQuery(interpretation, input.tenantId);

    // Step 4: Generate the answer
    const answer = await this.generateAnswer(input.question, data, interpretation);

    // Step 5: Generate follow-up questions
    const followUp = await this.generateFollowUp(input.question, interpretation);

    // Step 6: Generate visualizations
    const visualizations = this.generateVisualizations(data, interpretation);

    return {
      question: input.question,
      answer: answer.answer,
      data,
      visualizations,
      confidence: answer.confidence,
      followUpQuestions: followUp,
    };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static async interpretQuestion(
    question: string,
    availableMetrics: string[],
    availableKPIs: string[]
  ): Promise<QueryInterpretation> {
    const ai = getAIService();

    const response = await ai.complete(
      {
        systemPrompt: `You interpret natural language business questions into structured queries.

Available metrics: ${availableMetrics.join(', ') || 'none'}
Available KPIs: ${availableKPIs.join(', ') || 'none'}

Output valid JSON:
{
  "intent": "metrics_query" | "kpi_status" | "comparison" | "trend" | "unknown",
  "metrics": ["metric1", "metric2"],
  "timeframe": "day" | "week" | "month" | "quarter" | "year",
  "aggregation": "sum" | "avg" | "count" | "min" | "max",
  "groupBy": "optional_field"
}`,
        messages: [{ role: 'user', content: question }],
        temperature: 0.1,
        maxTokens: 500,
        responseFormat: 'json',
      },
      { tenantId: 'system', operation: 'nl_query_interpret' }
    );

    try {
      return JSON.parse(response.content);
    } catch {
      return { intent: 'unknown' };
    }
  }

  private static async executeQuery(
    interpretation: QueryInterpretation,
    tenantId: string
  ): Promise<any> {
    const result: any = {};

    if (interpretation.intent === 'kpi_status') {
      const kpis = await KPIService.list(tenantId);
      result.kpis = kpis;
      return result;
    }

    if (interpretation.metrics && interpretation.metrics.length > 0) {
      const timeframe = interpretation.timeframe || 'month';
      const endTime = new Date();
      const startTime = new Date();

      switch (timeframe) {
        case 'day':
          startTime.setDate(startTime.getDate() - 1);
          break;
        case 'week':
          startTime.setDate(startTime.getDate() - 7);
          break;
        case 'month':
          startTime.setMonth(startTime.getMonth() - 1);
          break;
        case 'quarter':
          startTime.setMonth(startTime.getMonth() - 3);
          break;
        case 'year':
          startTime.setFullYear(startTime.getFullYear() - 1);
          break;
      }

      result.metrics = {};
      for (const metricName of interpretation.metrics) {
        const series = await MetricsService.query({
          tenantId,
          metricName,
          startTime,
          endTime,
          interval: 'day',
          aggregation: (interpretation.aggregation as any) || 'sum',
        });

        result.metrics[metricName] = series;
      }
    }

    return result;
  }

  private static async generateAnswer(
    question: string,
    data: any,
    interpretation: QueryInterpretation
  ): Promise<{ answer: string; confidence: number }> {
    const ai = getAIService();

    const response = await ai.complete(
      {
        systemPrompt: `You are a business analyst. Answer the user's question using the provided data.

Be concise, specific, and include numbers. If the data is insufficient, say so.

Output valid JSON:
{
  "answer": "Your answer in 2-3 sentences",
  "confidence": 0.95
}`,
        messages: [
          {
            role: 'user',
            content: `Question: ${question}\n\nData:\n${JSON.stringify(data, null, 2)}`,
          },
        ],
        temperature: 0.2,
        maxTokens: 500,
        responseFormat: 'json',
      },
      { tenantId: 'system', operation: 'nl_query_answer' }
    );

    try {
      return JSON.parse(response.content);
    } catch {
      return { answer: 'Unable to generate answer', confidence: 0 };
    }
  }

  private static async generateFollowUp(
    question: string,
    interpretation: QueryInterpretation
  ): Promise<string[]> {
    // Static suggestions based on intent
    const suggestions: Record<string, string[]> = {
      metrics_query: [
        'How does this compare to last month?',
        'Break this down by region',
        'What is the trend over the last year?',
      ],
      kpi_status: [
        'Which KPIs are off track?',
        'What actions should I take?',
        'Show me the historical trend',
      ],
      comparison: [
        'What is driving this difference?',
        'Show me the breakdown',
        'What is the forecast?',
      ],
      trend: [
        'What is causing this trend?',
        'What will it look like next month?',
        'Are there anomalies?',
      ],
    };

    return suggestions[interpretation.intent] || [
      'Can you show me the underlying data?',
      'What actions do you recommend?',
    ];
  }

  private static generateVisualizations(
    data: any,
    interpretation: QueryInterpretation
  ): NLQueryResult['visualizations'] {
    const visualizations: NLQueryResult['visualizations'] = [];

    if (data.metrics) {
      for (const [metricName, series] of Object.entries(data.metrics)) {
        visualizations.push({
          type: 'line',
          title: metricName,
          data: series,
        });
      }
    }

    if (data.kpis && data.kpis.length > 0) {
      visualizations.push({
        type: 'metric',
        title: 'KPIs',
        data: data.kpis,
      });
    }

    return visualizations;
  }
}

export default NLQueryService;
