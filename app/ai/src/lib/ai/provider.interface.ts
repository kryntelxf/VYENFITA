/**
 * VYENFITA AI Provider Interface
 * 
 * Contract for all AI providers
 * 
 * @version 1.0.0
 */

export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  responseFormat?: 'text' | 'json';
  systemPrompt?: string;
  tools?: AITool[];
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface AICompletionResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  usage: AIUsage;
  latencyMs: number;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

export interface AIProvider {
  readonly name: string;

  /**
   * Generate a completion
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Stream a completion (optional)
   */
  stream?(request: AICompletionRequest): AsyncIterable<AIStreamChunk>;

  /**
   * Health check
   */
  healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    error?: string;
  }>;
}

/**
 * Custom error types
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class AIRateLimitError extends AIProviderError {
  constructor(provider: string, originalError?: Error) {
    super('Rate limit exceeded', provider, 'RATE_LIMIT', true, originalError);
    this.name = 'AIRateLimitError';
  }
}

export class AITimeoutError extends AIProviderError {
  constructor(provider: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, provider, 'TIMEOUT', true);
    this.name = 'AITimeoutError';
  }
}
