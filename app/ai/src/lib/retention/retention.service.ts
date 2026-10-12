/**
 * VYENFITA Retention Service
 * 
 * Automated cleanup of aged data.
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { logger } from '../observability/logger';
import { getMetrics } from '../observability/metrics.service';
import { DataDeletionService } from '../gdpr/data-deletion.service';
import {
  RetentionResult,
  RetentionReport,
  RetentionConfig,
  RetentionEntity,
} from './retention.types';

const DEFAULT_CONFIG: RetentionConfig = {
  auditEvents: 90,
  workflowExecutions: 30,
  agentSteps: 90,
  sessionsGraceDays: 30,
  oauthStatesGraceMinutes: 60,
  deletedUsersGraceDays: 30,
};

export class RetentionService {
  private static config: RetentionConfig = DEFAULT_CONFIG;

  /**
   * Override config (for tests or runtime tuning).
   */
  static setConfig(config: Partial<RetentionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config.
   */
  static getConfig(): RetentionConfig {
    return { ...this.config };
  }

  /**
   * Run full retention cleanup.
   */
  static async runCleanup(options: { dryRun?: boolean } = {}): Promise<RetentionReport> {
    const dryRun = options.dryRun ?? false;
    const startTime = Date.now();

    logger.info('Retention cleanup started', { dryRun });

    const results: RetentionResult[] = [];
    const errors: string[] = [];

    const tasks: Array<() => Promise<RetentionResult>> = [
      () => this.cleanupAuditEvents(dryRun),
      () => this.cleanupWorkflowExecutions(dryRun),
      () => this.cleanupAgentSteps(dryRun),
      () => this.cleanupSessions(dryRun),
      () => this.cleanupOAuthStates(dryRun),
      () => this.cleanupDeletedUsers(dryRun),
    ];

    for (const task of tasks) {
      try {
        const result = await task();
        results.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(message);
        logger.error('Retention task failed', { error: message });
      }
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const completedAt = new Date();

    const report: RetentionReport = {
      startedAt: new Date(startTime).toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Date.now() - startTime,
      dryRun,
      results,
      totalDeleted,
      errors,
    };

    logger.info('Retention cleanup completed', {
      dryRun,
      totalDeleted,
      durationMs: report.durationMs,
      errors: errors.length,
    });

    return report;
  }

  // ============================================================
  // INDIVIDUAL CLEANUP TASKS
  // ============================================================

  static async cleanupAuditEvents(dryRun: boolean): Promise<RetentionResult> {
    const start = Date.now();
    const cutoff = new Date(Date.now() - this.config.auditEvents * 24 * 60 * 60 * 1000);

    let deleted = 0;
    try {
      if (dryRun) {
        deleted = await prisma.auditEvent.count({
          where: { timestamp: { lt: cutoff } },
        });
      } else {
        const result = await prisma.auditEvent.deleteMany({
          where: { timestamp: { lt: cutoff } },
        });
        deleted = result.count;
      }
      this.recordMetric('audit_events', deleted);
    } catch (error) {
      return {
        entity: 'audit_events',
        retentionDays: this.config.auditEvents,
        deleted: 0,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return {
      entity: 'audit_events',
      retentionDays: this.config.auditEvents,
      deleted,
      durationMs: Date.now() - start,
    };
  }

  static async cleanupWorkflowExecutions(dryRun: boolean): Promise<RetentionResult> {
    const start = Date.now();
    const cutoff = new Date(
      Date.now() - this.config.workflowExecutions * 24 * 60 * 60 * 1000
    );

    let deleted = 0;
    try {
      if (dryRun) {
        deleted = await prisma.workflowExecution.count({
          where: { createdAt: { lt: cutoff } },
        });
      } else {
        const result = await prisma.workflowExecution.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        deleted = result.count;
      }
      this.recordMetric('workflow_executions', deleted);
    } catch (error) {
      return {
        entity: 'workflow_executions',
        retentionDays: this.config.workflowExecutions,
        deleted: 0,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return {
      entity: 'workflow_executions',
      retentionDays: this.config.workflowExecutions,
      deleted,
      durationMs: Date.now() - start,
    };
  }

  static async cleanupAgentSteps(dryRun: boolean): Promise<RetentionResult> {
    const start = Date.now();
    const cutoff = new Date(Date.now() - this.config.agentSteps * 24 * 60 * 60 * 1000);

    let deleted = 0;
    try {
      const oldRuns = await prisma.agentRun.findMany({
        where: { startedAt: { lt: cutoff } },
        select: { id: true },
      });

      const oldRunIds = oldRuns.map((r) => r.id);

      if (oldRunIds.length === 0) {
        return {
          entity: 'agent_steps',
          retentionDays: this.config.agentSteps,
          deleted: 0,
          durationMs: Date.now() - start,
        };
      }

      if (dryRun) {
        deleted = await prisma.agentStep.count({
          where: { runId: { in: oldRunIds } },
        });
      } else {
        const result = await prisma.agentStep.deleteMany({
          where: { runId: { in: oldRunIds } },
        });
        deleted = result.count;
      }
      this.recordMetric('agent_steps', deleted);
    } catch (error) {
      return {
        entity: 'agent_steps',
        retentionDays: this.config.agentSteps,
        deleted: 0,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return {
      entity: 'agent_steps',
      retentionDays: this.config.agentSteps,
      deleted,
      durationMs: Date.now() - start,
    };
  }

  static async cleanupSessions(dryRun: boolean): Promise<RetentionResult> {
    const start = Date.now();
    const cutoff = new Date(
      Date.now() - this.config.sessionsGraceDays * 24 * 60 * 60 * 1000
    );

    let deleted = 0;
    try {
      if (dryRun) {
        deleted = await prisma.session.count({
          where: { expiresAt: { lt: cutoff } },
        });
      } else {
        const result = await prisma.session.deleteMany({
          where: { expiresAt: { lt: cutoff } },
        });
        deleted = result.count;
      }
      this.recordMetric('sessions', deleted);
    } catch (error) {
      return {
        entity: 'sessions',
        retentionDays: this.config.sessionsGraceDays,
        deleted: 0,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return {
      entity: 'sessions',
      retentionDays: this.config.sessionsGraceDays,
      deleted,
      durationMs: Date.now() - start,
    };
  }

  static async cleanupOAuthStates(dryRun: boolean): Promise<RetentionResult> {
    const start = Date.now();
    const cutoff = new Date(
      Date.now() - this.config.oauthStatesGraceMinutes * 60 * 1000
    );

    let deleted = 0;
    try {
      if (dryRun) {
        deleted = await prisma.oAuthState.count({
          where: { expiresAt: { lt: cutoff } },
        });
      } else {
        const result = await prisma.oAuthState.deleteMany({
          where: { expiresAt: { lt: cutoff } },
        });
        deleted = result.count;
      }
      this.recordMetric('oauth_states', deleted);
    } catch (error) {
      return {
        entity: 'oauth_states',
        retentionDays: 0,
        deleted: 0,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return {
      entity: 'oauth_states',
      retentionDays: 0,
      deleted,
      durationMs: Date.now() - start,
    };
  }

  static async cleanupDeletedUsers(dryRun: boolean): Promise<RetentionResult> {
    const start = Date.now();

    if (dryRun) {
      const cutoff = new Date(
        Date.now() - this.config.deletedUsersGraceDays * 24 * 60 * 60 * 1000
      );
      const count = await prisma.user.count({
        where: {
          status: 'deleted',
          deletedAt: { not: null, lte: cutoff },
        },
      });
      return {
        entity: 'deleted_users',
        retentionDays: this.config.deletedUsersGraceDays,
        deleted: count,
        durationMs: Date.now() - start,
      };
    }

    try {
      const result = await DataDeletionService.processExpiredDeletions();
      this.recordMetric('deleted_users', result.anonymized.length);

      return {
        entity: 'deleted_users',
        retentionDays: this.config.deletedUsersGraceDays,
        deleted: result.anonymized.length,
        durationMs: Date.now() - start,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      };
    } catch (error) {
      return {
        entity: 'deleted_users',
        retentionDays: this.config.deletedUsersGraceDays,
        deleted: 0,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static recordMetric(entity: RetentionEntity, count: number): void {
    if (count > 0) {
      try {
        getMetrics().incrementCounter(
          'vyenfita_retention_deleted_total',
          { entity },
          count
        );
      } catch {
        // Metrics should never break cleanup
      }
    }
  }
      }
