/**
 * VYENFITA Application Repair Service
 * Automatically repairs invalid application specifications
 * 
 * This is the core of the self-correction loop.
 * It takes an invalid spec, identifies errors, and asks the AI to fix them.
 */

import { AIService } from './ai.service';
import { ApplicationSpecValidator, ValidationError } from '../validators/application-spec.validator';
import { ApplicationSpec } from '../schemas/application-spec.schema';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface RepairResult {
  success: boolean;
  spec?: ApplicationSpec;
  errors: ValidationError[];
  warnings: string[];
  repairAttempts: number;
  originalErrors: ValidationError[];
  fixedErrors: string[];
}

export class ApplicationRepairService {
  private aiService: AIService;
  private maxRepairAttempts: number = 3;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Repair an invalid application specification
   */
  async repair(spec: any, attempt: number = 1): Promise<RepairResult> {
    const originalErrors = ApplicationSpecValidator.getValidationErrors(spec);
    const fixedErrors: string[] = [];

    // If already valid, return immediately
    if (ApplicationSpecValidator.isValid(spec)) {
      return {
        success: true,
        spec: spec as ApplicationSpec,
        errors: [],
        warnings: [],
        repairAttempts: 0,
        originalErrors: [],
        fixedErrors: [],
      };
    }

    // If max attempts reached, fail
    if (attempt > this.maxRepairAttempts) {
      return {
        success: false,
        errors: ApplicationSpecValidator.getValidationErrors(spec),
        warnings: [],
        repairAttempts: attempt,
        originalErrors,
        fixedErrors,
      };
    }

    try {
      // Get AI to fix the errors
      const fixedSpec = await this.requestRepair(spec, originalErrors);

      // Validate the fixed spec
      const validation = ApplicationSpecValidator.validate(fixedSpec);

      if (validation.isValid && validation.data) {
        return {
          success: true,
          spec: validation.data,
          errors: [],
          warnings: validation.warnings.map(w => w.message),
          repairAttempts: attempt,
          originalErrors,
          fixedErrors: originalErrors.map(e => e.message),
        };
      }

      // If still invalid, try again recursively
      const retryResult = await this.repair(fixedSpec, attempt + 1);
      
      return {
        ...retryResult,
        originalErrors,
        fixedErrors: [
          ...originalErrors.map(e => e.message),
          ...retryResult.fixedErrors,
        ],
      };
    } catch (error) {
      return {
        success: false,
        errors: originalErrors,
        warnings: [],
        repairAttempts: attempt,
        originalErrors,
        fixedErrors: [],
      };
    }
  }

  /**
   * Request AI to repair the specification
   */
  private async requestRepair(spec: any, errors: ValidationError[]): Promise<any> {
    const systemPrompt = this.getRepairSystemPrompt();
    const userPrompt = this.buildRepairPrompt(spec, errors);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3, // Lower temperature for more precise fixes
      maxTokens: 4096,
    });

    return this.extractJSON(response.choices[0].message.content);
  }

  /**
   * Get the repair system prompt
   */
  private getRepairSystemPrompt(): string {
    return `You are VYENFITA Repair Agent, a specialized AI that fixes invalid application specifications.

Your ONLY job is to repair the provided application specification so it passes validation.

RULES:
1. DO NOT change the core functionality or user intent
2. ONLY fix the specific errors listed
3. PRESERVE all valid parts of the specification
4. If an entity is missing fields, add reasonable default fields
5. If a reference is invalid, fix it or suggest alternatives
6. If a required field is missing, add it with a reasonable default
7. Output ONLY the repaired JSON specification, nothing else
8. Do NOT add explanations, comments, or markdown

The fixed specification MUST match the schema exactly.
Focus ONLY on fixing the errors listed below.`;
  }

  /**
   * Build the repair prompt
   */
  private buildRepairPrompt(spec: any, errors: ValidationError[]): string {
    const errorDetails = errors.map((e, i) => 
      `${i + 1}. [${e.path.join('.')}] ${e.message}`
    ).join('\n');

    return `The following application specification has validation errors.

ERRORS TO FIX:
${errorDetails}

CURRENT SPECIFICATION:
${JSON.stringify(spec, null, 2)}

Please fix the errors and output the repaired specification as valid JSON.
Remember: Output ONLY the fixed JSON, nothing else.`;
  }

  /**
   * Extract JSON from AI response
   */
  private extractJSON(content: string): any {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    return JSON.parse(jsonMatch[0]);
  }
  }
