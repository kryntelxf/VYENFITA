/**
 * VYENFITA Scheduler Service
 * 
 * Runs schedule triggers:
 * - Polls for due triggers every N seconds
 * - Fires them one by one
 * - Records metrics
 * - Handles errors gracefully
 * 
 * @version 1.0.0
 */

import { getTriggerService } from './trigger.service';
import { logger } from '../observability/logger';
import { getMetrics } from '../observability/metrics.service';

export interface SchedulerOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
}

export class SchedulerService {
  private intervalId?: NodeJS.Timeout;
  private pollIntervalMs: number;
  private running: boolean = false;
  private enabled: boolean;

  constructor(options: SchedulerOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 30000; // 30 seconds default
    this.enabled = options.enabled ?? true;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) {
      logger.warn('Scheduler already running');
      return;
    }

    if (!this.enabled) {
      logger.info('Scheduler disabled');
      return;
    }

    this.running = true;
    logger.info(`Scheduler started (poll interval: ${this.pollIntervalMs}ms)`);

    // Run immediately
    this.tick().catch((error) => {
      logger.error('Scheduler tick error', { error: error.message });
    });

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.tick().catch((error) => {
        logger.error('Scheduler tick error', { error: error.message });
      });
    }, this.pollIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.running = false;
    logger.info('Scheduler stopped');
  }

  /**
   * One tick — process all due triggers
   */
  private async tick(): Promise<void> {
    const metrics = getMetrics();
    const triggerService = getTriggerService();

    const startTime = Date.now();
    let dueTriggers: any[] = [];

    try {
      dueTriggers = await triggerService.getDueSchedules();
    } catch (error) {
      logger.error('Failed to fetch due triggers', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return;
    }

    if (dueTriggers.length === 0) {
      metrics.setGauge('vyenfita_scheduler_due_triggers', 0);
      return;
    }

    metrics.setGauge('vyenfita_scheduler_due_triggers', dueTriggers.length);
    logger.info(`Processing ${dueTriggers.length} due trigger(s)`);

    for (const trigger of dueTriggers) {
      try {
        const result = await triggerService.fire(trigger.id, {
          triggerType: 'schedule',
        });

        if (result.success) {
          metrics.incrementCounter('vyenfita_scheduler_executions_total', {
            trigger: trigger.id,
            status: 'success',
          });
          logger.info(`Trigger fired successfully`, {
            triggerId: trigger.id,
            executionId: result.executionId,
          });
        } else {
          metrics.incrementCounter('vyenfita_scheduler_executions_total', {
            trigger: trigger.id,
            status: 'failed',
          });
          logger.warn(`Trigger fired but execution failed`, {
            triggerId: trigger.id,
            error: result.error,
          });
        }
      } catch (error) {
        metrics.incrementCounter('vyenfita_scheduler_errors_total', {
          trigger: trigger.id,
        });
        logger.error(`Trigger fire failed`, {
          triggerId: trigger.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    const durationMs = Date.now() - startTime;
    metrics.observeHistogram('vyenfita_scheduler_tick_duration_ms', durationMs);
  }
}

let instance: SchedulerService | undefined;

export function getSchedulerService(): SchedulerService {
  if (!instance) {
    instance = new SchedulerService({
      pollIntervalMs: parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS || '30000', 10),
      enabled: process.env.SCHEDULER_ENABLED !== 'false',
    });
  }
  return instance;
                     }
