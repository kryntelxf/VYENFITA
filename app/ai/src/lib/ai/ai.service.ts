/**
 * VYENFITA AI Service
 * 
 * Production-grade AI service with:
 * - Provider abstraction
 * - Circuit breaker
 * - Retry with exponential backoff
 * - Token accounting
 * - Cost tracking
 * - Audit logging
 * - Prompt injection detection
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { CircuitBreaker } from './circuit-breaker';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  AITimeoutError,
  AIRateLimitError,
} from './provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface AIRequestContext {
  tenantId: string;
  userId?: string;
  operation: string;
  requestId?: string;
}

export interface AIServiceConfig {
  primaryProvider: 'openai' | 'anthropic';
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
}

// Approximate pricing (USD per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4-turbo-preview': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'claude-3-sonnet-20240229': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
};

export class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private config: AIServiceConfig;

  constructor(config?: Partial<AIServiceConfig>) {
    this.config = {
      primaryProvider: (process.env.AI_PROVIDER as any) || 'openai',
      maxRetries: parseInt(process.env.AI_RETRY_ATTEMPTS || '3', 10),
      initialBackoffMs: parseInt(process.env.AI_RETRY_BACKOFF_MS || '1000', 10),
      maxBackoffMs: 30000,
      ...config,
    };

    this.initializeProviders();
    this.initializeCircuitBreakers();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Complete a request with fallback support
   */
  async complete(
    request: AICompletionRequest,
    context: AIRequestContext
  ): Promise<AICompletionResponse> {
    const startTime = Date.now();
    const requestId = context.requestId || this.generateRequestId();

    // Prompt injection detection
    const injectionCheck = this.detectPromptInjection(request);
    if (injectionCheck.suspicious) {
      logger.warn('Potential prompt injection detected', {
        requestId,
        tenantId: context.tenantId,
        reason: injectionCheck.reason,
      });

      await auditService.log({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'security',
        action: 'prompt_injection_detected',
        resource: 'ai_request',
        resourceId: requestId,
        details: { reason: injectionCheck.reason },
        status: 'failure',
      });
    }

    // Try primary provider
    const providers = this.getProviderOrder();

    let lastError: AIProviderError | undefined;
    for (const providerName of providers) {
      const circuit = this.circuitBreakers.get(providerName)!;

      if (!circuit.canAttempt()) {
        logger.warn(`Circuit breaker OPEN for ${providerName}, skipping`, { requestId });
        continue;
      }

      try {
        const result = await this.executeWithRetry(
          providerName,
          request,
          context,
          requestId
        );

        circuit.recordSuccess();

        // Track usage & cost
        await this.trackUsage(context, result, requestId);

        return result;
      } catch (error) {
        const providerError = error as AIProviderError;
        circuit.recordFailure();
        lastError = providerError;

        logger.warn(`Provider ${providerName} failed`, {
          requestId,
          provider: providerName,
          code: providerError.code,
          message: providerError.message,
        });

        // If not retryable across providers, break
        if (!providerError.retryable && providerError.code === 'AUTH_ERROR') {
          break;
        }
      }
    }

    // All providers failed
    const totalLatencyMs = Date.now() - startTime;

    await auditService.log({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'system',
      action: 'ai_request_failed',
      resource: 'ai_request',
      resourceId: requestId,
      details: {
        operation: context.operation,
        error: lastError?.message,
        code: lastError?.code,
        latencyMs: totalLatencyMs,
      },
      status: 'error',
      duration: totalLatencyMs,
    });

    throw lastError || new Error('All AI providers failed');
  }

  /**
   * Get provider health status
   */
  async healthCheck(): Promise<{
    providers: Record<string, { healthy: boolean; latencyMs: number; circuit: string }>;
    overall: boolean;
  }> {
    const results: Record<string, any> = {};
    let allHealthy = true;

    for (const [name, provider] of this.providers) {
      const health = await provider.healthCheck();
      const circuit = this.circuitBreakers.get(name);

      results[name] = {
        healthy: health.healthy,
        latencyMs: health.latencyMs,
        circuit: circuit?.getState() || 'UNKNOWN',
      };

      if (!health.healthy || circuit?.getState() === 'OPEN') {
        allHealthy = false;
      }
    }

    return { providers: results, overall: allHealthy };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private initializeProviders(): void {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        defaultModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        timeoutMs: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
      }));
      logger.info('OpenAI provider initialized');
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        defaultModel: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
        timeoutMs: parseInt(process.env.ANTHROPIC_TIMEOUT || '60000', 10),
      }));
      logger.info('Anthropic provider initialized');
    }

    if (this.providers.size === 0) {
      throw new Error('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }
  }

  private initializeCircuitBreakers(): void {
    for (const name of this.providers.keys()) {
      this.circuitBreakers.set(name, new CircuitBreaker(name, {
        failureThreshold: parseInt(process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10),
        successThreshold: 2,
        timeoutMs: parseInt(process.env.AI_CIRCUIT_BREAKER_TIMEOUT_MS || '30000', 10),
      }));
    }
  }

  private getProviderOrder(): string[] {
    const order = [this.config.primaryProvider];
    for (const name of this.providers.keys()) {
      if (name !== this.config.primaryProvider) {
        order.push(name);
      }
    }
    return order.filter((name) => this.providers.has(name));
  }

  private async executeWithRetry(
    providerName: string,
    request: AICompletionRequest,
    context: AIRequestContext,
    requestId: string
  ): Promise<AICompletionResponse> {
    const provider = this.providers.get(providerName)!;
    let lastError: AIProviderError | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.debug(`AI request attempt ${attempt}`, {
          requestId,
          provider: providerName,
          operation: context.operation,
        });

        return await provider.complete(request);
      } catch (error) {
        const providerError = error as AIProviderError;
        lastError = providerError;

        // Non-retryable errors fail immediately
        if (!providerError.retryable) {
          throw providerError;
        }

        if (attempt === this.config.maxRetries) {
          throw providerError;
        }

        // Exponential backoff
        const backoffMs = Math.min(
          this.config.initialBackoffMs * Math.pow(2, attempt - 1),
          this.config.maxBackoffMs
        );

        logger.warn(`Retrying after ${backoffMs}ms`, {
          requestId,
          provider: providerName,
          attempt,
          error: providerError.code,
        });

        await this.sleep(backoffMs);
      }
    }

    throw lastError!;
  }

  private async trackUsage(
    context: AIRequestContext,
    response: AICompletionResponse,
    requestId: string
  ): Promise<void> {
    try {
      // Calculate cost
      const pricing = PRICING[response.model] || { input: 0, output: 0 };
      const inputCost = (response.usage.promptTokens / 1_000_000) * pricing.input;
      const outputCost = (response.usage.completionTokens / 1_000_000) * pricing.output;
      const totalCost = inputCost + outputCost;

      // Record usage
      const usageRecord = await prisma.usageRecord.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          service: response.provider,
          operation: context.operation,
          quantity: response.usage.totalTokens,
          unit: 'tokens',
          model: response.model,
          provider: response.provider,
          metadata: {
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            latencyMs: response.latencyMs,
            requestId,
          },
        },
      });

      // Record cost
      await prisma.costRecord.create({
        data: {
          tenantId: context.tenantId,
          usageRecordId: usageRecord.id,
          service: response.provider,
          description: `${context.operation} - ${response.model}`,
          quantity: response.usage.totalTokens,
          unitCost: totalCost / (response.usage.totalTokens || 1),
          totalCost,
          currency: 'USD',
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });

      // Audit log
      await auditService.log({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'system',
        action: 'ai_request_success',
        resource: 'ai_request',
        resourceId: requestId,
        details: {
          operation: context.operation,
          provider: response.provider,
          model: response.model,
          tokens: response.usage.totalTokens,
          cost: totalCost,
          latencyMs: response.latencyMs,
        },
        status: 'success',
        duration: response.latencyMs,
      });
    } catch (error) {
      // Usage tracking should never break the main flow
      logger.error('Failed to track AI usage', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private detectPromptInjection(request: AICompletionRequest): {
    suspicious: boolean;
    reason?: string;
  } {
    const patterns = [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /disregard\s+(all\s+)?previous/i,
      /system\s*:\s*you\s+are/i,
      /forget\s+(everything|all)/i,
      /new\s+instructions/i,
    ];

    for (const msg of request.messages) {
      if (msg.role === 'user') {
        for (const pattern of patterns) {
          if (pattern.test(msg.content)) {
            return { suspicious: true, reason: `Pattern: ${pattern.source}` };
          }
        }
      }
    }

    return { suspicious: false };
  }

  private generateRequestId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton
let aiServiceInstance: AIService | undefined;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
  }
