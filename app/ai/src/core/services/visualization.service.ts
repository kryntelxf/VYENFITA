/**
 * VYENFITA Data Visualization Service
 * 
 * Generates charts, graphs, and dashboards from data
 * - Bar charts
 * - Line charts
 * - Pie charts
 * - Area charts
 * - Scatter plots
 * - Heatmaps
 * - Dashboards
 * 
 * @version 1.0.0
 */

import { AIService } from './ai.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface Visualization {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'heatmap' | 'dashboard';
  title: string;
  description: string;
  config: VisualizationConfig;
  data: any[];
  options: Record<string, any>;
}

export interface VisualizationConfig {
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  aggregate?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  colors?: string[];
  labels?: string[];
  legend?: boolean;
  tooltip?: boolean;
  animation?: boolean;
}

export class VisualizationService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Generate visualization from data
   */
  async generate(data: any[], config: VisualizationConfig): Promise<Visualization> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(data, config);

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
   * Generate dashboard from multiple visualizations
   */
  async generateDashboard(data: any[], metrics: string[]): Promise<Visualization[]> {
    const visualizations: Visualization[] = [];

    // Generate charts for each metric
    for (const metric of metrics) {
      const chart = await this.generate(data, {
        xAxis: 'date',
        yAxis: metric,
        aggregate: 'sum',
        legend: true,
        tooltip: true,
      });
      visualizations.push(chart);
    }

    return visualizations;
  }

  private getSystemPrompt(): string {
    return `You are VYENFITA Data Visualization Expert.
Generate visualization configurations based on the provided data.

Output must be a valid JSON with this structure:
{
  "id": "viz-1",
  "type": "bar|line|pie|area|scatter|heatmap|dashboard",
  "title": "Chart Title",
  "description": "Chart description",
  "config": {
    "xAxis": "field_name",
    "yAxis": "field_name",
    "groupBy": "field_name",
    "aggregate": "sum|avg|count|min|max",
    "colors": ["#color1", "#color2"],
    "labels": ["Label 1", "Label 2"],
    "legend": true,
    "tooltip": true,
    "animation": true
  },
  "data": [...],
  "options": {}
}`;
  }

  private buildUserPrompt(data: any[], config: VisualizationConfig): string {
    let prompt = `Generate visualization for the following data:\n\n`;
    prompt += `Data: ${JSON.stringify(data.slice(0, 50))}\n\n`;
    if (data.length > 50) {
      prompt += `(Showing first 50 of ${data.length} records)\n\n`;
    }
    prompt += `Configuration: ${JSON.stringify(config)}\n\n`;
    prompt += 'Generate the visualization configuration.';
    return prompt;
  }

  private parseResponse(content: string): Visualization {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse visualization: ${error}`);
    }
  }
    }
