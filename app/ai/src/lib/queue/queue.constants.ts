/**
 * VYENFITA Queue Constants
 * 
 * @version 1.0.0
 */

export const QUEUE_NAMES = {
  WORKFLOW_EXECUTE: 'workflow-execute',
  AGENT_RUN: 'agent-run',
  RETENTION_CLEANUP: 'retention-cleanup',
  REPORT_GENERATE: 'report-generate',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5_000, // 5s → 10s → 20s
  },
  removeOnComplete: {
    age: 24 * 3600, // keep completed jobs for 24h
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // keep failed jobs for 7 days
    count: 5000,
  },
};

export const REDIS_DEFAULT_URL = 'redis://localhost:6379';
