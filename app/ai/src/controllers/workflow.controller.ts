/**
 * VYENFITA Workflow Controller
 * API endpoints for workflow management and execution
 */

import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { WorkflowEngine } from '../core/engine/workflow-engine';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

const workflowEngine = new WorkflowEngine(logger);

export class WorkflowController {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { workflow, variables, triggerData } = req.body;
      const tenantId = req.headers['x-tenant-id'] as string || 'default';

      if (!workflow) {
        res.status(400).json({
          success: false,
          error: 'workflow is required',
        });
        return;
      }

      const result = await workflowEngine.startExecution(workflow, {
        tenantId,
        variables: variables || {},
        triggerData: triggerData || {},
      });

      res.json({
        success: true,
        data: {
          executionId: result.id,
          status: result.status,
          startedAt: result.startedAt,
          steps: result.steps,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get execution status
   */
  async getExecution(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;

      const execution = workflowEngine.getExecution(executionId);
      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found',
        });
        return;
      }

      res.json({
        success: true,
        data: execution,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List executions for a workflow
   */
  async listExecutions(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;

      if (!workflowId) {
        res.status(400).json({
          success: false,
          error: 'workflowId is required',
        });
        return;
      }

      const executions = workflowEngine.getExecutions(workflowId);
      res.json({
        success: true,
        data: executions,
        count: executions.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate workflow from description and execute immediately
   */
  async generateAndExecute(req: Request, res: Response): Promise<void> {
    try {
      const { description, variables, triggerData } = req.body;
      const tenantId = req.headers['x-tenant-id'] as string || 'default';

      if (!description) {
        res.status(400).json({
          success: false,
          error: 'description is required',
        });
        return;
      }

      // Generate workflow using AI
      const messages = [
        { role: 'system', content: this.getWorkflowSystemPrompt() },
        { role: 'user', content: description },
      ];

      const response = await this.aiService.chat({
        messages,
        temperature: 0.5,
        maxTokens: 4096,
      });

      const workflow = JSON.parse(response.choices[0].message.content);

      // Execute the generated workflow
      const result = await workflowEngine.startExecution(workflow, {
        tenantId,
        variables: variables || {},
        triggerData: triggerData || {},
      });

      res.json({
        success: true,
        data: {
          workflow,
          execution: {
            id: result.id,
            status: result.status,
            startedAt: result.startedAt,
            steps: result.steps,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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
  }
