/**
 * VYENFITA Worker Service
 * 
 * Processes jobs from all queues.
 * 
 * @version 1.0.0
 */

import { Worker, Job } from 'bullmq';
import IORedis, { Redis } from 'ioredis';
import { logger } from '../observability/logger';
import { getMetrics } from '../observability/metrics.service';
import {
  QUEUE_NAMES,
  QueueName,
  REDIS_DEFAULT_URL,
} from './queue.constants';
import type {
  JobResult,
  WorkflowExecutePayload,
  AgentRunPayload,
  RetentionCleanupPayload,
  ReportGeneratePayload,
} from './queue.types';
import { handleWorkflowExecute } from './handlers/workflow-execute.handler';
import { handleAgentRun } from './handlers/agent-run.handler';
import { handleRetentionCleanup } from './handlers/retention-cleanup.handler';
import { handleReportGenerate } from './handlers/report-generate.handler';

type JobHandler<T = any> = (payload: T, job: Job) => Promise<JobResult>;

export class WorkerService {
  private connection: Redis;
  private workers: Map<QueueName, Worker> = new Map();
  private isShuttingDown = false;

  constructor(redisUrl: string = process.env.REDIS_URL || REDIS_DEFAULT_URL) {
    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }

  start(concurrency: number = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10)): void {
    if (this.workers.size > 0) {
      logger.warn('Workers already running');
      return;
    }

    logger.info('Starting workers', { concurrency });

    this.createWorker(
      QUEUE_NAMES.WORKFLOW_EXECUTE,
      (payload: WorkflowExecutePayload, job) =>
        this.wrapHandler('workflow-execute', payload, job, handleWorkflowExecute),
      concurrency
    );

    this.createWorker(
      QUEUE_NAMES.AGENT_RUN,
      (payload: AgentRunPayload, job) =>
        this.wrapHandler('agent-run', payload, job, handleAgentRun),
      Math.min(concurrency, 3)
    );

    this.createWorker(
      QUEUE_NAMES.RETENTION_CLEANUP,
      (payload: RetentionCleanupPayload, job) =>
        this.wrapHandler('retention-cleanup', payload, job, handleRetentionCleanup),
      1
    );

    this.createWorker(
      QUEUE_NAMES.REPORT_GENERATE,
      (payload: ReportGeneratePayload, job) =>
        this.wrapHandler('report-generate', payload, job, handleReportGenerate),
      concurrency
    );

    logger.info('All workers started', {
      queues: Array.from(this.workers.keys()),
    });
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Stopping workers...');

    await Promise.all(
      Array.from(this.workers.values()).map(async (worker) => {
        try {
          await worker.close();
        } catch (error) {
          logger.warn('Error closing worker', {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      })
    );

    this.workers.clear();

    try {
      await this.connection.quit();
    } catch {
      // ignore
    }

    logger.info('Workers stopped');
  }

  isActive(): boolean {
    return this.workers.size > 0;
  }

  private createWorker<T>(
    queueName: QueueName,
    handler: JobHandler<T>,
    concurrency: number
  ): void {
    const worker = new Worker(
      queueName,
      async (job) => handler(job.data as T, job),
      {
        connection: this.connection,
        concurrency,
      }
    );

    worker.on('completed', (job) => {
      logger.debug('Job completed', {
        queue: queueName,
        jobId: job.id,
        durationMs:
          job.finishedOn && job.processedOn
            ? job.finishedOn - job.processedOn
            : undefined,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Job failed', {
        queue: queueName,
        jobId: job?.id,
        error: error.message,
        attemptsMade: job?.attemptsMade,
      });
    });

    worker.on('error', (error) => {
      logger.error('Worker error', {
        queue: queueName,
        error: error.message,
      });
    });

    this.workers.set(queueName, worker);
  }

  private async wrapHandler<T>(
    jobName: string,
    payload: T,
    job: Job,
    handler: JobHandler<T>
  ): Promise<JobResult> {
    const start = Date.now();
    const metrics = getMetrics();

    try {
      const result = await handler(payload, job);

      metrics.incrementCounter('vyenfita_queue_jobs_total', {
        queue: jobName,
        status: result.success ? 'success' : 'failure',
      });

      metrics.observeHistogram(
        'vyenfita_queue_job_duration_ms',
        Date.now() - start,
        { queue: jobName }
      );

      return result;
    } catch (error) {
      metrics.incrementCounter('vyenfita_queue_jobs_total', {
        queue: jobName,
        status: 'error',
      });

      metrics.observeHistogram(
        'vyenfita_queue_job_duration_ms',
        Date.now() - start,
        { queue: jobName }
      );

      throw error;
    }
  }
}

// ============================================================
// SINGLETON
// ============================================================

let instance: WorkerService | undefined;

export function getWorkerService(): WorkerService {
  if (!instance) {
    instance = new WorkerService();
  }
  return instance;
      }
