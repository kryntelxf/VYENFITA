/**
 * VYENFITA AI Provider Interface
 * Defines the contract for all AI providers
 */
export interface AIProvider {
  /**
   * Provider name
   */
  readonly name: string;

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
   * Check if provider is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get provider configuration
   */
  getConfig(): ProviderConfig;
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
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: FunctionCall;
}

/**
 * Function call structure
 */
export interface FunctionCall {
  name: string;
  arguments: string;
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
}

/**
 * Choice structure
 */
export interface Choice {
  index: number;
  message: ChatMessage;
  finishReason: string;
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
}

/**
 * Text completion response
 */
export interface TextCompletionResponse {
  id: string;
  text: string;
  usage: Usage;
}

/**
 * Embedding parameters
 */
export interface EmbeddingParams {
  input: string | string[];
  model?: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  data: EmbeddingData[];
  usage: Usage;
}

/**
 * Embedding data
 */
export interface EmbeddingData {
  embedding: number[];
  index: number;
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
}
