/**
 * VYENFITA Trigger Service
 * 
 * Manages workflow triggers:
 * - Register/unregister triggers
 * - Persist to database
 * - Fire triggers → execute workflow
 * - Track execution history
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { getWorkflowEngine } from './workflow-engine';
import { CronParser } from './cron-parser';
import {
  TriggerConfig,
  TriggerType,
  TriggerResult,
  ScheduleConfig,
  WebhookConfig,
  EventConfig,
  ManualConfig,
  TriggerError,
} from './trigger.interface';

export interface RegisterTriggerInput {
  workflowId: string;
  tenantId: string;
  type: TriggerType;
  config: ScheduleConfig | WebhookConfig | EventConfig | ManualConfig;
  enabled?: boolean;
}

export class TriggerService {
  /**
   * Register a new trigger
   */
  async register(input: RegisterTriggerInput): Promise<TriggerConfig> {
    // Verify workflow exists and belongs to tenant
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: input.workflowId,
        tenantId: input.tenantId,
        deletedAt: null,
      },
    });

    if (!workflow) {
      throw new TriggerError('Workflow not found', '', 'WORKFLOW_NOT_FOUND');
    }

    // Validate config by type
    this.validateConfig(input.type, input.config);

    // Compute next trigger time for schedules
    let nextTriggerAt: Date | undefined;
    if (input.type === 'schedule') {
      const scheduleConfig = input.config as ScheduleConfig;
      nextTriggerAt = CronParser.getNextRun(scheduleConfig.cron, new Date(), scheduleConfig.timezone);
    }

    // Store trigger in workflow triggers array (simple persistence)
    const trigger: TriggerConfig = {
      id: uuidv4(),
      workflowId: input.workflowId,
      tenantId: input.tenantId,
      type: input.type,
      enabled: input.enabled !== false,
      config: input.config,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextTriggerAt,
      triggerCount: 0,
    };

    // Append to workflow's triggers array
    const currentTriggers = (workflow.triggers as any[]) || [];
    currentTriggers.push(trigger as any);

    await prisma.workflow.update({
      where: { id: input.workflowId },
      data: { triggers: currentTriggers },
    });

    await auditService.log({
      tenantId: input.tenantId,
      eventType: 'create',
      action: 'trigger.register',
      resource: 'trigger',
      resourceId: trigger.id,
      details: {
        workflowId: input.workflowId,
        type: input.type,
      },
      status: 'success',
    });

    logger.info('Trigger registered', {
      triggerId: trigger.id,
      workflowId: input.workflowId,
      type: input.type,
    });

    return trigger;
  }

  /**
   * Unregister a trigger
   */
  async unregister(triggerId: string, tenantId: string): Promise<void> {
    const workflows = await prisma.workflow.findMany({
      where: { tenantId, deletedAt: null },
    });

    for (const workflow of workflows) {
      const triggers = (workflow.triggers as any[]) || [];
      const index = triggers.findIndex((t: any) => t.id === triggerId);

      if (index !== -1) {
        triggers.splice(index, 1);
        await prisma.workflow.update({
          where: { id: workflow.id },
          data: { triggers },
        });

        await auditService.log({
          tenantId,
          eventType: 'delete',
          action: 'trigger.unregister',
          resource: 'trigger',
          resourceId: triggerId,
          details: { workflowId: workflow.id },
          status: 'success',
        });

        logger.info('Trigger unregistered', { triggerId, workflowId: workflow.id });
        return;
      }
    }

    throw new TriggerError('Trigger not found', triggerId, 'NOT_FOUND');
  }

  /**
   * List triggers for a workflow
   */
  async listByWorkflow(workflowId: string, tenantId: string): Promise<TriggerConfig[]> {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, tenantId, deletedAt: null },
    });

    if (!workflow) {
      throw new TriggerError('Workflow not found', '', 'WORKFLOW_NOT_FOUND');
    }

    return ((workflow.triggers as any[]) || []) as TriggerConfig[];
  }

  /**
   * Find a webhook trigger by path
   */
  async findByWebhookPath(path: string): Promise<TriggerConfig | null> {
    const workflows = await prisma.workflow.findMany({
      where: { deletedAt: null },
    });

    for (const workflow of workflows) {
      const triggers = (workflow.triggers as any[]) || [];
      for (const trigger of triggers) {
        if (
          trigger.type === 'webhook' &&
          (trigger.config as WebhookConfig).path === path
        ) {
          return trigger as TriggerConfig;
        }
      }
    }

    return null;
  }

  /**
   * Fire a trigger — execute the associated workflow
   */
  async fire(
    triggerId: string,
    options: {
      input?: Record<string, any>;
      triggerType?: 'manual' | 'schedule' | 'webhook' | 'api';
    } = {}
  ): Promise<TriggerResult> {
    const startTime = Date.now();

    // Find the trigger
    const workflows = await prisma.workflow.findMany({
      where: { deletedAt: null },
    });

    let foundTrigger: TriggerConfig | null = null;
    let foundWorkflowId: string | null = null;

    for (const workflow of workflows) {
      const triggers = (workflow.triggers as any[]) || [];
      const trigger = triggers.find((t: any) => t.id === triggerId);
      if (trigger) {
        foundTrigger = trigger as TriggerConfig;
        foundWorkflowId = workflow.id;
        break;
      }
    }

    if (!foundTrigger || !foundWorkflowId) {
      throw new TriggerError('Trigger not found', triggerId, 'NOT_FOUND');
    }

    if (!foundTrigger.enabled) {
      throw new TriggerError('Trigger is disabled', triggerId, 'DISABLED');
    }

    // Execute the workflow
    try {
      const engine = getWorkflowEngine();
      const result = await engine.execute(foundWorkflowId, {
        tenantId: foundTrigger.tenantId,
        input: options.input || {},
        triggerType: options.triggerType || 'manual',
      });

      // Update trigger stats
      await this.updateTriggerStats(foundTrigger, foundWorkflowId);

      return {
        triggerId,
        success: result.status === 'completed',
        executionId: result.executionId,
        error: result.error,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        triggerId,
        success: false,
        error: error instanceof Error ? error.message : 'Trigger fire failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get all schedule triggers that are due to run
   */
  async getDueSchedules(now: Date = new Date()): Promise<TriggerConfig[]> {
    const workflows = await prisma.workflow.findMany({
      where: { deletedAt: null },
    });

    const due: TriggerConfig[] = [];

    for (const workflow of workflows) {
      const triggers = (workflow.triggers as any[]) || [];

      for (const trigger of triggers) {
        if (
          trigger.type === 'schedule' &&
          trigger.enabled &&
          trigger.nextTriggerAt &&
          new Date(trigger.nextTriggerAt) <= now
        ) {
          due.push(trigger as TriggerConfig);
        }
      }
    }

    return due;
  }

  /**
   * Update trigger stats after firing
   */
  private async updateTriggerStats(
    trigger: TriggerConfig,
    workflowId: string
  ): Promise<void> {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId },
    });

    if (!workflow) return;

    const triggers = (workflow.triggers as any[]) || [];
    const index = triggers.findIndex((t: any) => t.id === trigger.id);

    if (index === -1) return;

    const updated = {
      ...triggers[index],
      lastTriggeredAt: new Date(),
      triggerCount: (triggers[index].triggerCount || 0) + 1,
      updatedAt: new Date(),
    };

    // Compute next trigger time if schedule
    if (updated.type === 'schedule') {
      const scheduleConfig = updated.config as ScheduleConfig;
      try {
        updated.nextTriggerAt = CronParser.getNextRun(
          scheduleConfig.cron,
          new Date(),
          scheduleConfig.timezone
        );
      } catch (error) {
        logger.warn('Failed to compute next trigger time', {
          triggerId: trigger.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    triggers[index] = updated;

    await prisma.workflow.update({
      where: { id: workflowId },
      data: { triggers },
    });
  }

  /**
   * Validate config by trigger type
   */
  private validateConfig(type: TriggerType, config: any): void {
    if (!config || typeof config !== 'object') {
      throw new TriggerError('Config must be an object', '', 'INVALID_CONFIG');
    }

    switch (type) {
      case 'schedule': {
        const c = config as ScheduleConfig;
        if (!c.cron) {
          throw new TriggerError('Schedule config requires cron', '', 'INVALID_CONFIG');
        }
        const validation = CronParser.validate(c.cron);
        if (!validation.valid) {
          throw new TriggerError(
            `Invalid cron expression: ${validation.error}`,
            '',
            'INVALID_CRON'
          );
        }
        break;
      }
      case 'webhook': {
        const c = config as WebhookConfig;
        if (!c.path) {
          throw new TriggerError('Webhook config requires path', '', 'INVALID_CONFIG');
        }
        if (!c.method) {
          throw new TriggerError('Webhook config requires method', '', 'INVALID_CONFIG');
        }
        if (!c.secret || c.secret.length < 32) {
          throw new TriggerError(
            'Webhook config requires secret (min 32 chars)',
            '',
            'INVALID_CONFIG'
          );
        }
        break;
      }
      case 'event': {
        const c = config as EventConfig;
        if (!c.event) {
          throw new TriggerError('Event config requires event name', '', 'INVALID_CONFIG');
        }
        break;
      }
      case 'manual':
        // No specific validation
        break;
      default:
        throw new TriggerError(`Unknown trigger type: ${type}`, '', 'INVALID_TYPE');
    }
  }
}

let instance: TriggerService | undefined;

export function getTriggerService(): TriggerService {
  if (!instance) {
    instance = new TriggerService();
  }
  return instance;
}
