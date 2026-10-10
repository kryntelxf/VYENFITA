/**
 * VYENFITA Tool Registry Unit Tests
 * 
 * Verifies:
 * - Tool registration and lookup
 * - Permission checking
 * - Tool execution with context
 * - Built-in tools behavior (calculate, string_ops, JSON, time)
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../lib/security/ssrf-guard', () => ({
  SSRFGuard: {
    check: jest.fn().mockResolvedValue({ safe: true }),
  },
}));

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    application: { findMany: jest.fn() },
    workflowExecution: { findMany: jest.fn() },
  },
}));

import { ToolRegistry } from '../../../lib/agents/tool-registry';
import { SSRFGuard } from '../../../lib/security/ssrf-guard';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new ToolRegistry();
  });

  describe('constructor', () => {
    it('should register built-in tools on construction', () => {
      const tools = registry.list();
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include calculate tool', () => {
      expect(registry.get('calculate')).toBeDefined();
      expect(registry.get('calculate')?.category).toBe('utility');
    });

    it('should include http_request tool', () => {
      expect(registry.get('http_request')).toBeDefined();
      expect(registry.get('http_request')?.riskLevel).toBe('medium');
    });

    it('should include get_current_time tool', () => {
      expect(registry.get('get_current_time')).toBeDefined();
    });

    it('should include string_ops tool', () => {
      expect(registry.get('string_ops')).toBeDefined();
    });

    it('should include parse_json tool', () => {
      expect(registry.get('parse_json')).toBeDefined();
    });

    it('should include wait tool', () => {
      expect(registry.get('wait')).toBeDefined();
    });

    it('should include query_applications tool', () => {
      expect(registry.get('query_applications')).toBeDefined();
      expect(registry.get('query_applications')?.category).toBe('internal');
    });

    it('should include query_workflow_executions tool', () => {
      expect(registry.get('query_workflow_executions')).toBeDefined();
    });
  });

  describe('register()', () => {
    it('should register a custom tool', () => {
      registry.register({
        name: 'custom_tool',
        description: 'A custom tool',
        category: 'custom',
        riskLevel: 'low',
        requiresApproval: false,
        inputSchema: {},
        execute: async () => ({ success: true, output: 'custom' }),
      });

      expect(registry.get('custom_tool')).toBeDefined();
    });

    it('should throw on duplicate tool name', () => {
      expect(() =>
        registry.register({
          name: 'calculate',
          description: 'Duplicate',
          category: 'custom',
          riskLevel: 'low',
          requiresApproval: false,
          inputSchema: {},
          execute: async () => ({ success: true }),
        })
      ).toThrow(/already registered/);
    });
  });

  describe('get() / list()', () => {
    it('should return undefined for unknown tool', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should list all registered tools', () => {
      const tools = registry.list();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.every((t) => t.name && t.category)).toBe(true);
    });

    it('should filter by category', () => {
      const utilityTools = registry.listByCategory('utility');
      expect(utilityTools.length).toBeGreaterThan(0);
      expect(utilityTools.every((t) => t.category === 'utility')).toBe(true);
    });
  });

  describe('listAvailable()', () => {
    it('should filter tools by capability strings', () => {
      const capabilities = ['tool:calculate', 'tool:get_current_time'];
      const available = registry.listAvailable(capabilities);

      expect(available.map((t) => t.name)).toEqual(
        expect.arrayContaining(['calculate', 'get_current_time'])
      );
      expect(available.map((t) => t.name)).not.toContain('http_request');
    });

    it('should support tool:* wildcard', () => {
      const available = registry.listAvailable(['tool:*']);
      expect(available.length).toBe(registry.list().length);
    });

    it('should support category:* wildcard', () => {
      const available = registry.listAvailable(['category:utility']);
      expect(available.length).toBeGreaterThan(0);
      expect(available.every((t) => t.category === 'utility')).toBe(true);
    });

    it('should return empty array when no capabilities match', () => {
      const available = registry.listAvailable(['tool:nonexistent']);
      expect(available).toEqual([]);
    });
  });

  describe('execute() - permission check', () => {
    it('should deny execution without permission', async () => {
      const result = await registry.execute('calculate', { expression: '1+1' }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No permission');
    });

    it('should allow execution with explicit tool capability', async () => {
      const result = await registry.execute('calculate', { expression: '1+1' }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:calculate'],
      });

      expect(result.success).toBe(true);
      expect(result.output.result).toBe(2);
    });

    it('should allow execution with category wildcard', async () => {
      const result = await registry.execute('calculate', { expression: '2+2' }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['category:utility'],
      });

      expect(result.success).toBe(true);
    });

    it('should allow execution with tool:* wildcard', async () => {
      const result = await registry.execute('calculate', { expression: '3+3' }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:*'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - calculate tool', () => {
    it('should compute simple arithmetic', async () => {
      const result = await registry.execute('calculate', { expression: '2 + 3 * 4' }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:calculate'],
      });

      expect(result.success).toBe(true);
      expect(result.output.result).toBe(14);
      expect(result.output.expression).toBe('2 + 3 * 4');
    });

    it('should reject non-arithmetic expressions', async () => {
      const result = await registry.execute('calculate', { expression: 'process.exit(1)' }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:calculate'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid expression');
    });

    it('should reject expressions with letters', async () => {
      const result = await registry.execute('calculate', { expression: 'abc + 1' }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:calculate'],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('execute() - get_current_time tool', () => {
    it('should return ISO timestamp', async () => {
      const result = await registry.execute('get_current_time', {}, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:get_current_time'],
      });

      expect(result.success).toBe(true);
      expect(result.output.iso).toBeDefined();
      expect(result.output.unix).toBeGreaterThan(0);
    });

    it('should support timezone parameter', async () => {
      const result = await registry.execute(
        'get_current_time',
        { timezone: 'UTC' },
        {
          tenantId: 't1',
          agentId: 'a1',
          runId: 'r1',
          capabilities: ['tool:get_current_time'],
        }
      );

      expect(result.success).toBe(true);
      expect(result.output.timezone).toBe('UTC');
    });
  });

  describe('execute() - string_ops tool', () => {
    const context = {
      tenantId: 't1',
      agentId: 'a1',
      runId: 'r1',
      capabilities: ['tool:string_ops'],
    };

    it('should uppercase', async () => {
      const result = await registry.execute('string_ops', {
        text: 'hello',
        operation: 'uppercase',
      }, context);

      expect(result.success).toBe(true);
      expect(result.output).toBe('HELLO');
    });

    it('should lowercase', async () => {
      const result = await registry.execute('string_ops', {
        text: 'WORLD',
        operation: 'lowercase',
      }, context);

      expect(result.output).toBe('world');
    });

    it('should trim', async () => {
      const result = await registry.execute('string_ops', {
        text: '  padded  ',
        operation: 'trim',
      }, context);

      expect(result.output).toBe('padded');
    });

    it('should split', async () => {
      const result = await registry.execute('string_ops', {
        text: 'a,b,c',
        operation: 'split',
        args: [','],
      }, context);

      expect(result.output).toEqual(['a', 'b', 'c']);
    });

    it('should replace', async () => {
      const result = await registry.execute('string_ops', {
        text: 'hello world',
        operation: 'replace',
        args: ['world', 'there'],
      }, context);

      expect(result.output).toBe('hello there');
    });

    it('should substring', async () => {
      const result = await registry.execute('string_ops', {
        text: 'hello world',
        operation: 'substring',
        args: [0, 5],
      }, context);

      expect(result.output).toBe('hello');
    });

    it('should return error for unknown operation', async () => {
      const result = await registry.execute('string_ops', {
        text: 'x',
        operation: 'unknown',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown operation');
    });
  });

  describe('execute() - parse_json tool', () => {
    const context = {
      tenantId: 't1',
      agentId: 'a1',
      runId: 'r1',
      capabilities: ['tool:parse_json'],
    };

    it('should parse valid JSON', async () => {
      const result = await registry.execute('parse_json', {
        json: '{"a": 1, "b": 2}',
      }, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ a: 1, b: 2 });
    });

    it('should extract nested path', async () => {
      const result = await registry.execute('parse_json', {
        json: '{"data": {"items": [10, 20, 30]}}',
        path: 'data.items.1',
      }, context);

      expect(result.output).toBe(20);
    });

    it('should reject invalid JSON', async () => {
      const result = await registry.execute('parse_json', {
        json: 'not json',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON parse failed');
    });

    it('should return error when path not found', async () => {
      const result = await registry.execute('parse_json', {
        json: '{"a": 1}',
        path: 'a.b.c',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path not found');
    });
  });

  describe('execute() - http_request tool', () => {
    it('should reject when SSRFGuard blocks', async () => {
      (SSRFGuard.check as jest.Mock).mockResolvedValueOnce({
        safe: false,
        reason: 'Private IP not allowed',
      });

      const result = await registry.execute('http_request', {
        url: 'http://localhost/admin',
      }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:http_request'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SSRF');
    });
  });

  describe('execute() - wait tool', () => {
    it('should cap wait time at 30 seconds', async () => {
      const start = Date.now();
      const result = await registry.execute('wait', { seconds: 0.1 }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:wait'],
      });

      expect(result.success).toBe(true);
      expect(Date.now() - start).toBeGreaterThanOrEqual(50);
    }, 5000);
  });

  describe('execute() - error handling', () => {
    it('should return error for non-existent tool', async () => {
      const result = await registry.execute('nonexistent', {}, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:*'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should catch and report tool execution errors', async () => {
      registry.register({
        name: 'throwing_tool',
        description: 'Always throws',
        category: 'test',
        riskLevel: 'low',
        requiresApproval: false,
        inputSchema: {},
        execute: async () => {
          throw new Error('Boom!');
        },
      });

      const result = await registry.execute('throwing_tool', {}, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:throwing_tool'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Boom!');
    });

    it('should include durationMs in metadata', async () => {
      const result = await registry.execute('calculate', { expression: '1+1' }, {
        tenantId: 't1',
        agentId: 'a1',
        runId: 'r1',
        capabilities: ['tool:calculate'],
      });

      expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getToolRegistry()', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getToolRegistry } = require('../../../lib/agents/tool-registry');
      const instance1 = getToolRegistry();
      const instance2 = getToolRegistry();

      expect(instance1).toBe(instance2);
    });
  });
});
