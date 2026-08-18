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

  private getSystemPrompt(): string {
    return `You are VYENFITA, an AI application builder. Generate complete application structures based on user descriptions.

Your response must be a valid JSON object with this structure:
{
  "name": "Application Name",
  "description": "Application description",
  "pages": [
    {
      "id": "page-1",
      "name": "Page Name",
      "type": "dashboard|form|table|custom",
      "widgets": [
        {
          "id": "widget-1",
          "type": "text|button|table|chart|form|input",
          "props": { /* widget properties */ }
        }
      ]
    }
  ],
  "datasources": [
    {
      "id": "ds-1",
      "type": "api|database|file",
      "config": { /* datasource config */ }
    }
  ],
  "queries": [
    {
      "id": "query-1",
      "name": "Query Name",
      "datasourceId": "ds-1",
      "query": "SELECT * FROM users"
    }
  ]
}`;
  }

  private getWorkflowSystemPrompt(): string {
    return `You are VYENFITA, an AI workflow builder. Generate automation workflows based on user descriptions.

Your response must be a valid JSON object with this structure:
{
  "name": "Workflow Name",
  "description": "Workflow description",
  "triggers": [
    {
      "type": "schedule|event|webhook",
      "config": { /* trigger configuration */ }
    }
  ],
  "steps": [
    {
      "id": "step-1",
      "type": "action|condition|loop|wait",
      "action": "send_email|update_database|call_api|notify",
      "config": { /* step configuration */ }
    }
  ]
}`;
  }

  private buildUserPrompt(description: string, context?: Record<string, any>): string {
    let prompt = `Build an application for: ${description}\n\n`;
    
    if (context) {
      prompt += `Context: ${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += 'Generate the application structure in JSON format.';
    return prompt;
  }

  private parseApplication(content: string): GeneratedApplication {
    try {
      // Try to extract JSON from the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
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
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse generated workflow: ${error}`);
    }
  }
}

/**
 * Generated application structure
 */
export interface GeneratedApplication {
  name: string;
  description: string;
  pages: GeneratedPage[];
  datasources: GeneratedDatasource[];
  queries: GeneratedQuery[];
}

/**
 * Generated page structure
 */
export interface GeneratedPage {
  id: string;
  name: string;
  type: 'dashboard' | 'form' | 'table' | 'custom';
  widgets: GeneratedWidget[];
}

/**
 * Generated widget structure
 */
export interface GeneratedWidget {
  id: string;
  type: 'text' | 'button' | 'table' | 'chart' | 'form' | 'input';
  props: Record<string, any>;
}

/**
 * Generated datasource structure
 */
export interface GeneratedDatasource {
  id: string;
  type: 'api' | 'database' | 'file';
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
}

/**
 * Generated workflow structure
 */
export interface GeneratedWorkflow {
  name: string;
  description: string;
  triggers: GeneratedTrigger[];
  steps: GeneratedStep[];
}

/**
 * Generated trigger structure
 */
export interface GeneratedTrigger {
  type: 'schedule' | 'event' | 'webhook';
  config: Record<string, any>;
}

/**
 * Generated step structure
 */
export interface GeneratedStep {
  id: string;
  type: 'action' | 'condition' | 'loop' | 'wait';
  action?: 'send_email' | 'update_database' | 'call_api' | 'notify';
  config: Record<string, any>;
}
