/**
 * VYENFITA Agent Interface
 * 
 * Contract for all AI agents:
 * - Bounded responsibilities
 * - Permission model
 * - Audit logging
 * - Human approval for destructive actions
 * 
 * @version 1.0.0
 */

export interface AgentContext {
  tenantId: string;
  userId: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AgentTask<Input = any, Output = any> {
  agent: string;
  input: Input;
  context: AgentContext;
  options?: {
    maxRetries?: number;
    timeoutMs?: number;
    requireApproval?: boolean;
  };
}

export interface AgentResult<Output = any> {
  agent: string;
  success: boolean;
  output?: Output;
  error?: string;
  confidence?: number;
  reasoning?: string;
  auditLogId?: string;
  requiresApproval?: boolean;
  approvalToken?: string;
  durationMs: number;
  tokensUsed?: number;
  costUsd?: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  destructive: boolean; // Does it modify state?
  requiresApproval: boolean;
}

export interface Agent {
  readonly name: string;
  readonly description: string;
  readonly capabilities: AgentCapability[];

  /**
   * Execute the agent's task
   */
  execute<Input, Output>(task: AgentTask<Input, Output>): Promise<AgentResult<Output>>;

  /**
   * Validate input before execution
   */
  validate<Input>(input: Input): { valid: boolean; errors: string[] };
}

/**
 * Custom errors
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly agent: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class AgentPermissionError extends AgentError {
  constructor(agent: string, capability: string) {
    super(
      `Agent "${agent}" does not have permission for capability: ${capability}`,
      agent,
      'PERMISSION_DENIED',
      false
    );
    this.name = 'AgentPermissionError';
  }
}

export class AgentApprovalRequiredError extends AgentError {
  constructor(
    agent: string,
    public readonly approvalToken: string,
    public readonly reason: string
  ) {
    super(
      `Agent "${agent}" requires approval for this action: ${reason}`,
      agent,
      'APPROVAL_REQUIRED',
      false
    );
    this.name = 'AgentApprovalRequiredError';
  }
}
