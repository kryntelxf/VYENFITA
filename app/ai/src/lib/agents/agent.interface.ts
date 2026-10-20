export interface AgentCapability {
  name: string;
  description: string;
  destructive: boolean;
  requiresApproval: boolean;
}

export interface AgentTask<TInput = any, _TOutput = any> {
  agent: string;
  input: TInput;
  context: {
    tenantId: string;
    userId: string;
    requestId: string;
  };
}

export interface AgentResult<TOutput = any> {
  agent: string;
  success: boolean;
  output?: TOutput;
  error?: string;
  confidence?: number;
  durationMs: number;
}

export interface Agent {
  readonly name: string;
  readonly description: string;
  readonly capabilities: AgentCapability[];
  validate(input: any): { valid: boolean; errors: string[] };
  execute(task: AgentTask): Promise<AgentResult>;
}
