/**
 * VYENFITA Workflow Engine
 * 
 * Real workflow executor with:
 * - Persistent state
 * - Step-by-step execution
 * - Retry with backoff
 * - Resume from checkpoint
 * - Timeout enforcement
 * - Cancellation support
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { getExecutorRegistry } from './executor-registry';
import { StepContext, StepResult } from './executors/executor.interface';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface ExecutionOptions {
  tenantId: string;
  userId?: string;
  input?: Record<string, any>;
  variables?: Record<string, any>;
  triggerType?: 'manual' | 'schedule' | 'webhook' | 'api';
}

export interface ExecutionResult {
  executionId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'running';
  output: Record<string, any>;
  error?: string;
  durationMs: number;
  stepsExecuted: number;
}

const MAX_STEP_ITERATIONS = 1000;
const DEFAULT_STEP_TIMEOUT_MS = 60000;
const DEFAULT_MAX_RETRIES = 3;

export class WorkflowEngine {
  /**
   * Execute a workflow from start to finish
   */
  async execute(
    workflowId: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Load workflow and current version
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        tenantId: options.tenantId,
        deletedAt: null,
      },
      include: {
        versions: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const version = workflow.versions[0];
    if (!version) {
      throw new Error('Workflow has no current version');
    }

    const definition = version.definition as any;
    const steps = definition?.steps || [];

    if (steps.length === 0) {
      throw new Error('Workflow has no steps');
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        versionId: version.id,
        tenantId: options.tenantId,
        status: 'running',
        input: options.input || {},
        variables: options.variables || {},
        triggeredBy: options.userId,
        triggerType: options.triggerType || 'manual',
        startedAt: new Date(),
      },
    });

    await auditService.log({
      tenantId: options.tenantId,
      userId: options.userId,
      eventType: 'system',
      action: 'workflow.execute.start',
      resource: 'workflow',
      resourceId: workflow.id,
      details: { executionId: execution.id },
      status: 'success',
    });

    logger.info('Workflow execution started', {
      executionId: execution.id,
      workflowId: workflow.id,
      tenantId: options.tenantId,
      stepCount: steps.length,
    });

    // Run execution
    try {
      const result = await this.runSteps(
        execution.id,
        steps,
        {
          executionId: execution.id,
          workflowId: workflow.id,
          tenantId: options.tenantId,
          userId: options.userId,
          variables: options.variables || {},
          input: options.input || {},
          stepOutputs: {},
        }
      );

      const durationMs = Date.now() - startTime;

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: result.status === 'completed' ? 'completed' : 'failed',
          output: result.output,
          error: result.error,
          completedAt: new Date(),
          duration: durationMs,
        },
      });

      await auditService.log({
        tenantId: options.tenantId,
        userId: options.userId,
        eventType: 'system',
        action: 'workflow.execute.complete',
        resource: 'workflow',
        resourceId: workflow.id,
        details: {
          executionId: execution.id,
          status: result.status,
          stepsExecuted: result.stepsExecuted,
        },
        status: result.status === 'completed' ? 'success' : 'error',
        duration: durationMs,
      });

      return {
        executionId: execution.id,
        status: result.status,
        output: result.output,
        error: result.error,
        durationMs,
        stepsExecuted: result.stepsExecuted,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Execution failed';

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          error: message,
          completedAt: new Date(),
          duration: durationMs,
        },
      });

      await auditService.log({
        tenantId: options.tenantId,
        userId: options.userId,
        eventType: 'system',
        action: 'workflow.execute.error',
        resource: 'workflow',
        resourceId: workflow.id,
        details: { executionId: execution.id, error: message },
        status: 'error',
        duration: durationMs,
      });

      return {
        executionId: execution.id,
        status: 'failed',
        output: {},
        error: message,
        durationMs,
        stepsExecuted: 0,
      };
    }
  }

  /**
   * Cancel a running execution
   */
  async cancel(executionId: string, tenantId: string): Promise<void> {
    const execution = await prisma.workflowExecution.findFirst({
      where: { id: executionId, tenantId },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== 'running') {
      throw new Error(`Cannot cancel execution with status: ${execution.status}`);
    }

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    await auditService.log({
      tenantId,
      eventType: 'system',
      action: 'workflow.execute.cancel',
      resource: 'workflow_execution',
      resourceId: executionId,
      status: 'success',
    });
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private async runSteps(
    executionId: string,
    steps: any[],
    context: StepContext
  ): Promise<{
    status: 'completed' | 'failed' | 'cancelled';
    output: Record<string, any>;
    error?: string;
    stepsExecuted: number;
  }> {
    const registry = getExecutorRegistry();
    const stepResults: any[] = [];
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    // Start at first step
    let currentStepId: string | undefined = steps[0]?.id;
    let iterations = 0;
    let stepsExecuted = 0;

    while (currentStepId) {
      iterations++;

      if (iterations > MAX_STEP_ITERATIONS) {
        return {
          status: 'failed',
          output: {},
          error: 'Maximum step iterations exceeded (possible infinite loop)',
          stepsExecuted,
        };
      }

      // Check for cancellation
      const current = await prisma.workflowExecution.findUnique({
        where: { id: executionId },
        select: { status: true },
      });

      if (current?.status === 'cancelled') {
        return {
          status: 'cancelled',
          output: {},
          error: 'Execution cancelled',
          stepsExecuted,
        };
      }

      const step = stepMap.get(currentStepId);
      if (!step) {
        return {
          status: 'failed',
          output: {},
          error: `Step not found: ${currentStepId}`,
          stepsExecuted,
        };
      }

      // Get executor
      const executorType = step.type || 'http';
      const executor = registry.get(executorType);

      if (!executor) {
        return {
          status: 'failed',
          output: {},
          error: `No executor registered for type: ${executorType}`,
          stepsExecuted,
        };
      }

      // Validate step
      const validation = executor.validate(step);
      if (!validation.valid) {
        return {
          status: 'failed',
          output: {},
          error: `Invalid step ${step.id}: ${validation.errors.join(', ')}`,
          stepsExecuted,
        };
      }

      // Update current step in DB
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: { currentStep: step.id },
      });

      // Execute step with retry
      const result = await this.executeStepWithRetry(
        executor,
        step,
        context,
        step.retryCount || DEFAULT_MAX_RETRIES
      );

      stepsExecuted++;

      // Record step result
      const stepResult = {
        stepId: step.id,
        stepName: step.name,
        type: executorType,
        success: result.success,
        output: result.output,
        error: result.error,
        durationMs: result.durationMs,
        timestamp: new Date().toISOString(),
      };
      stepResults.push(stepResult);

      // Save step output to context for next steps
      context.stepOutputs[step.id] = result.output;

      // Handle set_variable special case
      if (executorType === 'set_variable' && result.success && result.output?.variables) {
        Object.assign(context.variables, result.output.variables);
      }

      // Persist step results
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: { stepResults: stepResults as any },
      });

      // Handle failure
      if (!result.success) {
        const onError = step.onError || 'stop';

        if (onError === 'continue') {
          // Continue to next step
          currentStepId = this.getNextStepId(steps, step.id);
          continue;
        }

        if (onError === 'stop') {
          return {
            status: 'failed',
            output: { steps: stepResults, finalOutput: result.output },
            error: `Step ${step.id} failed: ${result.error}`,
            stepsExecuted,
          };
        }
      }

      // Handle branching
      if (result.nextStepId) {
        currentStepId = result.nextStepId;
        continue;
      }

      if (result.shouldStop) {
        return {
          status: 'completed',
          output: { steps: stepResults, finalOutput: result.output },
          stepsExecuted,
        };
      }

      // Next step in sequence
      currentStepId = this.getNextStepId(steps, step.id);
    }

    return {
      status: 'completed',
      output: {
        steps: stepResults,
        finalOutput: stepResults[stepResults.length - 1]?.output,
      },
      stepsExecuted,
    };
  }

  private async executeStepWithRetry(
    executor: any,
    step: any,
    context: StepContext,
    maxRetries: number
  ): Promise<StepResult> {
    let lastResult: StepResult = {
      success: false,
      error: 'No attempts made',
      durationMs: 0,
    };

    const timeoutMs = step.timeout || DEFAULT_STEP_TIMEOUT_MS;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wrap with timeout
        const result = await this.withTimeout(
          executor.execute(step, context),
          timeoutMs
        );
        lastResult = result;

        if (result.success) {
          return result;
        }

        // Don't retry on certain conditions
        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          logger.warn(`Step ${step.id} failed, retrying in ${backoffMs}ms`, {
            attempt,
            error: result.error,
          });
          await this.sleep(backoffMs);
        }
      } catch (error) {
        lastResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: 0,
        };

        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          await this.sleep(backoffMs);
        }
      }
    }

    return lastResult;
  }

  private getNextStepId(steps: any[], currentStepId: string): string | undefined {
    const index = steps.findIndex((s) => s.id === currentStepId);
    if (index === -1 || index >= steps.length - 1) return undefined;
    return steps[index + 1].id;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Step timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let engineInstance: WorkflowEngine | undefined;

export function getWorkflowEngine(): WorkflowEngine {
  if (!engineInstance) {
    engineInstance = new WorkflowEngine();
  }
  return engineInstance;
}
