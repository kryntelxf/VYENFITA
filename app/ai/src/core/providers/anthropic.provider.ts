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
  ChatMessage,
} from '../interfaces/ai-provider.interface';

/**
 * Anthropic Provider Implementation
 * Implements the AIProvider interface for Anthropic Claude API
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
    });
  }

  async generateChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    try {
      // Convert VYENFITA messages to Anthropic format
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
        temperature: params.temperature || this.config.temperature,
        stop_sequences: params.stopSequences,
      });

      return {
        id: response.id,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: response.content[0]?.text || '',
            },
            finishReason: response.stop_reason || 'stop',
          },
        ],
        usage: {
          promptTokens: response.usage?.input_tokens || 0,
          completionTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        },
        created: Date.now(),
        model: response.model,
      };
    } catch (error) {
      throw new Error(`Anthropic provider error: ${this.getErrorMessage(error)}`);
    }
  }

  async generateTextCompletion(params: TextCompletionParams): Promise<TextCompletionResponse> {
    // Anthropic doesn't support text completion in the same way as OpenAI
    // We'll use chat completion as a fallback
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
    };
  }

  async generateEmbeddings(_params: EmbeddingParams): Promise<EmbeddingResponse> {
    throw new Error('Anthropic does not support embeddings at this time');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try a minimal completion
      await this.client.messages.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): ProviderConfig {
    return this.config;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
        }
