/**
 * VYENFITA Base Agent
 * 
 * Common functionality for all agents:
 * - Input validation
 * - Audit logging
 * - Metrics
 * - Error handling
 * - Approval gating
 * 
 * @version 1.0.0
 */

import { Agent, AgentTask, AgentResult, AgentContext, AgentCapability } from './agent.interface';
import { getAIService } from '../ai/ai.service';
import { auditService } from '../audit/audit.service';
import { getMetrics } from '../observability/metrics.service';
import { logger } from '../observability/logger';
import { randomUUID } from 'crypto';

export abstract class BaseAgent implements Agent {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly capabilities: AgentCapability[];

  protected ai = getAIService();

  /**
   * Execute the agent's task — subclasses implement `run()`
   */
  async execute<Input, Output>(
    task: AgentTask<Input, Output>
  ): Promise<AgentResult<Output>> {
    const startTime = Date.now();
    const requestId = task.context.requestId || randomUUID();
    const metrics = getMetrics();

    // Validate input
    const validation = this.validate(task.input);
    if (!validation.valid) {
      return {
        agent: this.name,
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        durationMs: Date.now() - startTime,
      };
    }

    // Audit start
    await auditService.log({
      tenantId: task.context.tenantId,
      userId: task.context.userId,
      eventType: 'system',
      action: `agent.${this.name}.start`,
      resource: 'agent',
      resourceId: requestId,
      ipAddress: task.context.ipAddress,
      userAgent: task.context.userAgent,
      details: {
        input: this.sanitizeInputForAudit(task.input),
      },
      status: 'success',
    });

    metrics.incrementCounter('vyenfita_agent_executions_total', {
      agent: this.name,
      tenant: task.context.tenantId,
    });

    try {
      // Run the agent
      const result = await this.run(task, requestId);

      const durationMs = Date.now() - startTime;

      // Audit success
      await auditService.log({
        tenantId: task.context.tenantId,
        userId: task.context.userId,
        eventType: 'system',
        action: `agent.${this.name}.success`,
        resource: 'agent',
        resourceId: requestId,
        details: {
          success: result.success,
          confidence: result.confidence,
          tokensUsed: result.tokensUsed,
          costUsd: result.costUsd,
        },
        status: result.success ? 'success' : 'failure',
        duration: durationMs,
      });

      metrics.observeHistogram(
        'vyenfita_agent_duration_ms',
        durationMs,
        { agent: this.name }
      );

      if (result.tokensUsed) {
        metrics.incrementCounter(
          'vyenfita_agent_tokens_total',
          { agent: this.name, tenant: task.context.tenantId },
          result.tokensUsed
        );
      }

      return {
        ...result,
        agent: this.name,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Agent failed';

      logger.error(`Agent ${this.name} failed`, {
        requestId,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });

      metrics.incrementCounter('vyenfita_agent_errors_total', {
        agent: this.name,
        tenant: task.context.tenantId,
      });

      // Audit failure
      await auditService.log({
        tenantId: task.context.tenantId,
        userId: task.context.userId,
        eventType: 'system',
        action: `agent.${this.name}.error`,
        resource: 'agent',
        resourceId: requestId,
        details: { error: message },
        status: 'error',
        duration: durationMs,
      });

      return {
        agent: this.name,
        success: false,
        error: message,
        durationMs,
      };
    }
  }

  /**
   * Subclasses implement this
   */
  protected abstract run<Input, Output>(
    task: AgentTask<Input, Output>,
    requestId: string
  ): Promise<Omit<AgentResult<Output>, 'agent' | 'durationMs'>>;

  /**
   * Default validation — subclasses override for custom validation
   */
  validate<Input>(input: Input): { valid: boolean; errors: string[] } {
    if (input === undefined || input === null) {
      return { valid: false, errors: ['Input is required'] };
    }
    return { valid: true, errors: [] };
  }

  /**
   * Check if this agent has a specific capability
   */
  hasCapability(capabilityName: string): boolean {
    return this.capabilities.some((c) => c.name === capabilityName);
  }

  /**
   * Check if this agent requires approval for a capability
   */
  requiresApproval(capabilityName: string): boolean {
    const capability = this.capabilities.find((c) => c.name === capabilityName);
    return capability?.requiresApproval ?? false;
  }

  /**
   * Sanitize input for audit log (remove secrets, truncate long fields)
   */
  protected sanitizeInputForAudit(input: any): any {
    if (typeof input !== 'object' || input === null) {
      return input;
    }

    const sanitized: any = {};
    const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'authorization', 'apikey', 'api_key'];

    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();

      if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '...[truncated]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Helper: call AI with audit
   */
  protected async callAI(
    systemPrompt: string,
    userPrompt: string,
    context: AgentContext,
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'text' | 'json';
    } = {}
  ): Promise<{ content: string; tokensUsed: number; costUsd: number }> {
    const response = await this.ai.complete(
      {
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: options.temperature ?? 0.3,
        maxTokens: options.maxTokens ?? 4096,
        responseFormat: options.responseFormat,
      },
      {
        tenantId: context.tenantId,
        userId: context.userId,
        operation: `agent_${this.name}`,
      }
    );

    // Estimate cost (rough)
    const costUsd =
      (response.usage.promptTokens / 1_000_000) * 10 +
      (response.usage.completionTokens / 1_000_000) * 30;

    return {
      content: response.content,
      tokensUsed: response.usage.totalTokens,
      costUsd,
    };
  }

  /**
   * Helper: extract JSON from AI response
   */
  protected extractJSON(content: string): any {
    // Direct parse
    try {
      return JSON.parse(content);
    } catch {}

    // Markdown code fence
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {}
    }

    // First { ... last }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } catch {}
    }

    throw new Error('No valid JSON found in AI response');
  }
        }
