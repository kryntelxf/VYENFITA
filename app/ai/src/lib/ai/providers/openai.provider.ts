/**
 * VYENFITA OpenAI Provider
 * 
 * Real OpenAI integration with:
 * - Timeout enforcement
 * - Error normalization
 * - Retryable error classification
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  AIRateLimitError,
  AITimeoutError,
} from '../provider.interface';

export interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  timeoutMs: number;
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  private client: OpenAI;
  private config: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      maxRetries: 0, // We handle retries ourselves
    });
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    try {
      const messages = this.buildMessages(request);

      const response = await this.client.chat.completions.create({
        model: request.model || this.config.defaultModel,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stop: request.stopSequences,
        response_format:
          request.responseFormat === 'json'
            ? { type: 'json_object' }
            : undefined,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      return {
        id: response.id,
        content: choice?.message?.content || '',
        model: response.model,
        provider: this.name,
        finishReason: (choice?.finish_reason as any) || 'stop',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
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
      await this.client.models.list();
      return { healthy: true, latencyMs: Date.now() - startTime };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private buildMessages(request: AICompletionRequest): any[] {
    const messages: any[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    return messages;
  }

  private normalizeError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    const err = error as any;
    const status = err?.status || err?.response?.status;
    const code = err?.code || err?.error?.code;

    // Rate limit
    if (status === 429) {
      return new AIRateLimitError(this.name, err);
    }

    // Timeout
    if (code === 'ETIMEDOUT' || err?.message?.includes('timeout')) {
      return new AITimeoutError(this.name, this.config.timeoutMs);
    }

    // Authentication
    if (status === 401) {
      return new AIProviderError(
        'Invalid API key',
        this.name,
        'AUTH_ERROR',
        false,
        err
      );
    }

    // Server errors (retryable)
    if (status >= 500) {
      return new AIProviderError(
        `OpenAI server error: ${status}`,
        this.name,
        'SERVER_ERROR',
        true,
        err
      );
    }

    // Context length
    if (code === 'context_length_exceeded') {
      return new AIProviderError(
        'Context length exceeded',
        this.name,
        'CONTEXT_LENGTH',
        false,
        err
      );
    }

    // Generic
    return new AIProviderError(
      err?.message || 'OpenAI request failed',
      this.name,
      'UNKNOWN',
      false,
      err
    );
  }
  }
