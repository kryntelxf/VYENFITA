/**
 * VYENFITA Natural Language to SQL Service
 * 
 * @version 1.0.1
 */

import { AIService } from './ai.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface SQLGenerationResult {
  query: string;
  databaseType: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite';
  explanation: string;
  confidence: number;
  tables: string[];
  fields: string[];
  conditions: string[];
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  optimization: {
    suggestions: string[];
    estimatedPerformance: string;
  };
}

export interface TableSchema {
  name: string;
  fields: {
    name: string;
    type: string;
    nullable?: boolean;
    primaryKey?: boolean;
    foreignKey?: {
      table: string;
      field: string;
    };
  }[];
}

export class NaturalLanguageToSQLService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async convertToSQL(
    question: string,
    schema: { tables: TableSchema[] },
    databaseType: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' = 'postgresql'
  ): Promise<SQLGenerationResult> {
    const systemPrompt = this.getSystemPrompt(databaseType);
    const userPrompt = this.buildUserPrompt(question, schema, databaseType);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.2,
      maxTokens: 4096,
    });

    return this.parseResponse(response.choices[0].message.content, databaseType);
  }

  validateSQL(
    query: string,
    databaseType: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite'
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const upperQuery = query.toUpperCase();

    if (
      upperQuery.includes('DROP') ||
      upperQuery.includes('DELETE') ||
      upperQuery.includes('TRUNCATE')
    ) {
      errors.push('Query contains destructive operations. Only SELECT queries are allowed.');
    }

    if (query.includes(';') && query.split(';').length > 2) {
      warnings.push('Multiple statements detected. Ensure this is intentional.');
    }

    if (!upperQuery.includes('SELECT')) {
      errors.push('Query must be a SELECT statement.');
    }

    if (!upperQuery.includes('FROM')) {
      errors.push('Query must include a FROM clause.');
    }

    void databaseType; // Reserved for future dialect-specific checks

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Optimize SQL query
   * 
   * @param query - SQL query to optimize
   * @param _databaseType - Database type (reserved for future dialect-specific optimizations)
   */
  optimizeSQL(
    query: string,
    _databaseType: string
  ): { suggestions: string[]; estimatedPerformance: string } {
    const suggestions: string[] = [];
    let estimatedPerformance = 'unknown';

    const upperQuery = query.toUpperCase();

    if (upperQuery.includes('SELECT *')) {
      suggestions.push('Consider specifying only the columns you need instead of SELECT *');
    }

    if (!upperQuery.includes('WHERE') && !upperQuery.includes('LIMIT')) {
      suggestions.push('Consider adding a WHERE clause or LIMIT to reduce result set');
    }

    if (upperQuery.includes('JOIN') && !upperQuery.includes('ON')) {
      suggestions.push('JOIN statements should include ON conditions');
    }

    if (suggestions.length === 0) {
      estimatedPerformance = 'good';
    } else if (suggestions.length <= 2) {
      estimatedPerformance = 'fair';
    } else {
      estimatedPerformance = 'poor';
    }

    return { suggestions, estimatedPerformance };
  }

  private getSystemPrompt(databaseType: string): string {
    return `You are VYENFITA SQL Expert. Convert natural language questions to ${databaseType} SQL queries.

Output must be a valid JSON with this structure:
{
  "query": "SELECT ...",
  "explanation": "Explanation of the query",
  "confidence": 0.95,
  "tables": ["table1", "table2"],
  "fields": ["field1", "field2"],
  "conditions": ["condition1", "condition2"]
}`;
  }

  private buildUserPrompt(
    question: string,
    schema: { tables: TableSchema[] },
    databaseType: string
  ): string {
    let prompt = `Convert this question to ${databaseType} SQL:\n\n`;
    prompt += `Question: ${question}\n\n`;
    prompt += `Database Schema:\n${JSON.stringify(schema, null, 2)}\n\n`;
    prompt += 'Generate the SQL query and provide explanation.';
    return prompt;
  }

  private parseResponse(content: string, databaseType: string): SQLGenerationResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const validation = this.validateSQL(parsed.query, databaseType as any);
      const optimization = this.optimizeSQL(parsed.query, databaseType);

      return {
        query: parsed.query || '',
        databaseType: databaseType as any,
        explanation: parsed.explanation || '',
        confidence: parsed.confidence || 0.8,
        tables: parsed.tables || [],
        fields: parsed.fields || [],
        conditions: parsed.conditions || [],
        validation,
        optimization,
      };
    } catch (error) {
      throw new Error(`Failed to parse SQL generation: ${error}`);
    }
  }
  }
