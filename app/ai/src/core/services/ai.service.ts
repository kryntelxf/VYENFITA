import { AIProviderFactory } from '../providers/provider-factory';
import {
  AIProvider,
  ChatCompletionParams,
  ChatCompletionResponse,
  ProviderConfig,
  HealthCheckResult,
  StreamChunk,
  ProviderType,
} from '../interfaces/ai-provider.interface';
import { ProviderConfigManager } from '../../config/providers.config';
import NodeCache from 'node-cache';
import { v4 as uuidv4 } from 'uuid';

/**
 * VYENFITA AI Service
 * Main service for AI operations with caching, retry, and fallback support
 */
export class AIService {
  private provider: AIProvider;
  private config: ProviderConfig;
  private cache: NodeCache;
  private readonly providerType: string;
  private requestId: string;
  private startTime: number;

  constructor(providerType: string = 'openai') {
    this.providerType = providerType;
    const providerConfig = ProviderConfigManager.getConfig(providerType);
    this.config = providerConfig;
    this.provider = AIProviderFactory.getProvider(providerType, providerConfig);
    
    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.AI_CACHE_TTL || '3600'),
      maxKeys: parseInt(process.env.AI_CACHE_MAX_ITEMS || '1000'),
      checkperiod: 120,
    });

    this.requestId = uuidv4();
    this.startTime = Date.now();
  }

  /**
   * Get the current provider
   */
  getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * Get provider type
   */
  getProviderType(): string {
    return this.providerType;
  }

  /**
   * Switch to a different provider
   */
  switchProvider(providerType: string): void {
    const newConfig = ProviderConfigManager.getConfig(providerType);
    this.config = newConfig;
    this.provider = AIProviderFactory.getProvider(providerType, newConfig);
  }

  /**
   * Generate a chat completion with caching
   */
  async chat(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    this.requestId = uuidv4();
    this.startTime = Date.now();

    // Check cache if enabled
    const cacheKey = this.getCacheKey(params);
    if (process.env.AI_ENABLE_CACHING === 'true') {
      const cached = this.cache.get<ChatCompletionResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.provider.generateChatCompletion(params);
      
      // Cache the response
      if (process.env.AI_ENABLE_CACHING === 'true') {
        this.cache.set(cacheKey, response);
      }

      this.logRequest('chat', params, response);
      return response;
    } catch (error) {
      this.logError('chat', error);
      throw error;
    }
  }

  /**
   * Stream a chat completion
   */
  async *streamChat(params: ChatCompletionParams): AsyncIterable<StreamChunk> {
    this.requestId = uuidv4();
    this.startTime = Date.now();

    try {
      yield* this.provider.streamChatCompletion(params);
    } catch (error) {
      this.logError('stream', error);
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(params: any): Promise<any> {
    this.requestId = uuidv4();
    this.startTime = Date.now();

    try {
      const response = await this.provider.generateEmbeddings(params);
      this.logRequest('embeddings', params, response);
      return response;
    } catch (error) {
      this.logError('embeddings', error);
      throw error;
    }
  }

  /**
   * Check if the AI service is healthy
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const result = await this.provider.healthCheck();
      return {
        ...result,
        latency: Date.now() - this.startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.provider.name,
        version: this.provider.version,
        latency: Date.now() - this.startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get provider configuration
   */
  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.flushAll();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): any {
    return {
      keys: this.cache.keys(),
      stats: this.cache.getStats(),
    };
  }

  /**
   * Get available models from current provider
   */
  async getAvailableModels(): Promise<string[]> {
    return this.provider.getAvailableModels();
  }

  /**
   * Estimate tokens for a conversation
   */
  estimateTokens(messages: any[]): number {
    return this.provider.estimateTokens(messages);
  }

  /**
   * Generate a cache key for request
   */
  private getCacheKey(params: ChatCompletionParams): string {
    const key = {
      provider: this.providerType,
      model: params.model || this.config.model,
      messages: params.messages,
      temperature: params.temperature ?? this.config.temperature,
      maxTokens: params.maxTokens || this.config.maxTokens,
    };
    return Buffer.from(JSON.stringify(key)).toString('base64');
  }

  /**
   * Log successful request
   */
  private logRequest(type: string, params: any, response: any): void {
    const elapsed = Date.now() - this.startTime;
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      type,
      provider: this.provider.name,
      model: this.config.model,
      elapsed,
      tokens: response.usage?.totalTokens || 0,
      success: true,
    }));
  }

  /**
   * Log error
   */
  private logError(type: string, error: unknown): void {
    const elapsed = Date.now() - this.startTime;
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      type,
      provider: this.provider.name,
      elapsed,
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
    }));
  }
  }
