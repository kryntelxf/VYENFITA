/**
 * VYENFITA Workflow Execute Handler
 * 
 * @version 1.0.0
 */

import { Job } from 'bullmq';
import { logger } from '../../observability/logger';
import { getWorkflowEngine } from '../../workflow/workflow-engine';
import type { WorkflowExecutePayload, JobResult } from '../queue.types';

export async function handleWorkflowExecute(
  payload: WorkflowExecutePayload,
  job: Job
): Promise<JobResult> {
  const start = Date.now();

  logger.info('Workflow execute job started', {
    jobId: job.id,
    workflowId: payload.workflowId,
    executionId: payload.executionId,
    tenantId: payload.tenantId,
  });

  await job.updateProgress(10);

  try {
    const engine = getWorkflowEngine();
    const result = await engine.execute(payload.workflowId, {
      tenantId: payload.tenantId,
      userId: payload.userId,
      input: payload.input || {},
      triggerType: payload.triggerType,
    });

    await job.updateProgress(100);

    return {
      success: result.status === 'completed',
      data: {
        executionId: result.executionId,
        status: result.status,
        stepsExecuted: result.stepsExecuted,
        durationMs: result.durationMs,
      },
      durationMs: Date.now() - start,
    };
  } catch (error) {
    logger.error('Workflow execute failed', {
      jobId: job.id,
      workflowId: payload.workflowId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}
