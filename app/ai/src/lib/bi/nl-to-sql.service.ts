/**
 * VYENFITA NL to SQL Service
 * 
 * Converts natural language questions to SQL:
 * - Uses AI to generate SQL from question + schema
 * - Validates safety before returning
 * - Provides confidence score
 * - Suggests follow-up questions
 * 
 * @version 1.0.0
 */

import { z } from 'zod';
import { getAIService } from '../ai/ai.service';
import { SQLSafetyValidator } from './sql-safety.validator';
import { TableSchema } from './data-source.interface';

// ============================================================
// SCHEMA
// ============================================================

const NLToSQLResponseSchema = z.object({
  sql: z.string(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  tablesUsed: z.array(z.string()),
  columnsUsed: z.array(z.string()),
  followUpQuestions: z.array(z.string()).default([]),
  caveats: z.array(z.string()).default([]),
});

export type NLToSQLResponse = z.infer<typeof NLToSQLResponseSchema>;

export interface GenerateOptions {
  tenantId: string;
  userId: string;
  question: string;
  schemas: TableSchema[];
  dialect: 'postgresql' | 'mysql';
  context?: Record<string, any>;
}

export interface NLToSQLResult {
  sql: string;
  explanation: string;
  confidence: number;
  tablesUsed: string[];
  columnsUsed: string[];
  followUpQuestions: string[];
  caveats: string[];
  safetyPassed: boolean;
  safetyReasons?: string[];
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
}

export class NLToSQLService {
  /**
   * Generate SQL from natural language
   */
  static async generate(options: GenerateOptions): Promise<NLToSQLResult> {
    const startTime = Date.now();
    const ai = getAIService();

    // Build schema context
    const schemaContext = this.buildSchemaContext(options.schemas, options.dialect);

    const systemPrompt = `You are VYENFITA Data Analyst. Your job is to convert natural language questions into safe, read-only SQL queries.

CRITICAL RULES:
1. Only SELECT queries are allowed. Never write INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, or any DDL/DML.
2. Use only tables and columns from the provided schema.
3. Never use dangerous functions like pg_read_file, pg_sleep, load_file, etc.
4. Always add a LIMIT clause (max 1000).
5. Do not use SQL comments (-- or /* */).
6. Do not use semicolons except at the very end.
7. If the question cannot be answered with the given schema, return an empty SQL string and explain why.

Output ONLY valid JSON matching this exact schema:
{
  "sql": "SELECT ...",
  "explanation": "Plain English explanation of what the query does",
  "confidence": 0.95,
  "tablesUsed": ["table1"],
  "columnsUsed": ["table1.col1"],
  "followUpQuestions": ["What about last month?", "Break down by region?"],
  "caveats": ["Assumes 'revenue' means gross_revenue column"]
}

Database dialect: ${options.dialect.toUpperCase()}`;

    const userPrompt = `# Database Schema

${schemaContext}

# Question

${options.question}

${options.context ? `# Additional Context\n\n${JSON.stringify(options.context, null, 2)}` : ''}

Generate the SQL query. Remember: SELECT only, must include LIMIT, no comments.`;

    const response = await ai.complete(
      {
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.2,
        maxTokens: 2048,
        responseFormat: 'json',
      },
      {
        tenantId: options.tenantId,
        userId: options.userId,
        operation: 'nl_to_sql',
      }
    );

    // Parse & validate with Zod
    let parsed: NLToSQLResponse;
    try {
      const json = this.extractJSON(response.content);
      parsed = NLToSQLResponseSchema.parse(json);
    } catch (error) {
      throw new Error(
        `AI generated invalid response: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }

    // Validate SQL safety
    const safety = SQLSafetyValidator.validate(parsed.sql);

    // Estimate cost (rough)
    const costUsd =
      (response.usage.promptTokens / 1_000_000) * 10 +
      (response.usage.completionTokens / 1_000_000) * 30;

    return {
      sql: safety.safe ? safety.sanitized! : parsed.sql,
      explanation: parsed.explanation,
      confidence: parsed.confidence,
      tablesUsed: parsed.tablesUsed,
      columnsUsed: parsed.columnsUsed,
      followUpQuestions: parsed.followUpQuestions,
      caveats: parsed.caveats,
      safetyPassed: safety.safe,
      safetyReasons: safety.safe ? undefined : safety.reasons,
      tokensUsed: response.usage.totalTokens,
      costUsd,
      durationMs: Date.now() - startTime,
    };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static buildSchemaContext(
    schemas: TableSchema[],
    dialect: string
  ): string {
    const parts: string[] = [];

    for (const schema of schemas) {
      const lines: string[] = [];

      lines.push(`## ${schema.schema}.${schema.table} (${schema.type})`);
      lines.push('');
      lines.push('Columns:');

      for (const col of schema.columns) {
        const flags = [];
        if (!col.nullable) flags.push('NOT NULL');
        if (schema.primaryKeys.includes(col.name)) flags.push('PRIMARY KEY');
        const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
        lines.push(`- ${col.name} (${col.type})${flagStr}`);
      }

      if (schema.foreignKeys.length > 0) {
        lines.push('');
        lines.push('Foreign keys:');
        for (const fk of schema.foreignKeys) {
          lines.push(
            `- ${fk.columnName} → ${fk.referencedSchema}.${fk.referencedTable}.${fk.referencedColumn}`
          );
        }
      }

      parts.push(lines.join('\n'));
    }

    return parts.join('\n\n');
  }

  private static extractJSON(content: string): any {
    // Try direct parse
    try {
      return JSON.parse(content);
    } catch {}

    // Try code fence
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {}
    }

    // Try first { to last }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } catch {}
    }

    throw new Error('No valid JSON found in AI response');
  }
                   }
