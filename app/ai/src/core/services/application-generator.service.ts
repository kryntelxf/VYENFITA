/**
 * VYENFITA Application Generator Service
 * 
 * @version 1.0.2
 */

import { AIService } from './ai.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';
import { ApplicationSpecValidator, ValidationResult, ValidationError } from '../validators/application-spec.validator';
import { ApplicationSpec } from '../schemas/application-spec.schema';
import { ApplicationRepairService } from './application-repair.service';

export class ApplicationGeneratorService {
  private aiService: AIService;
  private repairService: ApplicationRepairService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.repairService = new ApplicationRepairService(aiService);
  }

  async generateApplication(
    description: string,
    context?: Record<string, any>
  ): Promise<any> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(description, context);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.7,
      maxTokens: 4096,
    });

    return this.parseApplication(response.choices[0].message.content);
  }

  /**
   * Generate application with self-correction
   */
  async generateApplicationWithSelfCorrection(
    description: string,
    context?: Record<string, any>,
    _maxAttempts: number = 3
  ): Promise<GeneratedApplicationWithRepair> {
    const initialSpec = await this.generateApplication(description, context);
    const validation = ApplicationSpecValidator.validate(initialSpec);

    if (validation.isValid && validation.data) {
      return {
        success: true,
        spec: validation.data,
        validation,
        repairAttempts: 0,
        isRepaired: false,
      };
    }

    const repairResult = await this.repairService.repair(initialSpec);

    const finalValidation =
      repairResult.success && repairResult.spec
        ? ApplicationSpecValidator.validate(repairResult.spec)
        : validation;

    return {
      success: repairResult.success,
      spec: repairResult.spec,
      validation: finalValidation,
      repairAttempts: repairResult.repairAttempts,
      isRepaired: true,
      originalErrors: repairResult.originalErrors,
      fixedErrors: repairResult.fixedErrors,
    };
  }

  async generateWorkflow(description: string): Promise<any> {
    const systemPrompt = this.getWorkflowSystemPrompt();
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.5,
      maxTokens: 4096,
    });

    return this.parseWorkflow(response.choices[0].message.content);
  }

  async generateWorkflowWithSelfCorrection(
    description: string,
    _maxAttempts: number = 3
  ): Promise<GeneratedWorkflowWithRepair> {
    const initialSpec = await this.generateWorkflow(description);
    const validation = this.validateWorkflow(initialSpec);

    if (validation.isValid) {
      return {
        success: true,
        spec: initialSpec,
        validation,
        repairAttempts: 0,
        isRepaired: false,
      };
    }

    // Try to repair
    const repairResult = await this.repairService.repairWorkflow(
      initialSpec,
      validation.errors
    );

    return {
      success: repairResult.success,
      spec: repairResult.spec,
      validation: repairResult.success
        ? { isValid: true, errors: [], warnings: [] }
        : validation,
      repairAttempts: repairResult.repairAttempts,
      isRepaired: true,
      originalErrors: validation.errors,
      fixedErrors: repairResult.fixedErrors,
    };
  }

  async generateDataModel(description: string): Promise<any> {
    const systemPrompt = `You are VYENFITA, an expert data architect. Generate a complete data model.

Output valid JSON with entities, fields, relationships.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 4096,
    });

    return this.parseDataModel(response.choices[0].message.content);
  }

  async generateAPI(description: string): Promise<any> {
    const systemPrompt = `You are VYENFITA, an expert API designer. Generate REST API spec.

Output valid JSON with endpoints, parameters, responses.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.4,
      maxTokens: 4096,
    });

    return this.parseAPI(response.choices[0].message.content);
  }

  private getSystemPrompt(): string {
    return `You are VYENFITA, an AI application builder.

Generate complete application structures based on user descriptions.

Output must be valid JSON with this structure:
{
  "metadata": { "name": "...", "description": "...", "version": "1.0.0" },
  "requirements": [],
  "entities": [],
  "dataSources": [],
  "pages": [],
  "queries": [],
  "workflows": [],
  "roles": [],
  "integrations": [],
  "tests": { "unit": [], "integration": [], "security": [] },
  "deployment": { "environments": [], "autoDeploy": false, "requireApproval": true },
  "audit": { "changes": [], "logs": [] }
}`;
  }

  private getWorkflowSystemPrompt(): string {
    return `You are VYENFITA, an expert in business process automation.

Output valid JSON with triggers, steps, errorHandling.`;
  }

  private buildUserPrompt(
    description: string,
    context?: Record<string, any>
  ): string {
    let prompt = `Build a complete application for: ${description}\n\n`;
    if (context) {
      prompt += `Additional context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }
    prompt += 'Generate the application structure in JSON format.';
    return prompt;
  }

  private parseApplication(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.metadata?.name) {
        throw new Error('Invalid application structure: missing metadata.name');
      }
      if (!parsed.entities || parsed.entities.length === 0) {
        throw new Error('Invalid application structure: missing entities');
      }
      if (!parsed.pages || parsed.pages.length === 0) {
        throw new Error('Invalid application structure: missing pages');
      }
      if (!parsed.roles || parsed.roles.length === 0) {
        throw new Error('Invalid application structure: missing roles');
      }

      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse generated application: ${error}`);
    }
  }

  private parseWorkflow(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.name) {
        throw new Error('Invalid workflow structure: missing name');
      }
      if (!parsed.steps || parsed.steps.length === 0) {
        throw new Error('Invalid workflow structure: missing steps');
      }

      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse generated workflow: ${error}`);
    }
  }

  private parseDataModel(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse data model: ${error}`);
    }
  }

  private parseAPI(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse API specification: ${error}`);
    }
  }

  private validateWorkflow(data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: any[] = [];

    if (!data.name) {
      errors.push({
        path: ['name'],
        message: 'Workflow name is required',
        type: 'required',
      });
    }

    if (!data.steps || data.steps.length === 0) {
      errors.push({
        path: ['steps'],
        message: 'At least one step is required',
        type: 'required',
      });
    }

    if (data.steps) {
      for (let i = 0; i < data.steps.length; i++) {
        const step = data.steps[i];
        if (!step.type) {
          errors.push({
            path: ['steps', String(i), 'type'],
            message: `Step ${i + 1}: type is required`,
            type: 'required',
          });
        }
        if (!step.action) {
          errors.push({
            path: ['steps', String(i), 'action'],
            message: `Step ${i + 1}: action is required`,
            type: 'required',
          });
        }
      }
    }

    if (!data.triggers || data.triggers.length === 0) {
      warnings.push({
        path: ['triggers'],
        message: 'No triggers defined. Workflow may not run automatically.',
        type: 'suggestion',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ============================================================
// TYPES
// ============================================================

export interface GeneratedApplicationWithRepair {
  success: boolean;
  spec?: ApplicationSpec;
  validation: ValidationResult;
  repairAttempts: number;
  isRepaired: boolean;
  originalErrors?: ValidationError[];
  fixedErrors?: string[];
}

export interface GeneratedWorkflowWithRepair {
  success: boolean;
  spec?: any;
  validation: ValidationResult;
  repairAttempts: number;
  isRepaired: boolean;
  originalErrors?: ValidationError[];
  fixedErrors?: string[];
  }
