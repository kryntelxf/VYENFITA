/**
 * VYENFITA Anthropic Provider
 * 
 * Implements the AIProvider interface for Anthropic Claude API
 * 
 * @version 1.0.0
 */

import { Anthropic } from '@anthropic-ai/sdk';
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
} from '../interfaces/ai-provider.interface';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly version = '1.0.0';
  private client: Anthropic;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: 0,
    });
  }

  async generateChatCompletion(
    params: ChatCompletionParams
  ): Promise<ChatCompletionResponse> {
    try {
      const systemPrompt = params.messages.find((m) => m.role === 'system')?.content || '';
      const userMessages = params.messages.filter((m) => m.role !== 'system');

      const response = await this.client.messages.create({
        model: params.model || this.config.model,
        system: systemPrompt,
        messages: userMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        max_tokens: params.maxTokens || this.config.maxTokens,
        temperature: params.temperature ?? this.config.temperature,
        stop_sequences: params.stopSequences,
      });

      // Extract text from content blocks safely
      const textContent = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text || '')
        .join('');

      return {
        id: response.id,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: textContent,
            },
            finishReason:
              response.stop_reason === 'end_turn'
                ? 'stop'
                : response.stop_reason === 'max_tokens'
                ? 'length'
                : 'stop',
          },
        ],
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        created: Math.floor(Date.now() / 1000),
        model: response.model,
      };
    } catch (error) {
      throw new Error(`Anthropic provider error: ${this.getErrorMessage(error)}`);
    }
  }

  async generateTextCompletion(
    params: TextCompletionParams
  ): Promise<TextCompletionResponse> {
    // Anthropic doesn't support text completion — use chat completion as fallback
    const chatParams: ChatCompletionParams = {
      messages: [{ role: 'user', content: params.prompt }],
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      stopSequences: params.stopSequences,
    };

    const result = await this.generateChatCompletion(chatParams);

    return {
      id: result.id,
      text: result.choices[0]?.message.content || '',
      usage: result.usage,
      created: result.created,
      model: result.model,
    };
  }

  async generateEmbeddings(
    _params: EmbeddingParams
  ): Promise<EmbeddingResponse> {
    throw new Error('Anthropic does not support embeddings at this time');
  }

  async *streamChatCompletion(
    _params: ChatCompletionParams
  ): AsyncIterable<StreamChunk> {
    throw new Error('Anthropic streaming not yet implemented');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });

      return {
        healthy: true,
        provider: this.name,
        version: this.version,
        latency: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.name,
        version: this.version,
        latency: Date.now() - startTime,
        error: this.getErrorMessage(error),
        timestamp: Date.now(),
      };
    }
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  async getAvailableModels(): Promise<string[]> {
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  estimateTokens(messages: ChatMessage[]): number {
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
          }
