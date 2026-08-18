import { AIProvider } from '../interfaces/ai-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { ProviderConfig } from '../interfaces/ai-provider.interface';

/**
 * AI Provider Factory
 * Creates and manages AI provider instances
 */
export class AIProviderFactory {
  private static instances: Map<string, AIProvider> = new Map();

  /**
   * Create or get an AI provider instance
   */
  static getProvider(type: string, config: ProviderConfig): AIProvider {
    const key = `${type}:${config.model}`;
    
    if (this.instances.has(key)) {
      return this.instances.get(key)!;
    }

    let provider: AIProvider;

    switch (type.toLowerCase()) {
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'anthropic':
        provider = new AnthropicProvider(config);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${type}`);
    }

    this.instances.set(key, provider);
    return provider;
  }

  /**
   * Clear all cached provider instances
   */
  static clearCache(): void {
    this.instances.clear();
  }

  /**
   * Remove a specific provider from cache
   */
  static removeProvider(type: string, model: string): void {
    const key = `${type}:${model}`;
    this.instances.delete(key);
  }
}
