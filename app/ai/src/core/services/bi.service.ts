/**
 * VYENFITA Business Intelligence Service
 * 
 * Natural language business intelligence
 * - Answer business questions in natural language
 * - Anomaly detection
 * - KPI tracking
 * - Predictive analytics
 * 
 * @version 1.0.0
 */

import { AIService } from './ai.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface BIQuery {
  question: string;
  context?: Record<string, any>;
  data?: any[];
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface BIResponse {
  answer: string;
  confidence: number;
  evidence: string[];
  recommendations: string[];
  data?: any;
  visualizations?: {
    type: 'chart' | 'table' | 'metric' | 'trend';
    data: any;
    config: Record<string, any>;
  }[];
}

export class BusinessIntelligenceService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Answer a natural language business question
   */
  async ask(question: string, data: any[] = [], context?: Record<string, any>): Promise<BIResponse> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(question, data, context);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 4096,
    });

    return this.parseResponse(response.choices[0].message.content);
  }

  /**
   * Detect anomalies in data
   */
  async detectAnomalies(data: any[], metrics: string[]): Promise<any> {
    const systemPrompt = `You are VYENFITA Anomaly Detection Specialist.
Detect anomalies in the provided data.

Output a valid JSON:
{
  "anomalies": [
    {
      "metric": "metric_name",
      "value": "anomalous_value",
      "expected": "expected_range",
      "severity": "low|medium|high|critical",
      "explanation": "Why this is anomalous"
    }
  ],
  "summary": "Summary of all anomalies"
}`;

    const userPrompt = `Data: ${JSON.stringify(data)}\nMetrics: ${JSON.stringify(metrics)}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.2,
      maxTokens: 2048,
    });

    return this.extractJSON(response.choices[0].message.content);
  }

  /**
   * Generate KPI dashboard
   */
  async generateKPI(data: any[], metrics: string[]): Promise<any> {
    const systemPrompt = `You are VYENFITA KPI Dashboard Designer.
Design a KPI dashboard based on the data and metrics.

Output a valid JSON:
{
  "metrics": [
    {
      "name": "Metric Name",
      "value": "current_value",
      "change": "+10%",
      "trend": "up|down|stable",
      "target": "target_value",
      "status": "on_track|at_risk|off_track"
    }
  ],
  "charts": [
    {
      "type": "bar|line|pie|area",
      "title": "Chart Title",
      "data": [...]
    }
  ],
  "insights": ["Insight 1", "Insight 2"]
}`;

    const userPrompt = `Data: ${JSON.stringify(data)}\nMetrics: ${JSON.stringify(metrics)}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 4096,
    });

    return this.extractJSON(response.choices[0].message.content);
  }

  /**
   * Generate predictive analytics
   */
  async predict(data: any[], target: string, horizon: string): Promise<any> {
    const systemPrompt = `You are VYENFITA Predictive Analytics Specialist.
Predict future trends based on historical data.

Output a valid JSON:
{
  "predictions": [
    {
      "period": "2024-01",
      "value": 123.45,
      "confidence": 0.85
    }
  ],
  "trend": "up|down|stable",
  "confidence": 0.85,
  "factors": ["Factor 1", "Factor 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    const userPrompt = `Data: ${JSON.stringify(data)}\nTarget: ${target}\nHorizon: ${horizon}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.2,
      maxTokens: 4096,
    });

    return this.extractJSON(response.choices[0].message.content);
  }

  /**
   * Generate business report
   */
  async generateReport(data: any[], reportType: string, period: string): Promise<string> {
    const systemPrompt = `You are VYENFITA Business Report Generator.
Generate a professional business report based on the data.

Include:
1. Executive Summary
2. Key Metrics
3. Analysis
4. Recommendations
5. Next Steps

Format as a clean, professional report.`;

    const userPrompt = `Report Type: ${reportType}\nPeriod: ${period}\nData: ${JSON.stringify(data)}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.4,
      maxTokens: 4096,
    });

    return response.choices[0].message.content;
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  private getSystemPrompt(): string {
    return `You are VYENFITA Business Intelligence Specialist.
You answer business questions with data-driven insights.

Rules:
1. Always base answers on the provided data
2. Provide confidence levels
3. Include evidence from the data
4. Give actionable recommendations
5. If data is insufficient, say so clearly
6. Do not invent business facts

Output format:
{
  "answer": "Clear, concise answer to the question",
  "confidence": 0.95,
  "evidence": ["Evidence point 1", "Evidence point 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "data": { "key": "value" },
  "visualizations": [
    {
      "type": "chart|table|metric|trend",
      "data": {...},
      "config": {...}
    }
  ]
}`;
  }

  private buildUserPrompt(question: string, data: any[], context?: Record<string, any>): string {
    let prompt = `Question: ${question}\n\n`;

    if (data && data.length > 0) {
      prompt += `Data: ${JSON.stringify(data.slice(0, 100))}`;
      if (data.length > 100) {
        prompt += `\n(Showing first 100 of ${data.length} records)`;
      }
      prompt += '\n\n';
    }

    if (context) {
      prompt += `Context: ${JSON.stringify(context)}\n\n`;
    }

    prompt += 'Provide a data-driven answer with confidence, evidence, and recommendations.';
    return prompt;
  }

  private parseResponse(content: string): BIResponse {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          answer: content,
          confidence: 0.5,
          evidence: [],
          recommendations: [],
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        answer: parsed.answer || content,
        confidence: parsed.confidence || 0.5,
        evidence: parsed.evidence || [],
        recommendations: parsed.recommendations || [],
        data: parsed.data,
        visualizations: parsed.visualizations,
      };
    } catch {
      return {
        answer: content,
        confidence: 0.5,
        evidence: [],
        recommendations: [],
      };
    }
  }

  private extractJSON(content: string): any {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  }
  }
