/**
 * VYENFITA Queue Service
 * 
 * Abstraction over BullMQ.
 * 
 * @version 1.0.0
 */

import { Queue, QueueOptions } from 'bullmq';
import IORedis, { Redis } from 'ioredis';
import { logger } from '../observability/logger';
import {
  QUEUE_NAMES,
  QueueName,
  DEFAULT_JOB_OPTIONS,
  REDIS_DEFAULT_URL,
} from './queue.constants';
import type {
  JobPayload,
  QueueStats,
  EnqueueOptions,
  WorkflowExecutePayload,
  AgentRunPayload,
  RetentionCleanupPayload,
  ReportGeneratePayload,
} from './queue.types';

export class QueueService {
  private connection: Redis;
  private queues: Map<QueueName, Queue> = new Map();
  private isShuttingDown = false;

  constructor(redisUrl: string = process.env.REDIS_URL || REDIS_DEFAULT_URL) {
    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    this.connection.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
    });

    this.connection.on('connect', () => {
      logger.info('Redis connected for BullMQ');
    });

    this.initializeQueues();
  }

  async enqueueWorkflowExecute(
    payload: WorkflowExecutePayload,
    options?: EnqueueOptions
  ): Promise<string | undefined> {
    return this.enqueue(QUEUE_NAMES.WORKFLOW_EXECUTE, payload, options);
  }

  async enqueueAgentRun(
    payload: AgentRunPayload,
    options?: EnqueueOptions
  ): Promise<string | undefined> {
    return this.enqueue(QUEUE_NAMES.AGENT_RUN, payload, options);
  }

  async enqueueRetentionCleanup(
    payload: RetentionCleanupPayload = {},
    options?: EnqueueOptions
  ): Promise<string | undefined> {
    return this.enqueue(QUEUE_NAMES.RETENTION_CLEANUP, payload, options);
  }

  async enqueueReportGenerate(
    payload: ReportGeneratePayload,
    options?: EnqueueOptions
  ): Promise<string | undefined> {
    return this.enqueue(QUEUE_NAMES.REPORT_GENERATE, payload, options);
  }

  async enqueue(
    queueName: QueueName,
    payload: JobPayload,
    options: EnqueueOptions = {}
  ): Promise<string | undefined> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Unknown queue: ${queueName}`);
    }

    try {
      const job = await queue.add(queueName, payload, {
        ...DEFAULT_JOB_OPTIONS,
        delay: options.delay,
        priority: options.priority,
        jobId: options.jobId,
        attempts: options.attempts,
        repeat: options.repeat,
      });

      logger.debug('Job enqueued', {
        queue: queueName,
        jobId: job.id,
        delay: options.delay,
        priority: options.priority,
      });

      return job.id;
    } catch (error) {
      logger.error('Failed to enqueue job', {
        queue: queueName,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  async getJobStatus(
    queueName: QueueName,
    jobId: string
  ): Promise<{
    id: string;
    state: string;
    progress: number | object;
    data: any;
    result?: any;
    failedReason?: string;
    attemptsMade: number;
  } | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const job = await queue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id!,
      state: await job.getState(),
      progress: job.progress || 0,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
    };
  }

  async getQueueStats(queueName: QueueName): Promise<QueueStats> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Unknown queue: ${queueName}`);
    }

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    };
  }

  async getAllStats(): Promise<QueueStats[]> {
    const stats = await Promise.all(
      Array.from(this.queues.keys()).map((name) => this.getQueueStats(name))
    );
    return stats;
  }

  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Unknown queue: ${queueName}`);
    await queue.pause();
    logger.info('Queue paused', { queue: queueName });
  }

  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Unknown queue: ${queueName}`);
    await queue.resume();
    logger.info('Queue resumed', { queue: queueName });
  }

  async cleanQueue(
    queueName: QueueName,
    grace: number = 24 * 3600 * 1000
  ): Promise<{ completed: number; failed: number }> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Unknown queue: ${queueName}`);

    const [completed, failed] = await Promise.all([
      queue.clean(grace, 1000, 'completed'),
      queue.clean(grace, 1000, 'failed'),
    ]);

    return {
      completed: completed.length,
      failed: failed.length,
    };
  }

  async drainQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Unknown queue: ${queueName}`);
    await queue.drain();
    logger.warn('Queue drained', { queue: queueName });
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Shutting down QueueService...');

    for (const [name, queue] of this.queues) {
      try {
        await queue.close();
        logger.debug('Queue closed', { queue: name });
      } catch (error) {
        logger.warn('Error closing queue', {
          queue: name,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    try {
      await this.connection.quit();
    } catch (error) {
      logger.warn('Error closing Redis connection', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    this.queues.clear();
    logger.info('QueueService shutdown complete');
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const pong = await this.connection.ping();
      return {
        healthy: pong === 'PONG',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown',
      };
    }
  }

  private initializeQueues(): void {
    const queueOptions: QueueOptions = {
      connection: this.connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    };

    for (const name of Object.values(QUEUE_NAMES)) {
      this.queues.set(name, new Queue(name, queueOptions));
    }

    logger.info('Queues initialized', {
      queues: Array.from(this.queues.keys()),
    });
  }
}

// ============================================================
// SINGLETON
// ============================================================

let instance: QueueService | undefined;

export function getQueueService(): QueueService {
  if (!instance) {
    instance = new QueueService();
  }
  return instance;
}

export function isQueueEnabled(): boolean {
  return process.env.USE_BULLMQ === 'true';
        }
