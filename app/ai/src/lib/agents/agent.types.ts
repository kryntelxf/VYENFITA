/**
 * VYENFITA Agent Types
 * 
 * Core types for autonomous agent system.
 * 
 * @version 2.0.0
 */

// ============================================================
// AGENT DEFINITION
// ============================================================

export type AgentStatus = 'active' | 'paused' | 'archived';
export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval';
export type AgentStepType = 'think' | 'tool_call' | 'decision' | 'approval' | 'output';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AgentDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  
  // Configuration
  systemPrompt: string;
  model: string;
  temperature: number;
  maxSteps: number;
  maxTokensPerRun: number;
  maxDurationSeconds: number;
  
  // Tools available to this agent
  allowedTools: string[];
  
  // Permissions
  capabilities: AgentCapability[];
  
  // Approval gates
  requiresApproval: boolean;
  approvalThreshold: RiskLevel;
  
  // Triggers
  triggers: AgentTrigger[];
  
  // Status
  status: AgentStatus;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCapability {
  name: string; // e.g. "read:applications", "write:workflows", "execute:tools"
  riskLevel: RiskLevel;
  requiresApproval: boolean;
}

export interface AgentTrigger {
  id: string;
  type: 'manual' | 'schedule' | 'event' | 'webhook';
  config: Record<string, any>;
  enabled: boolean;
}

// ============================================================
// AGENT RUN
// ============================================================

export interface AgentRun {
  id: string;
  agentId: string;
  tenantId: string;
  userId?: string;
  
  // Input
  input: AgentInput;
  
  // Execution
  status: AgentRunStatus;
  steps: AgentStep[];
  currentStepIndex: number;
  
  // Output
  output?: AgentOutput;
  error?: string;
  
  // Resource usage
  totalTokens: number;
  totalCostUsd: number;
  toolCalls: number;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Approval
  approvalRequestId?: string;
  
  // Metadata
  metadata: Record<string, any>;
}

export interface AgentInput {
  objective: string;
  context?: Record<string, any>;
  constraints?: string[];
  expectedOutput?: string;
}

export interface AgentOutput {
  result: string;
  reasoning: string;
  actions: AgentAction[];
  data?: Record<string, any>;
  confidence: number;
  nextSteps?: string[];
}

export interface AgentAction {
  type: string;
  description: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: any;
  riskLevel: RiskLevel;
  executedAt: Date;
  success: boolean;
}

// ============================================================
// AGENT STEP
// ============================================================

export interface AgentStep {
  id: string;
  runId: string;
  stepIndex: number;
  type: AgentStepType;
  
  // Content
  thought?: string;
  action?: {
    tool: string;
    input: Record<string, any>;
  };
  observation?: any;
  decision?: {
    choice: string;
    reasoning: string;
  };
  output?: string;
  
  // Approval
  approval?: {
    required: boolean;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: Date;
    reason?: string;
  };
  
  // Meta
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  timestamp: Date;
  error?: string;
}

// ============================================================
// TOOLS
// ============================================================

export interface AgentTool {
  name: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  
  // Input schema (JSON Schema)
  inputSchema: Record<string, any>;
  
  // Output schema
  outputSchema?: Record<string, any>;
  
  // Implementation
  execute: (input: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  tenantId: string;
  agentId: string;
  runId: string;
  userId?: string;
  capabilities: string[];
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================
// MEMORY
// ============================================================

export interface AgentMemoryEntry {
  id: string;
  agentId: string;
  tenantId: string;
  runId?: string;
  type: 'observation' | 'fact' | 'preference' | 'context' | 'result';
  content: string;
  importance: number; // 0-1
  embedding?: number[];
  metadata: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
}

// ============================================================
// ERRORS
// ============================================================

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class AgentNotFoundError extends AgentError {
  constructor(id: string) {
    super(`Agent not found: ${id}`, 'AGENT_NOT_FOUND', 404);
  }
}

export class AgentCapabilityError extends AgentError {
  constructor(capability: string) {
    super(
      `Agent does not have capability: ${capability}`,
      'CAPABILITY_DENIED',
      403
    );
  }
}

export class AgentApprovalRequiredError extends AgentError {
  constructor(stepId: string, reason: string) {
    super(
      `Approval required for step ${stepId}: ${reason}`,
      'APPROVAL_REQUIRED',
      202
    );
  }
}

export class AgentLimitExceededError extends AgentError {
  constructor(limit: string, value: number) {
    super(
      `Agent limit exceeded: ${limit} = ${value}`,
      'LIMIT_EXCEEDED',
      429
    );
  }
}

export class AgentTimeoutError extends AgentError {
  constructor(seconds: number) {
    super(
      `Agent run timed out after ${seconds} seconds`,
      'TIMEOUT',
      408
    );
  }
}

// ============================================================
// CONSTANTS
// ============================================================

export const DEFAULT_AGENT_CONFIG = {
  model: 'gpt-4-turbo-preview',
  temperature: 0.3,
  maxSteps: 20,
  maxTokensPerRun: 100000,
  maxDurationSeconds: 300, // 5 minutes
  requiresApproval: true,
  approvalThreshold: 'high' as RiskLevel,
};

export const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
