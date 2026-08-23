/**
 * VYENFITA Multi-Step Generator
 * 
 * Generates applications in multiple steps for better quality:
 * 1. Requirement Analysis
 * 2. Architecture Design
 * 3. Data Model Design
 * 4. UI/UX Design
 * 5. Application Build
 * 6. Validation & Repair
 * 
 * @version 1.0.0
 */

import { AIService } from './ai.service';
import { ApplicationSpecValidator } from '../validators/application-spec.validator';
import { ApplicationSpec } from '../schemas/application-spec.schema';
import { ApplicationRepairService } from './application-repair.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface GenerationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface MultiStepResult {
  success: boolean;
  steps: GenerationStep[];
  spec?: ApplicationSpec;
  errors: string[];
  warnings: string[];
  elapsed: number;
}

export class MultiStepGenerator {
  private aiService: AIService;
  private repairService: ApplicationRepairService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.repairService = new ApplicationRepairService(aiService);
  }

  /**
   * Generate application with multi-step process
   */
  async generate(description: string, context?: Record<string, any>): Promise<MultiStepResult> {
    const startTime = Date.now();
    const steps: GenerationStep[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // ============================================================
      // STEP 1: REQUIREMENT ANALYSIS
      // ============================================================
      const step1 = await this.runStep(
        'requirement-analysis',
        'Requirement Analysis',
        () => this.analyzeRequirements(description, context)
      );
      steps.push(step1);
      if (step1.status === 'failed') {
        errors.push(step1.error || 'Requirement analysis failed');
      }

      // ============================================================
      // STEP 2: ARCHITECTURE DESIGN
      // ============================================================
      const step2 = await this.runStep(
        'architecture-design',
        'Architecture Design',
        () => this.designArchitecture(step1.output || description, context)
      );
      steps.push(step2);
      if (step2.status === 'failed') {
        errors.push(step2.error || 'Architecture design failed');
      }

      // ============================================================
      // STEP 3: DATA MODEL DESIGN
      // ============================================================
      const step3 = await this.runStep(
        'data-model-design',
        'Data Model Design',
        () => this.designDataModel(step2.output || description, context)
      );
      steps.push(step3);
      if (step3.status === 'failed') {
        errors.push(step3.error || 'Data model design failed');
      }

      // ============================================================
      // STEP 4: UI/UX DESIGN
      // ============================================================
      const step4 = await this.runStep(
        'ui-design',
        'UI/UX Design',
        () => this.designUI(step3.output || description, context)
      );
      steps.push(step4);
      if (step4.status === 'failed') {
        errors.push(step4.error || 'UI/UX design failed');
      }

      // ============================================================
      // STEP 5: APPLICATION BUILD
      // ============================================================
      const step5 = await this.runStep(
        'application-build',
        'Application Build',
        () => this.buildApplication(step4.output || description, context)
      );
      steps.push(step5);
      if (step5.status === 'failed') {
        errors.push(step5.error || 'Application build failed');
      }

      // ============================================================
      // STEP 6: VALIDATION & REPAIR
      // ============================================================
      let spec = step5.output;
      if (spec) {
        const validation = ApplicationSpecValidator.validate(spec);
        if (!validation.isValid) {
          const repairResult = await this.repairService.repair(spec);
          if (repairResult.success && repairResult.spec) {
            spec = repairResult.spec;
            warnings.push(`Repaired ${repairResult.fixedErrors?.length || 0} errors`);
          } else {
            errors.push('Failed to repair application specification');
          }
        }
        if (validation.warnings && validation.warnings.length > 0) {
          warnings.push(...validation.warnings.map(w => w.message));
        }
      }

      const elapsed = Date.now() - startTime;

      return {
        success: errors.length === 0,
        steps,
        spec,
        errors,
        warnings,
        elapsed,
      };

    } catch (error) {
      const elapsed = Date.now() - startTime;
      return {
        success: false,
        steps,
        spec: undefined,
        errors: [...errors, error instanceof Error ? error.message : 'Unknown error'],
        warnings,
        elapsed,
      };
    }
  }

  // ============================================================
  // STEP EXECUTOR
  // ============================================================

  private async runStep(
    id: string,
    name: string,
    fn: () => Promise<any>
  ): Promise<GenerationStep> {
    const step: GenerationStep = {
      id,
      name,
      status: 'running',
      startedAt: new Date(),
    };

    try {
      const output = await fn();
      step.status = 'completed';
      step.output = output;
      step.completedAt = new Date();
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.completedAt = new Date();
    }

    return step;
  }

  // ============================================================
  // STEP IMPLEMENTATIONS
  // ============================================================

  /**
   * STEP 1: Analyze requirements
   */
  private async analyzeRequirements(description: string, context?: Record<string, any>): Promise<any> {
    const systemPrompt = `You are VYENFITA Requirement Analyst. Analyze the user's description and extract structured requirements.

Output a valid JSON object:
{
  "summary": "Brief summary of the application",
  "purpose": "What problem does this solve?",
  "users": ["User type 1", "User type 2"],
  "features": [
    {
      "id": "feat-1",
      "name": "Feature name",
      "description": "Feature description",
      "priority": "critical|high|medium|low"
    }
  ],
  "constraints": ["Constraint 1", "Constraint 2"],
  "assumptions": ["Assumption 1", "Assumption 2"]
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description + (context ? `\n\nContext: ${JSON.stringify(context)}` : '') },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.4,
      maxTokens: 2048,
    });

    return this.extractJSON(response.choices[0].message.content);
  }

  /**
   * STEP 2: Design architecture
   */
  private async designArchitecture(requirements: any, context?: Record<string, any>): Promise<any> {
    const systemPrompt = `You are VYENFITA Architecture Designer. Design the architecture based on the requirements.

Output a valid JSON object:
{
  "patterns": ["Pattern 1", "Pattern 2"],
  "layers": [
    {
      "name": "Layer name",
      "description": "Layer description",
      "components": ["Component 1", "Component 2"]
    }
  ],
  "dataFlow": "Description of data flow",
  "integrations": ["Integration 1", "Integration 2"],
  "scalability": {
    "strategy": "Scalability strategy",
    "estimatedLoad": "Estimated load"
  }
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(requirements, null, 2) },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 2048,
    });

    return this.extractJSON(response.choices[0].message.content);
  }

  /**
   * STEP 3: Design data model
   */
  private async designDataModel(architecture: any, context?: Record<string, any>): Promise<any> {
    const systemPrompt = `You are VYENFITA Data Model Designer. Design the data model based on the architecture.

Output a valid JSON object with entities, fields, and relationships.
Follow this structure:
{
  "entities": [
    {
      "name": "EntityName",
      "fields": [
        {"name": "fieldName", "type": "string|number|boolean|date|reference", "required": true|false}
      ],
      "relationships": [
        {"type": "one-to-many", "target": "TargetEntity", "sourceField": "field", "targetField": "field"}
      ]
    }
  ]
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(architecture, null, 2) },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 4096,
    });

    return this.extractJSON(response.choices[0].message.content);
  }

  /**
   * STEP 4: Design UI/UX
   */
  private async designUI(dataModel: any, context?: Record<string, any>): Promise<any> {
    const systemPrompt = `You are VYENFITA UI/UX Designer. Design the user interface based on the data model.

Output a valid JSON object:
{
  "pages": [
    {
      "name": "Page Name",
      "path": "/path",
      "type": "dashboard|form|table|login|profile|settings",
      "widgets": [
        {
          "type": "text|button|table|chart|form|input|select|card",
          "props": {"label": "Label", "placeholder": "Placeholder"}
        }
      ]
    }
  ],
  "navigation": {
    "type": "sidebar|top|bottom",
    "items": ["Page 1", "Page 2"]
  },
  "theme": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "fontFamily": "font-family"
  }
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(dataModel, null, 2) },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.4,
      maxTokens: 4096,
    });

    return this.extractJSON(response.choices[0].message.content);
  }

  /**
   * STEP 5: Build application
   */
  private async buildApplication(uiDesign: any, context?: Record<string, any>): Promise<any> {
    // Combine all previous steps into a complete application spec
    // This is a simplified version - in reality, this would use a template system
    const spec = {
      metadata: {
        name: context?.name || 'Generated Application',
        description: context?.description || 'Application generated by VYENFITA',
        version: '1.0.0',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      requirements: context?.requirements || [],
      entities: uiDesign.entities || [],
      pages: uiDesign.pages || [],
      roles: [
        {
          id: 'role-admin',
          name: 'Admin',
          isAdmin: true,
          isDefault: false,
          permissions: [{ resource: '*', action: 'all' }],
        },
        {
          id: 'role-user',
          name: 'User',
          isAdmin: false,
          isDefault: true,
          permissions: [{ resource: 'data', action: 'read' }],
        },
      ],
      dataSources: [
        {
          id: 'ds-main',
          name: 'Main Database',
          type: 'database',
          config: { databaseType: 'postgres' },
          isDefault: true,
        },
      ],
      workflows: [],
      integrations: [],
      tests: { unit: [], integration: [], security: [] },
      deployment: {
        environments: [{ name: 'development', config: {}, variables: {} }],
        autoDeploy: false,
        requireApproval: true,
        healthCheck: { path: '/health', timeout: 5000, expectedStatus: 200 },
      },
      audit: { changes: [], logs: [] },
    };

    return spec;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private extractJSON(content: string): any {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  }
}
