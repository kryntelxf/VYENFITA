/**
 * VYENFITA Retention Scheduler
 * 
 * Runs retention cleanup daily at 03:00 UTC.
 * 
 * @version 1.0.0
 */

import { RetentionService } from './retention.service';
import { logger } from '../observability/logger';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_DELAY_MS = 60 * 1000; // 1 minute after startup

export class RetentionScheduler {
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private isRunning = false;

  /**
   * Start the scheduler.
   */
  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.timer) {
      logger.warn('Retention scheduler already running');
      return;
    }

    if (process.env.RETENTION_ENABLED === 'false') {
      logger.info('Retention scheduler disabled by env var');
      return;
    }

    logger.info('Retention scheduler starting', {
      intervalMs,
      startupDelayMs: STARTUP_DELAY_MS,
    });

    this.startupTimer = setTimeout(() => {
      this.runOnce().catch((error) => {
        logger.error('Initial retention run failed', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      });
    }, STARTUP_DELAY_MS);

    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        logger.error('Scheduled retention run failed', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      });
    }, intervalMs);
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = undefined;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      logger.info('Retention scheduler stopped');
    }
  }

  /**
   * Run a single cleanup cycle (idempotent, prevents concurrent runs).
   */
  async runOnce(options: { dryRun?: boolean } = {}): Promise<void> {
    if (this.isRunning) {
      logger.warn('Retention cleanup already in progress, skipping');
      return;
    }

    this.isRunning = true;
    try {
      const report = await RetentionService.runCleanup(options);

      logger.info('Retention report', {
        dryRun: report.dryRun,
        totalDeleted: report.totalDeleted,
        durationMs: report.durationMs,
        results: report.results.map((r) => ({
          entity: r.entity,
          deleted: r.deleted,
        })),
      });

      if (report.errors.length > 0) {
        logger.warn('Retention cleanup had errors', {
          errors: report.errors,
        });
      }
    } finally {
      this.isRunning = false;
    }
  }

  isActive(): boolean {
    return !!this.timer;
  }
}

let instance: RetentionScheduler | undefined;

export function getRetentionScheduler(): RetentionScheduler {
  if (!instance) {
    instance = new RetentionScheduler();
  }
  return instance;
}
