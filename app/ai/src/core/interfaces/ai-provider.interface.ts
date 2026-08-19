/**
 * VYENFITA AI Provider Interface
 * Defines the contract for all AI providers
 * 
 * @version 1.0.0
 * @since 0.1.0
 */

export interface AIProvider {
  /**
   * Provider name identifier
   */
  readonly name: string;

  /**
   * Provider version
   */
  readonly version: string;

  /**
   * Generate a chat completion
   */
  generateChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse>;

  /**
   * Generate a text completion
   */
  generateTextCompletion(params: TextCompletionParams): Promise<TextCompletionResponse>;

  /**
   * Generate embeddings
   */
  generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse>;

  /**
   * Stream a chat completion
   */
  streamChatCompletion(params: ChatCompletionParams): AsyncIterable<StreamChunk>;

  /**
   * Check if provider is healthy
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Get provider configuration
   */
  getConfig(): ProviderConfig;

  /**
   * Get available models
   */
  getAvailableModels(): Promise<string[]>;

  /**
   * Estimate token count for a message
   */
  estimateTokens(messages: ChatMessage[]): number;
}

/**
 * Chat completion parameters
 */
export interface ChatCompletionParams {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stopSequences?: string[];
  model?: string;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  user?: string;
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Function call structure
 */
export interface FunctionCall {
  name: string;
  arguments: string;
}

/**
 * Tool call structure
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

/**
 * Function definition
 */
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  choices: Choice[];
  usage: Usage;
  created: number;
  model: string;
  system_fingerprint?: string;
}

/**
 * Choice structure
 */
export interface Choice {
  index: number;
  message: ChatMessage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call' | string;
  delta?: Partial<ChatMessage>;
}

/**
 * Usage information
 */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Text completion parameters
 */
export interface TextCompletionParams {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Text completion response
 */
export interface TextCompletionResponse {
  id: string;
  text: string;
  usage: Usage;
  created: number;
  model: string;
}

/**
 * Embedding parameters
 */
export interface EmbeddingParams {
  input: string | string[];
  model?: string;
  encodingFormat?: 'float' | 'base64';
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  data: EmbeddingData[];
  usage: Usage;
  model: string;
}

/**
 * Embedding data
 */
export interface EmbeddingData {
  embedding: number[];
  index: number;
  object: 'embedding';
}

/**
 * Stream chunk
 */
export interface StreamChunk {
  id: string;
  choices: Choice[];
  created: number;
  model: string;
  done: boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  baseURL?: string;
  timeout?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  provider: string;
  version: string;
  latency: number;
  error?: string;
  timestamp: number;
}

/**
 * Provider type enum
 */
export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  LOCAL = 'local',
  CUSTOM = 'custom',
  }
