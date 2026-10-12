/**
 * VYENFITA Agent Run Handler
 * 
 * @version 1.0.0
 */

import { Job } from 'bullmq';
import { logger } from '../../observability/logger';
import { AgentService } from '../../agents/agent.service';
import type { AgentRunPayload, JobResult } from '../queue.types';

export async function handleAgentRun(
  payload: AgentRunPayload,
  job: Job
): Promise<JobResult> {
  const start = Date.now();

  logger.info('Agent run job started', {
    jobId: job.id,
    agentId: payload.agentId,
    runId: payload.runId,
    tenantId: payload.tenantId,
  });

  await job.updateProgress(5);

  try {
    const run = await AgentService.run(payload.agentId, payload.tenantId, {
      objective: payload.objective,
      context: payload.context,
    });

    await job.updateProgress(100);

    return {
      success: run.status === 'completed',
      data: {
        runId: run.id,
        status: run.status,
      },
      durationMs: Date.now() - start,
    };
  } catch (error) {
    logger.error('Agent run failed', {
      jobId: job.id,
      agentId: payload.agentId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}
