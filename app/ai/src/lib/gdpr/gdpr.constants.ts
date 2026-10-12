/**
 * VYENFITA GDPR Constants
 * 
 * @version 1.0.0
 */

export const GDPR_EXPORT_VERSION = '1.0.0';

/**
 * Grace period before hard deletion (in days).
 * GDPR allows reasonable delay; 30 days is common industry practice.
 */
export const DELETION_GRACE_PERIOD_DAYS = 30;

/**
 * Max size of sync export payload (bytes).
 * Larger exports should use async job.
 */
export const MAX_SYNC_EXPORT_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Default retention periods (in days) for automated cleanup.
 */
export const RETENTION_PERIODS = {
  auditEvents: 90,
  workflowExecutions: 30,
  agentSteps: 90,
  sessionsExpiredGraceDays: 30,
  oauthStatesExpiredGraceMinutes: 60,
} as const;
