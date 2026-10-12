/**
 * VYENFITA Queue Types
 * 
 * @version 1.0.0
 */

import type { QueueName } from './queue.constants';

// ============================================================
// Job Payloads
// ============================================================

export interface WorkflowExecutePayload {
  workflowId: string;
  executionId: string;
  tenantId: string;
  userId?: string;
  input?: Record<string, any>;
  triggerType: 'manual' | 'schedule' | 'webhook' | 'event';
}

export interface AgentRunPayload {
  agentId: string;
  runId: string;
  tenantId: string;
  userId?: string;
  objective: string;
  context?: Record<string, any>;
}

export interface RetentionCleanupPayload {
  dryRun?: boolean;
}

export interface ReportGeneratePayload {
  reportId: string;
  tenantId: string;
  userId: string;
  format: 'pdf' | 'csv' | 'json' | 'html';
  recipients?: string[];
}

export type JobPayload =
  | WorkflowExecutePayload
  | AgentRunPayload
  | RetentionCleanupPayload
  | ReportGeneratePayload;

// ============================================================
// Job Results
// ============================================================

export interface JobResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  durationMs: number;
}

export interface QueueStats {
  name: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface EnqueueOptions {
  delay?: number;
  priority?: number;
  jobId?: string;
  attempts?: number;
  repeat?: {
    pattern: string;
  };
  }
