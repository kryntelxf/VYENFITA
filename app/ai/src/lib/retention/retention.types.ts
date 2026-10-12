/**
 * VYENFITA Retention Types
 * 
 * @version 1.0.0
 */

export type RetentionEntity =
  | 'audit_events'
  | 'workflow_executions'
  | 'agent_steps'
  | 'sessions'
  | 'oauth_states'
  | 'deleted_users';

export interface RetentionResult {
  entity: RetentionEntity;
  retentionDays: number;
  deleted: number;
  durationMs: number;
  error?: string;
}

export interface RetentionReport {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  dryRun: boolean;
  results: RetentionResult[];
  totalDeleted: number;
  errors: string[];
}

export interface RetentionConfig {
  auditEvents: number;
  workflowExecutions: number;
  agentSteps: number;
  sessionsGraceDays: number;
  oauthStatesGraceMinutes: number;
  deletedUsersGraceDays: number;
  }
