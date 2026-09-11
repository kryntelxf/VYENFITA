/**
 * VYENFITA Trigger Interface
 * 
 * Contract for workflow triggers:
 * - Schedule (cron)
 * - Webhook (HTTP)
 * - Event (internal)
 * - Manual
 * 
 * @version 1.0.0
 */

export type TriggerType = 'schedule' | 'webhook' | 'event' | 'manual';

export interface TriggerConfig {
  id: string;
  workflowId: string;
  tenantId: string;
  type: TriggerType;
  enabled: boolean;
  config: ScheduleConfig | WebhookConfig | EventConfig | ManualConfig;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
  nextTriggerAt?: Date;
  triggerCount: number;
}

export interface ScheduleConfig {
  cron: string; // e.g. "0 9 * * 1"
  timezone: string; // e.g. "Asia/Jakarta"
  startAt?: string; // ISO 8601, optional
  endAt?: string; // ISO 8601, optional
}

export interface WebhookConfig {
  path: string; // e.g. "/my-workflow"
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  secret: string; // for HMAC verification
  headers?: Record<string, string>; // required headers
}

export interface EventConfig {
  event: string; // e.g. "application.published"
  filters?: Record<string, any>;
}

export interface ManualConfig {
  allowedUsers?: string[];
}

export interface TriggerResult {
  triggerId: string;
  success: boolean;
  executionId?: string;
  error?: string;
  durationMs: number;
}

export class TriggerError extends Error {
  constructor(
    message: string,
    public readonly triggerId: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'TriggerError';
  }
}
