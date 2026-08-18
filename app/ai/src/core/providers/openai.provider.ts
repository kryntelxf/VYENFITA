import { OpenAI } from 'openai';
import {
  AIProvider,
  ChatCompletionParams,
  ChatCompletionResponse,
  TextCompletionParams,
  TextCompletionResponse,
  EmbeddingParams,
  EmbeddingResponse,
  ProviderConfig,
} from '../interfaces/ai-provider.interface';

/**
 * OpenAI Provider Implementation
 * Implements the AIProvider interface for OpenAI API
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
    });
  }

  async generateChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: params.model || this.config.model,
        messages: params.messages,
        temperature: params.temperature || this.config.temperature,
        max_tokens: params.maxTokens || this.config.maxTokens,
        stream: params.stream || false,
        stop: params.stopSequences,
      });

      return {
        id: response.id,
        choices: response.choices.map((choice) => ({
          index: choice.index,
          message: {
            role: choice.message.role as 'system' | 'user' | 'assistant' | 'function',
            content: choice.message.content || '',
            function_call: choice.message.function_call || undefined,
          },
          finishReason: choice.finish_reason || 'stop',
        })),
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        created: response.created,
        model: response.model,
      };
    } catch (error) {
      throw new Error(`OpenAI provider error: ${this.getErrorMessage(error)}`);
    }
  }

  async generateTextCompletion(params: TextCompletionParams): Promise<TextCompletionResponse> {
    try {
      const response = await this.client.completions.create({
        model: this.config.model,
        prompt: params.prompt,
        max_tokens: params.maxTokens || this.config.maxTokens,
        temperature: params.temperature || this.config.temperature,
        stop: params.stopSequences,
      });

      return {
        id: response.id,
        text: response.choices[0]?.text || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI provider error: ${this.getErrorMessage(error)}`);
    }
  }

  async generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
    try {
      const response = await this.client.embeddings.create({
        model: params.model || 'text-embedding-3-small',
        input: params.input,
      });

      return {
        data: response.data.map((item) => ({
          embedding: item.embedding,
          index: item.index,
        })),
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI provider error: ${this.getErrorMessage(error)}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to list models
      await this.client.models.list();
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
