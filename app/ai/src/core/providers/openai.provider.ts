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
  HealthCheckResult,
  StreamChunk,
  ChatMessage,
  Choice,
  Usage,
} from '../interfaces/ai-provider.interface';

/**
 * OpenAI Provider Implementation
 * Implements the AIProvider interface for OpenAI API
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly version = '1.0.0';
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: 3,
    });
  }

  async generateChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    try {
      const startTime = Date.now();
      const response = await this.client.chat.completions.create({
        model: params.model || this.config.model,
        messages: this.convertMessages(params.messages),
        temperature: params.temperature ?? this.config.temperature,
        max_tokens: params.maxTokens || this.config.maxTokens,
        stream: false,
        stop: params.stopSequences,
        top_p: params.topP ?? this.config.topP,
        frequency_penalty: params.frequencyPenalty ?? this.config.frequencyPenalty,
        presence_penalty: params.presencePenalty ?? this.config.presencePenalty,
        user: params.user,
        tools: params.functions?.map((f) => ({
          type: 'function' as const,
          function: {
            name: f.name,
            description: f.description,
            parameters: f.parameters,
          },
        })),
        tool_choice: this.convertFunctionCall(params.functionCall),
      });

      const elapsed = Date.now() - startTime;

      return {
        id: response.id,
        choices: response.choices.map((choice) => ({
          index: choice.index,
          message: {
            role: choice.message.role as 'system' | 'user' | 'assistant' | 'function' | 'tool',
            content: choice.message.content || '',
            function_call: choice.message.function_call || undefined,
            tool_calls: choice.message.tool_calls?.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
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
        system_fingerprint: response.system_fingerprint,
      };
    } catch (error) {
      throw new Error(`OpenAI provider error: ${this.getErrorMessage(error)}`);
    }
  }

  async *streamChatCompletion(params: ChatCompletionParams): AsyncIterable<StreamChunk> {
    try {
      const response = await this.client.chat.completions.create({
        model: params.model || this.config.model,
        messages: this.convertMessages(params.messages),
        temperature: params.temperature ?? this.config.temperature,
        max_tokens: params.maxTokens || this.config.maxTokens,
        stream: true,
        stop: params.stopSequences,
        top_p: params.topP ?? this.config.topP,
        frequency_penalty: params.frequencyPenalty ?? this.config.frequencyPenalty,
        presence_penalty: params.presencePenalty ?? this.config.presencePenalty,
        user: params.user,
      });

      for await (const chunk of response) {
        yield {
          id: chunk.id,
          choices: chunk.choices.map((choice) => ({
            index: choice.index,
            message: {
              role: 'assistant',
              content: choice.delta?.content || '',
            },
            finishReason: choice.finish_reason || '',
            delta: {
              content: choice.delta?.content || '',
              function_call: choice.delta?.function_call || undefined,
            },
          })),
          created: chunk.created || Date.now(),
          model: chunk.model || '',
          done: false,
        };
      }

      // Final chunk to signal completion
      yield {
        id: 'done',
        choices: [],
        created: Date.now(),
        model: 'done',
        done: true,
      };
    } catch (error) {
      throw new Error(`OpenAI stream error: ${this.getErrorMessage(error)}`);
    }
  }

  async generateTextCompletion(params: TextCompletionParams): Promise<TextCompletionResponse> {
    try {
      const response = await this.client.completions.create({
        model: this.config.model,
        prompt: params.prompt,
        max_tokens: params.maxTokens || this.config.maxTokens,
        temperature: params.temperature ?? this.config.temperature,
        stop: params.stopSequences,
        top_p: params.topP ?? this.config.topP,
        frequency_penalty: params.frequencyPenalty ?? this.config.frequencyPenalty,
        presence_penalty: params.presencePenalty ?? this.config.presencePenalty,
      });

      return {
        id: response.id,
        text: response.choices[0]?.text || '',
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

  async generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
    try {
      const response = await this.client.embeddings.create({
        model: params.model || 'text-embedding-3-small',
        input: params.input,
        encoding_format: params.encodingFormat || 'float',
      });

      return {
        data: response.data.map((item) => ({
          embedding: item.embedding as number[],
          index: item.index,
          object: 'embedding',
        })),
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
      };
    } catch (error) {
      throw new Error(`OpenAI provider error: ${this.getErrorMessage(error)}`);
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await this.client.models.list();
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
    try {
      const response = await this.client.models.list();
      return response.data.map((model) => model.id);
    } catch {
      return [
        'gpt-4-turbo-preview',
        'gpt-4-0125-preview',
        'gpt-4-1106-preview',
        'gpt-4',
        'gpt-3.5-turbo-0125',
        'gpt-3.5-turbo',
      ];
    }
  }

  estimateTokens(messages: ChatMessage[]): number {
    // Rough estimation: ~4 characters per token for English text
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  private convertMessages(messages: ChatMessage[]): any[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      function_call: msg.function_call,
      tool_calls: msg.tool_calls?.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      tool_call_id: msg.tool_call_id,
    }));
  }

  private convertFunctionCall(functionCall?: 'auto' | 'none' | { name: string }): any {
    if (!functionCall) return undefined;
    if (functionCall === 'auto') return 'auto';
    if (functionCall === 'none') return 'none';
    return { name: functionCall.name };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Check for OpenAI specific error
      const openAIError = error as any;
      if (openAIError.response?.data?.error?.message) {
        return openAIError.response.data.error.message;
      }
      return error.message;
    }
    return String(error);
  }
              }
