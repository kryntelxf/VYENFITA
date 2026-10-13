/**
 * VYENFITA Tracing Types
 * 
 * @version 1.0.0
 */

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint: string;
  sampleRate: number;
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Well-known attribute keys — follow OpenTelemetry semantic conventions
 * where applicable, use `vyenfita.*` prefix for custom.
 */
export const SpanAttrs = {
  // Standard (from @opentelemetry/semantic-conventions)
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_STATUS: 'http.status_code',
  HTTP_ROUTE: 'http.route',
  HTTP_USER_AGENT: 'http.user_agent',
  DB_SYSTEM: 'db.system',
  DB_STATEMENT: 'db.statement',
  DB_OPERATION: 'db.operation',

  // Custom VYENFITA
  TENANT_ID: 'vyenfita.tenant_id',
  USER_ID: 'vyenfita.user_id',
  REQUEST_ID: 'vyenfita.request_id',
  TRACE_ID: 'vyenfita.trace_id',
  WORKFLOW_ID: 'vyenfita.workflow_id',
  EXECUTION_ID: 'vyenfita.execution_id',
  AGENT_ID: 'vyenfita.agent_id',
  RUN_ID: 'vyenfita.run_id',
  AI_PROVIDER: 'vyenfita.ai.provider',
  AI_MODEL: 'vyenfita.ai.model',
  AI_TOKENS: 'vyenfita.ai.tokens',
  AI_COST_USD: 'vyenfita.ai.cost_usd',
  JOB_QUEUE: 'vyenfita.job.queue',
  JOB_ID: 'vyenfita.job.id',
} as const;
