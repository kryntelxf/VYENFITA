/**
 * VYENFITA Workflow Engine
 * Executes workflows with triggers, steps, and error handling
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { StepExecutor, StepContext, StepResult } from './step-executor';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval';
  startedAt: Date;
  completedAt?: Date;
  currentStepId?: string;
  variables: Record<string, any>;
  steps: WorkflowStepResult[];
  error?: string;
}

export interface WorkflowStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  output?: any;
  error?: string;
}

export interface WorkflowExecutionOptions {
  tenantId: string;
  variables?: Record<string, any>;
  triggerData?: any;
}

export class WorkflowEngine {
  private stepExecutor: StepExecutor;
  private logger: Logger;
  private executions: Map<string, WorkflowExecution>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.stepExecutor = new StepExecutor(logger);
    this.executions = new Map();
  }

  /**
   * Start a workflow execution
   */
  async startExecution(
    workflow: any,
    options: WorkflowExecutionOptions
  ): Promise<WorkflowExecution> {
    const executionId = uuidv4();
    this.logger.info(`Starting workflow execution: ${executionId}`, {
      workflowId: workflow.id,
      tenantId: options.tenantId,
    });

    const execution: WorkflowExecution = {
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
    };

    this.executions.set(executionId, execution);

    try {
      await this.executeWorkflow(workflow, execution);
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

  /**
   * Get execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions for a workflow
   */
  getExecutions(workflowId: string): WorkflowExecution[] {
    const results: WorkflowExecution[] = [];
    for (const execution of this.executions.values()) {
      if (execution.workflowId === workflowId) {
        results.push(execution);
      }
    }
    return results;
  }

  /**
   * Execute a workflow
   */
  private async executeWorkflow(workflow: any, execution: WorkflowExecution): Promise<void> {
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

      const stepResult = await this.executeStep(step, execution);

      // Update step result
      const result: WorkflowStepResult = {
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
          // Simple retry logic (one retry for now)
          this.logger.debug(`Retrying step: ${step.id}`);
          const retryResult = await this.executeStep(step, execution);
          if (!retryResult.success) {
            execution.status = 'failed';
            execution.error = retryResult.error || 'Step retry failed';
            return;
          }
          // Update the step result with retry success
          const lastResult = execution.steps[execution.steps.length - 1];
          lastResult.status = 'completed';
          lastResult.output = retryResult.output;
          lastResult.error = undefined;
          currentStepIndex++;
          continue;
        } else if (onError === 'notify') {
          // Log notification and continue
          this.logger.warn(`Step failed, notifying and continuing: ${step.id}`, {
            error: stepResult.error,
          });
          currentStepIndex++;
          continue;
        }
      }

      // Check for conditional branching
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

  /**
   * Execute a single step
   */
  private async executeStep(step: any, execution: WorkflowExecution): Promise<StepResult> {
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

  /**
   * Check if a trigger should start a workflow
   */
  shouldTrigger(workflow: any, trigger: any, eventData: any): boolean {
    switch (trigger.type) {
      case 'webhook':
        // Check if webhook path matches
        return trigger.config.webhook === eventData.path;
      case 'event':
        // Check if event type matches
        return trigger.config.event === eventData.type;
      case 'schedule':
        // Schedule check is handled separately
        return true;
      case 'manual':
        return true;
      default:
        return false;
    }
  }

  /**
   * Clean up old executions
   */
  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    let count = 0;
    for (const [id, execution] of this.executions) {
      if (now - execution.startedAt.getTime() > maxAgeMs) {
        this.executions.delete(id);
        count++;
      }
    }
    this.logger.info(`Cleaned up ${count} old executions`);
  }
  }
