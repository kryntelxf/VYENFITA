/**
 * VYENFITA Mock AI Provider
 * 
 * Provides deterministic AI responses for tests.
 * Does NOT hit real AI APIs.
 * 
 * @version 1.0.0
 */

import {
  AIProvider,
  ChatCompletionParams,
  ChatCompletionResponse,
  TextCompletionParams,
  TextCompletionResponse,
  EmbeddingParams,
  EmbeddingResponse,
  ProviderConfig,
  HealthCheckResult,
  StreamChunk,
  ChatMessage,
} from '../../core/interfaces/ai-provider.interface';

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  readonly version = '1.0.0';

  private config: ProviderConfig;
  private responses: Map<string, any> = new Map();

  constructor(config?: Partial<ProviderConfig>) {
    this.config = {
      model: 'mock-model',
      maxTokens: 4096,
      temperature: 0.7,
      ...config,
    };
  }

  /**
   * Register a canned response for a prompt pattern
   */
  setResponse(pattern: string, response: any): void {
    this.responses.set(pattern, response);
  }

  async generateChatCompletion(
    params: ChatCompletionParams
  ): Promise<ChatCompletionResponse> {
    const userMessage = params.messages.find((m) => m.role === 'user')?.content || '';

    // Find matching canned response
    let content = '{"response": "mock response"}';
    for (const [pattern, response] of this.responses) {
      if (userMessage.includes(pattern)) {
        content = typeof response === 'string' ? response : JSON.stringify(response);
        break;
      }
    }

    return {
      id: `mock-${Date.now()}`,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finishReason: 'stop',
        },
      ],
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      created: Math.floor(Date.now() / 1000),
      model: this.config.model,
    };
  }

  async generateTextCompletion(
    params: TextCompletionParams
  ): Promise<TextCompletionResponse> {
    return {
      id: `mock-${Date.now()}`,
      text: `Mock response for: ${params.prompt.substring(0, 50)}`,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      created: Math.floor(Date.now() / 1000),
      model: this.config.model,
    };
  }

  async generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
    const inputs = Array.isArray(params.input) ? params.input : [params.input];
    return {
      data: inputs.map((_, index) => ({
        embedding: new Array(1536).fill(0).map(() => Math.random()),
        index,
        object: 'embedding',
      })),
      usage: {
        promptTokens: inputs.length * 10,
        completionTokens: 0,
        totalTokens: inputs.length * 10,
      },
      model: 'mock-embedding',
    };
  }

  async *streamChatCompletion(
    params: ChatCompletionParams
  ): AsyncIterable<StreamChunk> {
    const chunks = ['Hello', ' ', 'world', '!'];
    for (let i = 0; i < chunks.length; i++) {
      yield {
        id: `mock-${Date.now()}-${i}`,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: chunks[i] },
            finishReason: '',
            delta: { content: chunks[i] },
          },
        ],
        created: Math.floor(Date.now() / 1000),
        model: this.config.model,
        done: false,
      };
    }

    yield {
      id: 'done',
      choices: [],
      created: Math.floor(Date.now() / 1000),
      model: 'done',
      done: true,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: true,
      provider: this.name,
      version: this.version,
      latency: 5,
      timestamp: Date.now(),
    };
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  async getAvailableModels(): Promise<string[]> {
    return ['mock-model', 'mock-model-fast'];
  }

  estimateTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }
  }
