/**
 * VYENFITA Application Generation Service
 * 
 * Uses AI to generate application specifications
 * - Structured output with Zod validation
 * - Self-correction on invalid output
 * - Versioned spec
 * 
 * @version 1.0.0
 */

import { z } from 'zod';
import { getAIService } from './ai.service';
import { auditService } from '../audit/audit.service';

// ============================================================
// ZOD SCHEMAS - Structured output validation
// ============================================================

const FieldSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum([
    'string', 'number', 'boolean', 'date', 'datetime',
    'object', 'array', 'reference', 'email', 'phone', 'url',
  ]),
  required: z.boolean().default(false),
  description: z.string().max(200).optional(),
});

const EntitySchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(200).optional(),
  fields: z.array(FieldSchema).min(1),
});

const WidgetSchema = z.object({
  type: z.enum([
    'text', 'button', 'table', 'chart', 'form', 'input',
    'select', 'datepicker', 'card', 'list', 'grid',
  ]),
  props: z.record(z.any()).default({}),
});

const PageSchema = z.object({
  name: z.string().min(1).max(100),
  path: z.string().regex(/^\/[a-z0-9\-/]*$/),
  type: z.enum(['dashboard', 'form', 'table', 'custom', 'login', 'profile', 'settings']),
  widgets: z.array(WidgetSchema).default([]),
});

const ApplicationSpecSchema = z.object({
  metadata: z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  }),
  entities: z.array(EntitySchema).min(1),
  pages: z.array(PageSchema).min(1),
  roles: z.array(z.object({
    name: z.string().min(1).max(50),
    permissions: z.array(z.string()).default([]),
  })).min(1),
});

export type ApplicationSpec = z.infer<typeof ApplicationSpecSchema>;

// ============================================================
// SERVICE
// ============================================================

export interface GenerateApplicationParams {
  tenantId: string;
  userId: string;
  description: string;
  context?: Record<string, any>;
}

export interface GenerationResult {
  spec: ApplicationSpec;
  attempts: number;
  totalTokens: number;
  totalCostUsd: number;
  repairs: number;
  success: boolean;
}

export class GenerationService {
  /**
   * Generate application specification from natural language
   */
  static async generateApplication(
    params: GenerateApplicationParams
  ): Promise<GenerationResult> {
    const ai = getAIService();
    const systemPrompt = this.buildSystemPrompt();

    let totalTokens = 0;
    let totalCostUsd = 0;
    let attempts = 0;
    let repairs = 0;
    let lastError: Error | undefined;
    let lastContent = '';

    // Try up to 3 times with self-correction
    for (let attempt = 1; attempt <= 3; attempt++) {
      attempts = attempt;

      // Build messages
      const messages: any[] = [];
      if (attempt > 1 && lastError) {
        messages.push({
          role: 'user',
          content: `Previous attempt failed validation with error:\n${lastError.message}\n\nPlease fix the JSON and try again.\n\nOriginal request: ${params.description}`,
        });
        repairs++;
      } else {
        messages.push({ role: 'user', content: params.description });
      }

      try {
        const response = await ai.complete(
          {
            systemPrompt,
            messages,
            responseFormat: 'json',
            temperature: 0.3,
            maxTokens: 4096,
          },
          {
            tenantId: params.tenantId,
            userId: params.userId,
            operation: `generate_application_attempt_${attempt}`,
          }
        );

        totalTokens += response.usage.totalTokens;
        totalCostUsd += this.estimateCost(response);

        lastContent = response.content;

        // Extract JSON
        const json = this.extractJSON(response.content);

        // Validate with Zod
        const validation = ApplicationSpecSchema.safeParse(json);

        if (validation.success) {
          // Audit
          await auditService.log({
            tenantId: params.tenantId,
            userId: params.userId,
            eventType: 'create',
            action: 'application.generate',
            resource: 'application_spec',
            details: {
              attempts,
              repairs,
              tokens: totalTokens,
              cost: totalCostUsd,
            },
            status: 'success',
          });

          return {
            spec: validation.data,
            attempts,
            totalTokens,
            totalCostUsd,
            repairs,
            success: true,
          };
        }

        // Validation failed - prepare for retry
        lastError = new Error(
          validation.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('\n')
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    // All attempts failed
    await auditService.log({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType: 'create',
      action: 'application.generate',
      resource: 'application_spec',
      details: {
        attempts,
        repairs,
        tokens: totalTokens,
        cost: totalCostUsd,
        error: lastError?.message,
      },
      status: 'failure',
    });

    throw new Error(
      `Generation failed after ${attempts} attempts. Last error: ${lastError?.message}`
    );
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static buildSystemPrompt(): string {
    return `You are VYENFITA, an AI application architect. Your task is to generate a complete application specification based on the user's business description.

CRITICAL: You MUST output ONLY valid JSON. No explanations, no markdown, no preamble. Just pure JSON.

The JSON MUST match this exact schema:

{
  "metadata": {
    "name": "string (1-100 chars)",
    "description": "string (1-500 chars)",
    "version": "1.0.0"
  },
  "entities": [
    {
      "name": "PascalCaseEntityName",
      "description": "optional string",
      "fields": [
        {
          "name": "camelCaseFieldName",
          "type": "string | number | boolean | date | datetime | object | array | reference | email | phone | url",
          "required": true | false,
          "description": "optional string"
        }
      ]
    }
  ],
  "pages": [
    {
      "name": "Page Name",
      "path": "/lowercase-path",
      "type": "dashboard | form | table | custom | login | profile | settings",
      "widgets": [
        {
          "type": "text | button | table | chart | form | input | select | datepicker | card | list | grid",
          "props": {}
        }
      ]
    }
  ],
  "roles": [
    {
      "name": "RoleName",
      "permissions": ["application:read", "application:create"]
    }
  ]
}

REQUIREMENTS:
- At least 1 entity
- At least 1 page
- At least 1 role (always include an "Admin" role)
- Field names must be camelCase
- Entity names must be PascalCase
- Page paths must start with "/" and be lowercase

Output ONLY the JSON object. Do not wrap in markdown code fences.`;
  }

  private static extractJSON(content: string): any {
    // Try direct parse first
    try {
      return JSON.parse(content);
    } catch {
      // Try to extract from markdown code fences
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1].trim());
      }

      // Try to find first { ... last }
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(content.substring(firstBrace, lastBrace + 1));
      }

      throw new Error('No valid JSON found in AI response');
    }
  }

  private static estimateCost(response: any): number {
    // Simple estimation - actual cost is tracked in ai.service
    const inputCost = (response.usage.promptTokens / 1_000_000) * 10; // rough avg
    const outputCost = (response.usage.completionTokens / 1_000_000) * 30;
    return inputCost + outputCost;
  }
}
