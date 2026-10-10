/**
 * VYENFITA Base Agent Unit Tests
 * 
 * Verifies:
 * - Default validation behavior
 * - Capability checks
 * - Sanitization of audit input
 * - JSON extraction from AI responses
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/ai/ai.service', () => ({
  getAIService: jest.fn(() => ({ complete: jest.fn() })),
}));

jest.mock('../../../lib/audit/audit.service', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../lib/observability/metrics.service', () => ({
  getMetrics: jest.fn(() => ({
    incrementCounter: jest.fn(),
    observeHistogram: jest.fn(),
  })),
}));

import { BaseAgent } from '../../../lib/agents/base.agent';
import { AgentCapability, AgentTask } from '../../../lib/agents/agent.interface';

class TestAgent extends BaseAgent {
  readonly name = 'test-agent';
  readonly description = 'A test agent';
  readonly capabilities: AgentCapability[] = [
    { name: 'read_data', description: 'Read data', destructive: false, requiresApproval: false },
    { name: 'write_data', description: 'Write data', destructive: true, requiresApproval: true },
  ];

  protected async run(task: AgentTask<any, any>) {
    return {
      success: true,
      output: { processed: task.input },
      confidence: 0.9,
    };
  }
}

class FailingAgent extends BaseAgent {
  readonly name = 'failing-agent';
  readonly description = 'Fails always';
  readonly capabilities: AgentCapability[] = [];

  protected async run(): Promise<any> {
    throw new Error('Simulated failure');
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  describe('validate()', () => {
    it('should return valid for non-null input', () => {
      const result = agent.validate({ data: 'test' });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject null input', () => {
      const result = agent.validate(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject undefined input', () => {
      const result = agent.validate(undefined);
      expect(result.valid).toBe(false);
    });
  });

  describe('hasCapability()', () => {
    it('should return true for declared capability', () => {
      expect(agent.hasCapability('read_data')).toBe(true);
      expect(agent.hasCapability('write_data')).toBe(true);
    });

    it('should return false for undeclared capability', () => {
      expect(agent.hasCapability('execute_shell')).toBe(false);
    });
  });

  describe('requiresApproval()', () => {
    it('should return true for approval-required capability', () => {
      expect(agent.requiresApproval('write_data')).toBe(true);
    });

    it('should return false for non-approval capability', () => {
      expect(agent.requiresApproval('read_data')).toBe(false);
    });

    it('should return false for unknown capability', () => {
      expect(agent.requiresApproval('unknown')).toBe(false);
    });
  });

  describe('execute()', () => {
    const task: AgentTask<any, any> = {
      agent: 'test-agent',
      input: { data: 'value' },
      context: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        requestId: 'req-1',
      },
    };

    it('should return success result on normal execution', async () => {
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.agent).toBe('test-agent');
      expect(result.output).toEqual({ processed: { data: 'value' } });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should reject invalid input', async () => {
      const result = await agent.execute({
        ...task,
        input: null,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation');
    });

    it('should catch and report errors from run()', async () => {
      const failing = new FailingAgent();
      const result = await failing.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Simulated failure');
    });
  });

  describe('sanitizeInputForAudit()', () => {
    it('should redact password fields', () => {
      const sanitized = (agent as any).sanitizeInputForAudit({
        username: 'test',
        password: 'secret123',
      });

      expect(sanitized.username).toBe('test');
      expect(sanitized.password).toBe('[REDACTED]');
    });

    it('should redact token fields', () => {
      const sanitized = (agent as any).sanitizeInputForAudit({
        accessToken: 'eyJhbGci...',
        refreshToken: 'abc',
      });

      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
    });

    it('should redact apiKey fields', () => {
      const sanitized = (agent as any).sanitizeInputForAudit({
        apiKey: 'sk-12345',
        api_key: 'sk-67890',
      });

      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
    });

    it('should truncate long string values', () => {
      const longString = 'a'.repeat(1000);
      const sanitized = (agent as any).sanitizeInputForAudit({
        description: longString,
      });

      expect(sanitized.description.length).toBeLessThan(600);
      expect(sanitized.description).toContain('[truncated]');
    });

    it('should pass through non-sensitive values', () => {
      const sanitized = (agent as any).sanitizeInputForAudit({
        name: 'test',
        count: 42,
        active: true,
      });

      expect(sanitized.name).toBe('test');
      expect(sanitized.count).toBe(42);
      expect(sanitized.active).toBe(true);
    });

    it('should return primitive input as-is', () => {
      expect((agent as any).sanitizeInputForAudit('string')).toBe('string');
      expect((agent as any).sanitizeInputForAudit(42)).toBe(42);
      expect((agent as any).sanitizeInputForAudit(null)).toBe(null);
    });
  });

  describe('extractJSON()', () => {
    it('should parse valid JSON directly', () => {
      const result = (agent as any).extractJSON('{"a": 1, "b": 2}');
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should extract from markdown code fence', () => {
      const result = (agent as any).extractJSON('```json\n{"a": 1}\n```');
      expect(result).toEqual({ a: 1 });
    });

    it('should extract from code fence without language', () => {
      const result = (agent as any).extractJSON('```\n{"a": 1}\n```');
      expect(result).toEqual({ a: 1 });
    });

    it('should extract first JSON object from mixed text', () => {
      const result = (agent as any).extractJSON(
        'Here is the result: {"a": 1} and more text'
      );
      expect(result).toEqual({ a: 1 });
    });

    it('should throw on no valid JSON', () => {
      expect(() => (agent as any).extractJSON('no json here')).toThrow(
        /No valid JSON/
      );
    });

    it('should handle nested braces', () => {
      const result = (agent as any).extractJSON('{"outer": {"inner": 1}}');
      expect(result).toEqual({ outer: { inner: 1 } });
    });
  });
});
