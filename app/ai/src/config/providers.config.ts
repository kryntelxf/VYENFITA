import { ProviderConfig } from '../core/interfaces/ai-provider.interface';

/**
 * Provider Configuration Manager
 * Manages AI provider configurations from environment variables
 */
export class ProviderConfigManager {
  private static configs: Map<string, ProviderConfig> = new Map();

  /**
   * Initialize configurations from environment
   */
  static initialize(): void {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.configs.set('openai', {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
        baseURL: process.env.OPENAI_BASE_URL,
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000'),
      });
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.configs.set('anthropic', {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
        maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
        baseURL: process.env.ANTHROPIC_BASE_URL,
        timeout: parseInt(process.env.ANTHROPIC_TIMEOUT || '60000'),
      });
    }

    // Default OpenAI config if no API key provided
    if (!this.configs.has('openai') && !this.configs.has('anthropic')) {
      // This will fail gracefully with a clear error
      console.warn('No AI provider configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
    }
  }

  /**
   * Get provider configuration
   */
  static getConfig(providerType: string): ProviderConfig {
    const config = this.configs.get(providerType);
    if (!config) {
      throw new Error(
        `Provider "${providerType}" not configured. ` +
        `Available providers: ${Array.from(this.configs.keys()).join(', ')}`
      );
    }
    return config;
  }

  /**
   * Get all configured providers
   */
  static getConfiguredProviders(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Check if a provider is configured
   */
  static isConfigured(providerType: string): boolean {
    return this.configs.has(providerType);
  }
}

// Initialize configurations
ProviderConfigManager.initialize();
