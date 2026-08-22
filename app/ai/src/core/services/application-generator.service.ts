import { AIService } from './ai.service';
import { ChatCompletionParams, ChatMessage } from '../interfaces/ai-provider.interface';
import { ApplicationSpecValidator, ValidationResult, ValidationError } from '../validators/application-spec.validator';
import { ApplicationSpec } from '../schemas/application-spec.schema';
import { ApplicationRepairService } from './application-repair.service';

/**
 * Application Generator Service
 * Generates application structure and code from natural language description
 * with self-correction capability
 */
export class ApplicationGeneratorService {
  private aiService: AIService;
  private repairService: ApplicationRepairService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.repairService = new ApplicationRepairService(aiService);
  }

  /**
   * Generate application from description (legacy)
   */
  async generateApplication(description: string, context?: Record<string, any>): Promise<any> {
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
   * This is the main entry point for application generation
   */
  async generateApplicationWithSelfCorrection(
    description: string, 
    context?: Record<string, any>,
    maxAttempts: number = 3
  ): Promise<GeneratedApplicationWithRepair> {
    // Step 1: Generate initial application
    const initialSpec = await this.generateApplication(description, context);
    
    // Step 2: Validate
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

    // Step 3: Repair if invalid
    const repairResult = await this.repairService.repair(initialSpec);
    
    // Step 4: Final validation
    const finalValidation = repairResult.success && repairResult.spec
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

  /**
   * Generate workflow from description
   */
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

  /**
   * Generate workflow with self-correction
   */
  async generateWorkflowWithSelfCorrection(
    description: string,
    maxAttempts: number = 3
  ): Promise<GeneratedWorkflowWithRepair> {
    // Step 1: Generate initial workflow
    const initialSpec = await this.generateWorkflow(description);
    
    // Step 2: Validate (simplified validation for workflow)
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

    // Step 3: Repair if invalid
    const repairResult = await this.repairService.repairWorkflow(initialSpec, validation.errors);
    
    return {
      success: repairResult.success,
      spec: repairResult.spec,
      validation: repairResult.success ? { isValid: true, errors: [], warnings: [] } : validation,
      repairAttempts: repairResult.repairAttempts,
      isRepaired: true,
      originalErrors: validation.errors,
      fixedErrors: repairResult.fixedErrors,
    };
  }

  /**
   * Generate data model from description
   */
  async generateDataModel(description: string): Promise<any> {
    const systemPrompt = `You are VYENFITA, an expert data architect. Generate a complete data model based on the user's description.

Your response must be a valid JSON object with this structure:
{
  "name": "Data Model Name",
  "description": "Model description",
  "entities": [
    {
      "name": "EntityName",
      "fields": [
        {
          "name": "fieldName",
          "type": "string|number|boolean|date|object|array|reference",
          "required": true|false,
          "description": "Field description"
        }
      ],
      "relationships": [
        {
          "type": "one-to-one|one-to-many|many-to-many",
          "target": "TargetEntity",
          "field": "fieldName"
        }
      ]
    }
  ],
  "indexes": [
    {
      "fields": ["field1", "field2"],
      "unique": true|false
    }
  ]
}`;

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

  /**
   * Generate API specifications from description
   */
  async generateAPI(description: string): Promise<any> {
    const systemPrompt = `You are VYENFITA, an expert API designer. Generate a complete REST API specification based on the user's description.

Your response must be a valid JSON object with this structure:
{
  "name": "API Name",
  "description": "API description",
  "version": "1.0.0",
  "basePath": "/api/v1",
  "endpoints": [
    {
      "path": "/users",
      "method": "GET|POST|PUT|DELETE|PATCH",
      "summary": "Endpoint summary",
      "description": "Detailed description",
      "parameters": [
        {
          "name": "paramName",
          "in": "query|path|body|header",
          "required": true|false,
          "schema": {
            "type": "string|number|boolean|object|array"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "Success response",
          "schema": {
            "type": "object",
            "properties": {}
          }
        }
      }
    }
  ]
}`;

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

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  private getSystemPrompt(): string {
    return `You are VYENFITA, an AI application builder with expertise in low-code and no-code platforms.

Generate complete application structures based on user descriptions. Your output must be production-ready and follow best practices.

Your response must be a valid JSON object with this exact structure:
{
  "metadata": {
    "name": "Application Name",
    "description": "Application description",
    "version": "1.0.0"
  },
  "requirements": [
    {
      "id": "req-1",
      "title": "Requirement title",
      "description": "Requirement description",
      "priority": "critical|high|medium|low",
      "category": "functional|non-functional|security|compliance",
      "acceptanceCriteria": ["criterion 1", "criterion 2"]
    }
  ],
  "entities": [
    {
      "id": "entity-1",
      "name": "EntityName",
      "description": "Entity description",
      "fields": [
        {
          "id": "field-1",
          "name": "fieldName",
          "type": "string|number|boolean|date|datetime|object|array|reference|email|phone|url|json|file|image|password",
          "required": true|false,
          "unique": true|false,
          "description": "Field description"
        }
      ],
      "relationships": [
        {
          "id": "rel-1",
          "type": "one-to-one|one-to-many|many-to-many",
          "target": "TargetEntity",
          "sourceField": "sourceFieldId",
          "targetField": "targetFieldId",
          "cascadeDelete": true|false
        }
      ]
    }
  ],
  "dataSources": [
    {
      "id": "ds-1",
      "name": "Datasource Name",
      "type": "api|database|file|external-service|webhook",
      "config": {
        "url": "https://api.example.com",
        "authType": "none|basic|bearer|oauth2|api-key",
        "headers": {},
        "databaseType": "postgres|mysql|mongodb|sqlite"
      },
      "isDefault": true|false
    }
  ],
  "pages": [
    {
      "id": "page-1",
      "name": "Page Name",
      "path": "/page-url",
      "type": "dashboard|form|table|custom|login|profile|settings|reports",
      "layout": "full|sidebar|split",
      "widgets": [
        {
          "id": "widget-1",
          "type": "text|button|table|chart|form|input|select|datepicker|filepicker|map|image|video|iframe|card|list|grid|tabs|accordion",
          "props": {
            "label": "Widget Label",
            "placeholder": "Placeholder text"
          },
          "position": {
            "x": 0,
            "y": 0,
            "width": 6,
            "height": 4
          },
          "actions": []
        }
      ]
    }
  ],
  "queries": [
    {
      "id": "query-1",
      "name": "Query Name",
      "dataSourceId": "ds-1",
      "query": "SELECT * FROM users WHERE id = :id",
      "parameters": [
        {
          "name": "id",
          "type": "string|number|boolean|date|array",
          "required": true|false
        }
      ],
      "validation": {
        "timeout": 10000,
        "maxRows": 1000
      },
      "isReadOnly": true|false
    }
  ],
  "workflows": [
    {
      "id": "wf-1",
      "name": "Workflow Name",
      "description": "Workflow description",
      "triggers": [
        {
          "id": "trigger-1",
          "type": "schedule|event|webhook|manual|api",
          "config": {
            "schedule": "0 9 * * 1"
          }
        }
      ],
      "steps": [
        {
          "id": "step-1",
          "name": "Step Name",
          "type": "action|condition|loop|wait|parallel|subflow|notification",
          "action": "send_email|update_database|call_api|notify|transform|filter|aggregate|approval|webhook",
          "config": {},
          "conditions": [],
          "onError": "continue|stop|retry|notify"
        }
      ],
      "errorHandling": {
        "retryCount": 3,
        "retryDelay": 5000,
        "notifyOnError": true,
        "notifyTo": ["admin@example.com"]
      }
    }
  ],
  "roles": [
    {
      "id": "role-1",
      "name": "Admin",
      "description": "Administrator role",
      "permissions": [
        {
          "resource": "*",
          "action": "create|read|update|delete|execute|approve"
        }
      ],
      "isDefault": false,
      "isAdmin": true
    },
    {
      "id": "role-2",
      "name": "User",
      "description": "Regular user role",
      "permissions": [
        {
          "resource": "data",
          "action": "read"
        }
      ],
      "isDefault": true,
      "isAdmin": false
    }
  ],
  "integrations": [
    {
      "id": "int-1",
      "name": "Slack",
      "type": "slack|email|sms|webhook|zapier|make|salesforce|hubspot",
      "config": {},
      "isEnabled": true
    }
  ],
  "tests": {
    "unit": [],
    "integration": [],
    "security": []
  },
  "deployment": {
    "environments": [
      {
        "name": "development",
        "url": "http://localhost:8080",
        "config": {},
        "variables": {}
      }
    ],
    "autoDeploy": false,
    "requireApproval": true,
    "healthCheck": {
      "path": "/health",
      "timeout": 5000,
      "expectedStatus": 200
    }
  },
  "audit": {
    "changes": [],
    "logs": []
  }
}`;
  }

  private getWorkflowSystemPrompt(): string {
    return `You are VYENFITA, an expert in business process automation and workflow design.

Generate automation workflows based on user descriptions. Your workflows must be reliable, scalable, and follow best practices.

Your response must be a valid JSON object with this exact structure:
{
  "id": "wf-1",
  "name": "Workflow Name",
  "description": "Workflow description",
  "version": "1.0.0",
  "triggers": [
    {
      "id": "trigger-1",
      "type": "schedule|event|webhook|manual|api",
      "config": {
        "schedule": "0 9 * * 1",
        "event": "user.created",
        "webhook": "/webhook/path"
      }
    }
  ],
  "steps": [
    {
      "id": "step-1",
      "name": "Step Name",
      "type": "action|condition|loop|wait|parallel|subflow|notification",
      "action": "send_email|update_database|call_api|notify|transform|filter|aggregate|approval|webhook",
      "config": {
        "from": "sender@example.com",
        "to": "recipient@example.com",
        "subject": "Email Subject",
        "body": "Email body content"
      },
      "conditions": [
        {
          "field": "data.field",
          "operator": "equals|not_equals|greater_than|less_than|contains|starts_with|ends_with|is_true|is_false|is_null",
          "value": "expected value"
        }
      ],
      "onError": "continue|stop|retry|notify",
      "retryConfig": {
        "maxAttempts": 3,
        "delayMs": 5000
      }
    }
  ],
  "errorHandling": {
    "retryCount": 3,
    "retryDelay": 5000,
    "notifyOnError": true,
    "notifyTo": ["admin@example.com"]
  }
}`;
  }

  private buildUserPrompt(description: string, context?: Record<string, any>): string {
    let prompt = `Build a complete application for: ${description}\n\n`;
    
    if (context) {
      prompt += `Additional context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += 'Generate the application structure in JSON format. Make sure it follows the exact schema provided.';
    return prompt;
  }

  private parseApplication(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
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

  // ============================================================
  // WORKFLOW VALIDATION
  // ============================================================

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
            path: ['steps', i, 'type'],
            message: `Step ${i + 1}: type is required`,
            type: 'required',
          });
        }
        if (!step.action) {
          errors.push({
            path: ['steps', i, 'action'],
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
