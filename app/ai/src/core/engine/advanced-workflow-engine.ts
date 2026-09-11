/**
 * VYENFITA Advanced Workflow Engine
 * 
 * Supports:
 * - Multi-step workflows with branching
 * - Parallel execution
 * - Human-in-the-loop (approval)
 * - Sub-workflows
 * - Workflow templates
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { StepExecutor, StepContext, StepResult } from './step-executor';

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  stepId: string;
  approvers: string[];
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  respondedAt?: Date;
  response?: string;
  config: Record<string, any>;
}

export interface AdvancedWorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval';
  startedAt: Date;
  completedAt?: Date;
  currentStepId?: string;
  variables: Record<string, any>;
  steps: AdvancedWorkflowStepResult[];
  approvals: ApprovalRequest[];
  subWorkflows: AdvancedWorkflowExecution[];
  error?: string;
}

export interface AdvancedWorkflowStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval';
  startedAt?: Date;
  completedAt?: Date;
  output?: any;
  error?: string;
  branches?: AdvancedWorkflowStepResult[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  steps: any[];
  triggers: any[];
  errorHandling: any;
  variables: Record<string, any>;
}

export class AdvancedWorkflowEngine {
  private stepExecutor: StepExecutor;
  private logger: Logger;
  private executions: Map<string, AdvancedWorkflowExecution>;
  private templates: Map<string, WorkflowTemplate>;
  private pendingApprovals: Map<string, ApprovalRequest>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.stepExecutor = new StepExecutor(logger);
    this.executions = new Map();
    this.templates = new Map();
    this.pendingApprovals = new Map();

    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.templates.set('email-approval', {
      id: 'email-approval',
      name: 'Email Approval',
      description: 'Send email and wait for approval',
      category: 'approval',
      icon: '📧',
      triggers: [{ id: 'trigger-1', type: 'manual', config: {} }],
      steps: [
        {
          id: 'step-1',
          name: 'Send Approval Email',
          type: 'notification',
          action: 'send_email',
          config: {
            subject: 'Approval Required',
            body: 'Please approve this request.',
          },
          onError: 'stop',
        },
        {
          id: 'step-2',
          name: 'Wait for Approval',
          type: 'notification',
          action: 'approval',
          config: {
            approvers: ['{{approver}}'],
            timeout: 86400000,
          },
          onError: 'stop',
        },
        {
          id: 'step-3',
          name: 'Process Approved',
          type: 'action',
          action: 'notify',
          config: {
            message: 'Request approved!',
            to: ['{{requester}}'],
          },
          onError: 'continue',
        },
      ],
      errorHandling: {
        retryCount: 0,
        retryDelay: 0,
        notifyOnError: true,
        notifyTo: ['admin@example.com'],
      },
      variables: {
        approver: 'approver@example.com',
        requester: 'requester@example.com',
      },
    });

    this.templates.set('data-processing', {
      id: 'data-processing',
      name: 'Data Processing Pipeline',
      description: 'Extract, transform, and load data',
      category: 'data',
      icon: '📊',
      triggers: [{ id: 'trigger-1', type: 'schedule', config: { schedule: '0 2 * * *' } }],
      steps: [
        {
          id: 'step-1',
          name: 'Extract Data',
          type: 'action',
          action: 'call_api',
          config: {
            url: '{{sourceUrl}}',
            method: 'GET',
          },
          onError: 'retry',
          retryConfig: { maxAttempts: 3, delayMs: 5000 },
        },
        {
          id: 'step-2',
          name: 'Transform Data',
          type: 'action',
          action: 'transform',
          config: {
            data: '{{step1.output}}',
            transformation: {
              id: 'id',
              name: 'name',
              value: 'value',
            },
          },
          onError: 'stop',
        },
        {
          id: 'step-3',
          name: 'Load Data',
          type: 'action',
          action: 'update_database',
          config: {
            collection: 'processed_data',
            data: '{{step2.output}}',
          },
          onError: 'stop',
        },
      ],
      errorHandling: {
        retryCount: 2,
        retryDelay: 10000,
        notifyOnError: true,
        notifyTo: ['admin@example.com'],
      },
      variables: {
        sourceUrl: 'https://api.example.com/data',
      },
    });

    this.templates.set('scheduled-report', {
      id: 'scheduled-report',
      name: 'Scheduled Report',
      description: 'Generate and send reports on schedule',
      category: 'reporting',
      icon: '📈',
      triggers: [{ id: 'trigger-1', type: 'schedule', config: { schedule: '0 9 * * 1' } }],
      steps: [
        {
          id: 'step-1',
          name: 'Fetch Data',
          type: 'action',
          action: 'call_api',
          config: {
            url: '{{apiUrl}}',
            method: 'GET',
          },
          onError: 'retry',
          retryConfig: { maxAttempts: 3, delayMs: 5000 },
        },
        {
          id: 'step-2',
          name: 'Generate Report',
          type: 'action',
          action: 'transform',
          config: {
            data: '{{step1.output}}',
            format: 'html',
          },
          onError: 'stop',
        },
        {
          id: 'step-3',
          name: 'Send Report',
          type: 'action',
          action: 'send_email',
          config: {
            to: ['{{recipients}}'],
            subject: 'Weekly Report {{date}}',
            body: 'Please find the report attached.',
          },
          onError: 'continue',
        },
      ],
      errorHandling: {
        retryCount: 1,
        retryDelay: 5000,
        notifyOnError: true,
        notifyTo: ['admin@example.com'],
      },
      variables: {
        apiUrl: 'https://api.example.com/reports',
        recipients: 'team@example.com',
      },
    });
  }

  getTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  createFromTemplate(templateId: string, variables: Record<string, any>): any {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const workflow = {
      id: `wf-${uuidv4()}`,
      name: template.name,
      description: template.description,
      triggers: this.interpolateVariables(template.triggers, variables),
      steps: this.interpolateVariables(template.steps, variables),
      errorHandling: template.errorHandling,
    };

    return workflow;
  }

  async startExecution(
    workflow: any,
    options: {
      tenantId: string;
      variables?: Record<string, any>;
      triggerData?: any;
    }
  ): Promise<AdvancedWorkflowExecution> {
    const executionId = uuidv4();
    this.logger.info(`Starting advanced workflow execution: ${executionId}`, {
      workflowId: workflow.id,
      tenantId: options.tenantId,
    });

    const execution: AdvancedWorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'pending',
      startedAt: new Date(),
      variables: {
        ...(options.variables || {}),
        triggerData: options.triggerData || {},
        workflowId: workflow.id,
        executionId: executionId,
      },
      steps: [],
      approvals: [],
      subWorkflows: [],
    };

    this.executions.set(executionId, execution);

    try {
      await this.executeAdvancedWorkflow(workflow, execution);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Workflow execution failed: ${executionId}`, {
        workflowId: workflow.id,
        error: execution.error,
      });
    }

    execution.completedAt = new Date();
    this.executions.set(executionId, execution);

    return execution;
  }

  private async executeAdvancedWorkflow(
    workflow: any,
    execution: AdvancedWorkflowExecution
  ): Promise<void> {
    const steps = workflow.steps || [];
    let currentStepIndex = 0;

    execution.status = 'running';

    while (currentStepIndex < steps.length) {
      const step = steps[currentStepIndex];
      execution.currentStepId = step.id;

      this.logger.debug(`Executing step ${currentStepIndex + 1}/${steps.length}`, {
        workflowId: workflow.id,
        stepId: step.id,
      });

      if (step.action === 'approval') {
        const approvalResult = await this.handleApproval(step, execution);
        if (approvalResult.status === 'pending') {
          execution.status = 'waiting_approval';
          return;
        }
        if (approvalResult.status === 'rejected') {
          execution.status = 'failed';
          execution.error = 'Approval rejected';
          return;
        }
        currentStepIndex++;
        continue;
      }

      if (step.type === 'parallel') {
        await this.executeParallel(step, execution);
        currentStepIndex++;
        continue;
      }

      if (step.type === 'subflow') {
        await this.executeSubWorkflow(step, execution);
        currentStepIndex++;
        continue;
      }

      const stepResult = await this.executeStep(step, execution);

      const result: AdvancedWorkflowStepResult = {
        stepId: step.id,
        status: stepResult.success ? 'completed' : 'failed',
        startedAt: new Date(),
        completedAt: new Date(),
        output: stepResult.output,
        error: stepResult.error,
      };
      execution.steps.push(result);

      if (!stepResult.success) {
        const onError = step.onError || 'stop';
        if (onError === 'stop') {
          execution.status = 'failed';
          execution.error = stepResult.error || 'Step execution failed';
          return;
        } else if (onError === 'continue') {
          currentStepIndex++;
          continue;
        } else if (onError === 'retry') {
          const retryResult = await this.retryStep(step, execution);
          if (!retryResult.success) {
            execution.status = 'failed';
            execution.error = retryResult.error || 'Step retry failed';
            return;
          }
          const lastResult = execution.steps[execution.steps.length - 1];
          lastResult.status = 'completed';
          lastResult.output = retryResult.output;
          lastResult.error = undefined;
          currentStepIndex++;
          continue;
        }
      }

      if (stepResult.nextStepId) {
        const nextIndex = steps.findIndex((s: any) => s.id === stepResult.nextStepId);
        if (nextIndex !== -1) {
          currentStepIndex = nextIndex;
          continue;
        }
      }

      currentStepIndex++;
    }

    execution.status = 'completed';
    this.logger.info(`Workflow execution completed: ${execution.id}`, {
      workflowId: workflow.id,
      stepCount: execution.steps.length,
    });
  }

  private async handleApproval(
    step: any,
    execution: AdvancedWorkflowExecution
  ): Promise<{ status: 'approved' | 'rejected' | 'pending'; response?: string }> {
    const config = this.interpolateVariables(step.config, execution.variables);
    const approvers = config.approvers || ['approver@example.com'];

    const approval: ApprovalRequest = {
      id: uuidv4(),
      workflowId: execution.workflowId,
      stepId: step.id,
      approvers,
      status: 'pending',
      requestedAt: new Date(),
      config,
    };

    this.pendingApprovals.set(approval.id, approval);
    execution.approvals.push(approval);

    this.logger.info(`Approval requested: ${approval.id}`, {
      workflowId: execution.workflowId,
      approvers,
    });

    return { status: 'pending' };
  }

  private async executeParallel(
    step: any,
    execution: AdvancedWorkflowExecution
  ): Promise<void> {
    const branches = step.config.branches || [];
    const results = await Promise.all(
      branches.map(async (branch: any) => {
        // Execute each branch's steps in parallel
        const stepResults: AdvancedWorkflowStepResult[] = [];
        for (const branchStep of branch.steps || []) {
          const result = await this.executeStep(branchStep, execution);
          stepResults.push({
            stepId: branchStep.id,
            status: result.success ? 'completed' : 'failed',
            startedAt: new Date(),
            completedAt: new Date(),
            output: result.output,
            error: result.error,
          });
        }
        return {
          branchId: branch.id,
          steps: stepResults,
        };
      })
    );

    execution.steps.push({
      stepId: step.id,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      output: { branches: results },
    });
  }

  private async executeSubWorkflow(
    step: any,
    execution: AdvancedWorkflowExecution
  ): Promise<void> {
    const subWorkflow = step.config.workflow;
    if (!subWorkflow) {
      throw new Error('Sub-workflow not configured');
    }

    const subExecution = await this.startExecution(subWorkflow, {
      tenantId: execution.variables.tenantId || 'default',
      variables: {
        ...execution.variables,
        parentExecutionId: execution.id,
      },
    });

    execution.subWorkflows.push(subExecution);

    execution.steps.push({
      stepId: step.id,
      status: subExecution.status as any,
      startedAt: subExecution.startedAt,
      completedAt: subExecution.completedAt,
      output: { subExecutionId: subExecution.id, status: subExecution.status },
      error: subExecution.error,
    });
  }

  private async executeStep(
    step: any,
    execution: AdvancedWorkflowExecution
  ): Promise<StepResult> {
    const context: StepContext = {
      variables: execution.variables,
      stepId: step.id,
      workflowId: execution.workflowId,
      executionId: execution.id,
      tenantId: execution.variables.tenantId || 'default',
    };

    try {
      return await this.stepExecutor.execute(step, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async retryStep(
    step: any,
    execution: AdvancedWorkflowExecution
  ): Promise<StepResult> {
    const maxAttempts = step.retryConfig?.maxAttempts || 3;
    const delayMs = step.retryConfig?.delayMs || 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.debug(`Retry attempt ${attempt}/${maxAttempts} for step ${step.id}`);

      await this.sleep(delayMs);

      const result = await this.executeStep(step, execution);
      if (result.success) {
        return result;
      }
    }

    return {
      success: false,
      error: `Failed after ${maxAttempts} retry attempts`,
    };
  }

  getExecution(executionId: string): AdvancedWorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  getExecutions(workflowId: string): AdvancedWorkflowExecution[] {
    const results: AdvancedWorkflowExecution[] = [];
    for (const execution of this.executions.values()) {
      if (execution.workflowId === workflowId) {
        results.push(execution);
      }
    }
    return results;
  }

  approveApproval(approvalId: string, response?: string): boolean {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval) return false;

    approval.status = 'approved';
    approval.respondedAt = new Date();
    approval.response = response;

    this.pendingApprovals.delete(approvalId);

    for (const execution of this.executions.values()) {
      const approvalIndex = execution.approvals.findIndex((a) => a.id === approvalId);
      if (approvalIndex !== -1) {
        execution.approvals[approvalIndex] = approval;
        this.resumeExecution(execution);
        return true;
      }
    }

    return false;
  }

  rejectApproval(approvalId: string, response?: string): boolean {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval) return false;

    approval.status = 'rejected';
    approval.respondedAt = new Date();
    approval.response = response;

    this.pendingApprovals.delete(approvalId);

    for (const execution of this.executions.values()) {
      const approvalIndex = execution.approvals.findIndex((a) => a.id === approvalId);
      if (approvalIndex !== -1) {
        execution.approvals[approvalIndex] = approval;
        execution.status = 'failed';
        execution.error = 'Approval rejected';
        return true;
      }
    }

    return false;
  }

  private resumeExecution(execution: AdvancedWorkflowExecution): void {
    this.logger.info(`Resuming workflow execution: ${execution.id}`);
    execution.status = 'running';
  }

  private interpolateVariables(config: any, variables: Record<string, any>): any {
    if (typeof config === 'string') {
      return config.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        return this.getNestedValue(variables, trimmedKey) ?? match;
      });
    }
    if (Array.isArray(config)) {
      return config.map((item) => this.interpolateVariables(item, variables));
    }
    if (typeof config === 'object' && config !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(config)) {
        result[key] = this.interpolateVariables(value, variables);
      }
      return result;
    }
    return config;
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
