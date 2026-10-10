/**
 * VYENFITA Agent Executor Unit Tests
 * 
 * Verifies:
 * - ReAct loop with mocked AI
 * - Tool execution flow
 * - Approval triggering
 * - Max step limiting
 * - Response parsing
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    agentRun: {
      create: jest.fn(),
      update: jest.fn(),
    },
    agentStep: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/ai/ai.service', () => ({
  getAIService: jest.fn(),
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

jest.mock('../../../lib/agents/tool-registry', () => ({
  getToolRegistry: jest.fn(() => ({
    get: jest.fn((name) => ({
      name,
      category: 'utility',
      riskLevel: 'low',
      requiresApproval: false,
    })),
    listAvailable: jest.fn(() => [
      { name: 'calculate', description: 'Calc', category: 'utility', riskLevel: 'low' },
    ]),
    execute: jest.fn().mockResolvedValue({ success: true, output: { result: 42 } }),
  })),
}));

import { AgentExecutor } from '../../../lib/agents/agent-executor';
import { getAIService } from '../../../lib/ai/ai.service';
import { prisma } from '../../../lib/database/client';
import {
  AgentDefinition,
  AgentApprovalRequiredError,
} from '../../../lib/agents/agent.types';

const mockPrisma = prisma as any;

describe('AgentExecutor', () => {
  const mockAgent: AgentDefinition = {
    id: 'agent-1',
    tenantId: 'tenant-1',
    name: 'Test Agent',
    description: 'Test',
    category: 'custom',
    systemPrompt: 'You are a test agent.',
    model: 'gpt-4',
    temperature: 0.3,
    maxSteps: 5,
    maxTokensPerRun: 100000,
    maxDurationSeconds: 300,
    allowedTools: ['calculate'],
    capabilities: [
      { name: 'tool:calculate', riskLevel: 'low', requiresApproval: false },
    ],
    requiresApproval: true,
    approvalThreshold: 'high',
    triggers: [],
    status: 'active',
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockAI: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAI = { complete: jest.fn() };
    (getAIService as jest.Mock).mockReturnValue(mockAI);

    mockPrisma.agentRun.create.mockResolvedValue({
      id: 'run-1',
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      status: 'running',
      totalTokens: 0,
      totalCostUsd: 0,
      toolCalls: 0,
      startedAt: new Date(),
      currentStepIndex: 0,
      metadata: {},
    });
    mockPrisma.agentRun.update.mockResolvedValue({});
    mockPrisma.agentStep.create.mockResolvedValue({});
  });

  describe('execute() - final answer', () => {
    it('should return final answer from single AI call', async () => {
      mockAI.complete.mockResolvedValue({
        content: 'THOUGHT: The task is simple.\nFINAL: The answer is 42.',
        usage: { totalTokens: 100, promptTokens: 80, completionTokens: 20 },
      });

      const result = await AgentExecutor.execute(mockAgent, {
        objective: 'Answer the question',
      });

      expect(result.status).toBe('completed');
      expect(result.output?.result).toContain('42');
      expect(result.output?.reasoning).toContain('simple');
    });

    it('should persist run as completed', async () => {
      mockAI.complete.mockResolvedValue({
        content: 'THOUGHT: Done.\nFINAL: Result.',
        usage: { totalTokens: 50, promptTokens: 40, completionTokens: 10 },
      });

      await AgentExecutor.execute(mockAgent, { objective: 'Test' });

      expect(mockPrisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: 'completed',
        }),
      });
    });

    it('should track token usage', async () => {
      mockAI.complete.mockResolvedValue({
        content: 'THOUGHT: Done.\nFINAL: OK',
        usage: { totalTokens: 500, promptTokens: 400, completionTokens: 100 },
      });

      await AgentExecutor.execute(mockAgent, { objective: 'Test' });

      const updateCalls = mockPrisma.agentRun.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
    });
  });

  describe('execute() - tool call', () => {
    it('should execute tool and continue loop', async () => {
      mockAI.complete
        .mockResolvedValueOnce({
          content: 'THOUGHT: I need to calculate.\nACTION: calculate\nINPUT: {"expression": "6*7"}',
          usage: { totalTokens: 100, promptTokens: 80, completionTokens: 20 },
        })
        .mockResolvedValueOnce({
          content: 'THOUGHT: Got the result.\nFINAL: 42',
          usage: { totalTokens: 50, promptTokens: 40, completionTokens: 10 },
        });

      const result = await AgentExecutor.execute(mockAgent, {
        objective: 'Calculate 6*7',
      });

      expect(result.status).toBe('completed');
      expect(result.output?.actions.length).toBeGreaterThan(0);
      expect(result.output?.actions[0].toolName).toBe('calculate');
    });
  });

  describe('execute() - approval required', () => {
    it('should throw AgentApprovalRequiredError when agent requests approval', async () => {
      mockAI.complete.mockResolvedValueOnce({
        content: 'THOUGHT: This action is risky.\nREQUIRES_APPROVAL: Need to delete database',
        usage: { totalTokens: 100, promptTokens: 80, completionTokens: 20 },
      });

      await expect(
        AgentExecutor.execute(mockAgent, { objective: 'Delete stuff' })
      ).rejects.toThrow(AgentApprovalRequiredError);
    });

    it('should mark run as waiting_approval', async () => {
      mockAI.complete.mockResolvedValueOnce({
        content: 'THOUGHT: Risky.\nREQUIRES_APPROVAL: Reason',
        usage: { totalTokens: 50, promptTokens: 40, completionTokens: 10 },
      });

      try {
        await AgentExecutor.execute(mockAgent, { objective: 'Test' });
      } catch {
        // Expected
      }

      expect(mockPrisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'waiting_approval' },
      });
    });
  });

  describe('execute() - max steps', () => {
    it('should stop at maxSteps and return partial result', async () => {
      const smallAgent = { ...mockAgent, maxSteps: 2 };

      mockAI.complete.mockResolvedValue({
        content: 'THOUGHT: thinking\nACTION: calculate\nINPUT: {}',
        usage: { totalTokens: 50, promptTokens: 40, completionTokens: 10 },
      });

      const result = await AgentExecutor.execute(smallAgent, { objective: 'Test' });

      expect(result.status).toBe('completed');
      expect(result.output?.result).toContain('Max steps');
      expect(result.output?.confidence).toBeLessThan(0.5);
    });
  });

  describe('execute() - error handling', () => {
    it('should mark run as failed on unexpected error', async () => {
      mockAI.complete.mockRejectedValue(new Error('AI service down'));

      await expect(
        AgentExecutor.execute(mockAgent, { objective: 'Test' })
      ).rejects.toThrow('AI service down');

      expect(mockPrisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: 'failed',
          error: 'AI service down',
        }),
      });
    });
  });

  describe('extractSection()', () => {
    it('should extract THOUGHT section', () => {
      const content = 'THOUGHT: thinking here\nACTION: do_something';
      const extracted = (AgentExecutor as any).extractSection(content, 'THOUGHT');
      expect(extracted).toBe('thinking here');
    });

    it('should extract FINAL section', () => {
      const content = 'THOUGHT: done\nFINAL: my answer';
      const extracted = (AgentExecutor as any).extractSection(content, 'FINAL');
      expect(extracted).toBe('my answer');
    });

    it('should return undefined when section not found', () => {
      const content = 'Nothing relevant';
      const extracted = (AgentExecutor as any).extractSection(content, 'THOUGHT');
      expect(extracted).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const content = 'thought: lower case\nfinal: answer';
      expect((AgentExecutor as any).extractSection(content, 'THOUGHT')).toBeDefined();
      expect((AgentExecutor as any).extractSection(content, 'FINAL')).toBeDefined();
    });
  });
});
