/**
 * VYENFITA Retention Cleanup Handler
 * 
 * @version 1.0.0
 */

import { Job } from 'bullmq';
import { logger } from '../../observability/logger';
import { RetentionService } from '../../retention/retention.service';
import type { RetentionCleanupPayload, JobResult } from '../queue.types';

export async function handleRetentionCleanup(
  payload: RetentionCleanupPayload,
  job: Job
): Promise<JobResult> {
  const start = Date.now();
  const dryRun = payload.dryRun ?? false;

  logger.info('Retention cleanup job started', {
    jobId: job.id,
    dryRun,
  });

  await job.updateProgress(10);

  const report = await RetentionService.runCleanup({ dryRun });

  await job.updateProgress(100);

  return {
    success: report.errors.length === 0,
    data: {
      dryRun: report.dryRun,
      totalDeleted: report.totalDeleted,
      results: report.results.map((r) => ({
        entity: r.entity,
        deleted: r.deleted,
      })),
      errors: report.errors,
    },
    durationMs: Date.now() - start,
  };
}
