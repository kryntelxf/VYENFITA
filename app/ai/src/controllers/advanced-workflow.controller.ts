/**
 * VYENFITA Advanced Workflow Controller
 * 
 * Handles advanced workflow operations including:
 * - Templates
 * - Approvals
 * - Parallel execution
 * - Sub-workflows
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { Logger } from 'winston';
import { AdvancedWorkflowEngine } from '../core/engine/advanced-workflow-engine';
import { AIService } from '../core/services/ai.service';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

const workflowEngine = new AdvancedWorkflowEngine(logger);

export class AdvancedWorkflowController {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Get all workflow templates
   * GET /api/v1/workflow/templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = workflowEngine.getTemplates();
      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a specific template
   * GET /api/v1/workflow/templates/:templateId
   */
  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const template = workflowEngine.getTemplate(templateId);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create workflow from template
   * POST /api/v1/workflow/create-from-template
   */
  async createFromTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId, variables } = req.body;

      if (!templateId) {
        res.status(400).json({
          success: false,
          error: 'templateId is required',
        });
        return;
      }

      const workflow = workflowEngine.createFromTemplate(templateId, variables || {});

      res.json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute advanced workflow
   * POST /api/v1/workflow/execute-advanced
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
          approvals: result.approvals,
          subWorkflows: result.subWorkflows,
          isWaitingApproval: result.status === 'waiting_approval',
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
   * Approve a pending approval
   * POST /api/v1/workflow/approve/:approvalId
   */
  async approve(req: Request, res: Response): Promise<void> {
    try {
      const { approvalId } = req.params;
      const { response } = req.body;

      const success = workflowEngine.approveApproval(approvalId, response);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Approval not found or already processed',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Approval approved',
        approvalId,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Reject a pending approval
   * POST /api/v1/workflow/reject/:approvalId
   */
  async reject(req: Request, res: Response): Promise<void> {
    try {
      const { approvalId } = req.params;
      const { response } = req.body;

      const success = workflowEngine.rejectApproval(approvalId, response);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Approval not found or already processed',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Approval rejected',
        approvalId,
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
   * GET /api/v1/workflow/executions/:executionId
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
   * GET /api/v1/workflow/executions/workflow/:workflowId
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
  }
