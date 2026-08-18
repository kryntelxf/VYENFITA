import { AIProviderFactory } from '../providers/provider-factory';
import {
  AIProvider,
  ChatCompletionParams,
  ChatCompletionResponse,
  ProviderConfig,
} from '../interfaces/ai-provider.interface';
import { ProviderConfigManager } from '../../config/providers.config';

/**
 * VYENFITA AI Service
 * Main service for AI operations
 */
export class AIService {
  private provider: AIProvider;
  private config: ProviderConfig;

  constructor(providerType: string = 'openai') {
    const providerConfig = ProviderConfigManager.getConfig(providerType);
    this.config = providerConfig;
    this.provider = AIProviderFactory.getProvider(providerType, providerConfig);
  }

  /**
   * Get the current provider
   */
  getProvider(): AIProvider {
    return this.provider;
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
   * Generate a chat completion
   */
  async chat(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    try {
      return await this.provider.generateChatCompletion(params);
    } catch (error) {
      // TODO: Add retry logic with fallback providers
      throw error;
    }
  }

  /**
   * Check if the AI service is healthy
   */
  async healthCheck(): Promise<boolean> {
    return await this.provider.healthCheck();
  }

  /**
   * Get provider configuration
   */
  getConfig(): ProviderConfig {
    return this.config;
  }
    }
