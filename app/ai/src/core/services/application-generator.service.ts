import { AIService } from './ai.service';
import { ChatCompletionParams, ChatMessage } from '../interfaces/ai-provider.interface';

/**
 * Application Generator Service
 * Generates application structure and code from natural language description
 */
export class ApplicationGeneratorService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Generate application from description
   */
  async generateApplication(description: string, context?: Record<string, any>): Promise<GeneratedApplication> {
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
   * Generate workflow from description
   */
  async generateWorkflow(description: string): Promise<GeneratedWorkflow> {
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
   * Generate data model from description
   */
  async generateDataModel(description: string): Promise<GeneratedDataModel> {
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
  async generateAPI(description: string): Promise<GeneratedAPI> {
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

  private getSystemPrompt(): string {
    return `You are VYENFITA, an AI application builder with expertise in low-code and no-code platforms.

Generate complete application structures based on user descriptions. Your output must be production-ready and follow best practices.

Your response must be a valid JSON object with this exact structure:
{
  "name": "Application Name",
  "description": "Application description",
  "version": "1.0.0",
  "pages": [
    {
      "id": "page-1",
      "name": "Page Name",
      "type": "dashboard|form|table|custom|login|profile|settings",
      "path": "/page-url",
      "widgets": [
        {
          "id": "widget-1",
          "type": "text|button|table|chart|form|input|select|datepicker|filepicker|map|image|video|iframe",
          "props": {
            "label": "Widget Label",
            "placeholder": "Placeholder text",
            "value": "Default value",
            "options": ["Option 1", "Option 2"],
            "width": "100%",
            "height": "auto"
          }
        }
      ],
      "actions": [
        {
          "id": "action-1",
          "type": "submit|reset|navigate|api-call|database-query|file-upload|download",
          "config": {
            "method": "GET|POST|PUT|DELETE",
            "url": "/api/endpoint",
            "body": {}
          }
        }
      ]
    }
  ],
  "datasources": [
    {
      "id": "ds-1",
      "name": "Datasource Name",
      "type": "api|database|file|external-service",
      "config": {
        "url": "https://api.example.com",
        "authType": "none|basic|bearer|oauth2",
        "headers": {}
      }
    }
  ],
  "queries": [
    {
      "id": "query-1",
      "name": "Query Name",
      "datasourceId": "ds-1",
      "query": "SELECT * FROM users WHERE id = :id",
      "parameters": [
        {
          "name": "id",
          "type": "number",
          "required": true
        }
      ]
    }
  ],
  "state": {
    "variables": [
      {
        "name": "variableName",
        "type": "string|number|boolean|object|array",
        "default": "default value"
      }
    ]
  }
}`;
  }

  private getWorkflowSystemPrompt(): string {
    return `You are VYENFITA, an expert in business process automation and workflow design.

Generate automation workflows based on user descriptions. Your workflows must be reliable, scalable, and follow best practices.

Your response must be a valid JSON object with this exact structure:
{
  "name": "Workflow Name",
  "description": "Workflow description",
  "version": "1.0.0",
  "triggers": [
    {
      "id": "trigger-1",
      "type": "schedule|event|webhook|manual|api",
      "config": {
        "schedule": "0 9 * * 1", // Cron expression for schedule type
        "event": "user.created", // Event name for event type
        "webhook": "/webhook/path" // Webhook path for webhook type
      }
    }
  ],
  "steps": [
    {
      "id": "step-1",
      "name": "Step Name",
      "type": "action|condition|loop|wait|parallel|subflow",
      "action": "send_email|update_database|call_api|notify|transform|filter|aggregate",
      "config": {
        "from": "sender@example.com",
        "to": "recipient@example.com",
        "subject": "Email Subject",
        "body": "Email body content"
      },
      "conditions": [
        {
          "field": "data.field",
          "operator": "equals|not_equals|greater_than|less_than|contains|starts_with|ends_with",
          "value": "expected value"
        }
      ],
      "onError": "continue|stop|retry"
    }
  ],
  "errorHandling": {
    "retryCount": 3,
    "retryDelay": 5000,
    "notifyOnError": true,
    "notifyTo": "admin@example.com"
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

  private parseApplication(content: string): GeneratedApplication {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.name || !parsed.pages) {
        throw new Error('Invalid application structure: missing name or pages');
      }
      
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse generated application: ${error}`);
    }
  }

  private parseWorkflow(content: string): GeneratedWorkflow {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.name || !parsed.steps) {
        throw new Error('Invalid workflow structure: missing name or steps');
      }
      
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse generated workflow: ${error}`);
    }
  }

  private parseDataModel(content: string): GeneratedDataModel {
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

  private parseAPI(content: string): GeneratedAPI {
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
}

/**
 * Generated application structure
 */
export interface GeneratedApplication {
  name: string;
  description: string;
  version: string;
  pages: GeneratedPage[];
  datasources: GeneratedDatasource[];
  queries: GeneratedQuery[];
  state: {
    variables: GeneratedVariable[];
  };
}

/**
 * Generated page structure
 */
export interface GeneratedPage {
  id: string;
  name: string;
  type: 'dashboard' | 'form' | 'table' | 'custom' | 'login' | 'profile' | 'settings';
  path: string;
  widgets: GeneratedWidget[];
  actions: GeneratedAction[];
}

/**
 * Generated widget structure
 */
export interface GeneratedWidget {
  id: string;
  type: 'text' | 'button' | 'table' | 'chart' | 'form' | 'input' | 'select' | 'datepicker' | 'filepicker' | 'map' | 'image' | 'video' | 'iframe';
  props: Record<string, any>;
}

/**
 * Generated action structure
 */
export interface GeneratedAction {
  id: string;
  type: 'submit' | 'reset' | 'navigate' | 'api-call' | 'database-query' | 'file-upload' | 'download';
  config: Record<string, any>;
}

/**
 * Generated datasource structure
 */
export interface GeneratedDatasource {
  id: string;
  name: string;
  type: 'api' | 'database' | 'file' | 'external-service';
  config: Record<string, any>;
}

/**
 * Generated query structure
 */
export interface GeneratedQuery {
  id: string;
  name: string;
  datasourceId: string;
  query: string;
  parameters: GeneratedParameter[];
}

/**
 * Generated parameter structure
 */
export interface GeneratedParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
}

/**
 * Generated variable structure
 */
export interface GeneratedVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  default: any;
}

/**
 * Generated workflow structure
 */
export interface GeneratedWorkflow {
  name: string;
  description: string;
  version: string;
  triggers: GeneratedTrigger[];
  steps: GeneratedWorkflowStep[];
  errorHandling: {
    retryCount: number;
    retryDelay: number;
    notifyOnError: boolean;
    notifyTo: string;
  };
}

/**
 * Generated trigger structure
 */
export interface GeneratedTrigger {
  id: string;
  type: 'schedule' | 'event' | 'webhook' | 'manual' | 'api';
  config: Record<string, any>;
}

/**
 * Generated workflow step structure
 */
export interface GeneratedWorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'loop' | 'wait' | 'parallel' | 'subflow';
  action?: 'send_email' | 'update_database' | 'call_api' | 'notify' | 'transform' | 'filter' | 'aggregate';
  config: Record<string, any>;
  conditions?: GeneratedCondition[];
  onError: 'continue' | 'stop' | 'retry';
}

/**
 * Generated condition structure
 */
export interface GeneratedCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'starts_with' | 'ends_with';
  value: any;
}

/**
 * Generated data model structure
 */
export interface GeneratedDataModel {
  name: string;
  description: string;
  entities: GeneratedEntity[];
  indexes: GeneratedIndex[];
}

/**
 * Generated entity structure
 */
export interface GeneratedEntity {
  name: string;
  fields: GeneratedField[];
  relationships: GeneratedRelationship[];
}

/**
 * Generated field structure
 */
export interface GeneratedField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'reference';
  required: boolean;
  description?: string;
}

/**
 * Generated relationship structure
 */
export interface GeneratedRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
  field: string;
}

/**
 * Generated index structure
 */
export interface GeneratedIndex {
  fields: string[];
  unique: boolean;
}

/**
 * Generated API structure
 */
export interface GeneratedAPI {
  name: string;
  description: string;
  version: string;
  basePath: string;
  endpoints: GeneratedEndpoint[];
}

/**
 * Generated endpoint structure
 */
export interface GeneratedEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description: string;
  parameters: GeneratedAPIParameter[];
  responses: Record<string, GeneratedAPIResponse>;
}

/**
 * Generated API parameter structure
 */
export interface GeneratedAPIParameter {
  name: string;
  in: 'query' | 'path' | 'body' | 'header';
  required: boolean;
  schema: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    properties?: Record<string, any>;
  };
}

/**
 * Generated API response structure
 */
export interface GeneratedAPIResponse {
  description: string;
  schema: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    properties?: Record<string, any>;
  };
      }
