/**
 * VYENFITA Anthropic Provider
 * 
 * Real Anthropic integration
 * 
 * @version 1.0.0
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  AIRateLimitError,
  AITimeoutError,
} from '../provider.interface';

export interface AnthropicProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  timeoutMs: number;
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  private client: Anthropic;
  private config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      maxRetries: 0,
    });
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    try {
      const { system, messages } = this.buildMessages(request);

      const response = await this.client.messages.create({
        model: request.model || this.config.defaultModel,
        system,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stop_sequences: request.stopSequences,
      });

      const latencyMs = Date.now() - startTime;
      const content = response.content
        .filter((c) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');

      return {
        id: response.id,
        content,
        model: response.model,
        provider: this.name,
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        latencyMs,
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();

    try {
      await this.client.messages.create({
        model: this.config.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { healthy: true, latencyMs: Date.now() - startTime };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private buildMessages(request: AICompletionRequest): {
    system: string | undefined;
    messages: any[];
  } {
    let system = request.systemPrompt;
    const messages: any[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        // Anthropic uses separate system parameter
        system = system ? `${system}\n\n${msg.content}` : msg.content;
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    return { system, messages };
  }

  private normalizeError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    const err = error as any;
    const status = err?.status || err?.response?.status;

    if (status === 429) {
      return new AIRateLimitError(this.name, err);
    }

    if (err?.code === 'ETIMEDOUT' || err?.message?.includes('timeout')) {
      return new AITimeoutError(this.name, this.config.timeoutMs);
    }

    if (status === 401) {
      return new AIProviderError(
        'Invalid API key',
        this.name,
        'AUTH_ERROR',
        false,
        err
      );
    }

    if (status >= 500) {
      return new AIProviderError(
        `Anthropic server error: ${status}`,
        this.name,
        'SERVER_ERROR',
        true,
        err
      );
    }

    return new AIProviderError(
      err?.message || 'Anthropic request failed',
      this.name,
      'UNKNOWN',
      false,
      err
    );
  }
      }
