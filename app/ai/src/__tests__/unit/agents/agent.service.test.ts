/**
 * VYENFITA Agent Service Unit Tests
 * 
 * Verifies:
 * - CRUD operations with mocked prisma
 * - Tenant isolation on getById
 * - Status transitions (pause/resume/delete)
 * - Run orchestration with mocked executor
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    agent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    agentRun: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    agentStep: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/audit/audit.service', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../lib/agents/agent-executor', () => ({
  AgentExecutor: {
    execute: jest.fn().mockResolvedValue({
      id: 'run-1',
      status: 'completed',
      output: { result: 'done' },
    }),
  },
}));

import { AgentService } from '../../../lib/agents/agent.service';
import { AgentNotFoundError, AgentError } from '../../../lib/agents/agent.types';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('AgentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create agent with default values', async () => {
      const mockAgent = {
        id: 'agent-1',
        tenantId: 'tenant-1',
        name: 'Test Agent',
        description: 'Test description',
        systemPrompt: 'You are helpful',
        model: 'gpt-4-turbo-preview',
        temperature: 0.3,
        maxSteps: 20,
        status: 'active',
      };
      (mockPrisma.agent.create as jest.Mock).mockResolvedValue(mockAgent);

      const result = await AgentService.create({
        tenantId: 'tenant-1',
        userId: 'user-1',
        name: 'Test Agent',
        description: 'Test description',
        systemPrompt: 'You are helpful',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.agent.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getById()', () => {
    it('should return agent when found', async () => {
      const mockAgent = { id: 'agent-1', tenantId: 'tenant-1', name: 'Test' };
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue(mockAgent);

      const result = await AgentService.getById('agent-1', 'tenant-1');
      expect(result.id).toBe('agent-1');
    });

    it('should throw AgentNotFoundError when not found', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(AgentService.getById('missing', 'tenant-1')).rejects.toThrow(
        AgentNotFoundError
      );
    });

    it('should enforce tenant isolation', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(AgentService.getById('agent-1', 'other-tenant')).rejects.toThrow(
        'not found'
      );

      expect(mockPrisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-1', tenantId: 'other-tenant', deletedAt: null },
      });
    });
  });

  describe('list()', () => {
    it('should list agents for tenant', async () => {
      (mockPrisma.agent.findMany as jest.Mock).mockResolvedValue([
        { id: 'agent-1', name: 'A' },
        { id: 'agent-2', name: 'B' },
      ]);

      const result = await AgentService.list('tenant-1');
      expect(result.length).toBe(2);
    });

    it('should filter by status', async () => {
      (mockPrisma.agent.findMany as jest.Mock).mockResolvedValue([]);

      await AgentService.list('tenant-1', 'paused');

      expect(mockPrisma.agent.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', deletedAt: null, status: 'paused' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('update()', () => {
    it('should update agent fields', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        tenantId: 'tenant-1',
      });
      (mockPrisma.agent.update as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        name: 'Updated',
      });

      const result = await AgentService.update('agent-1', 'tenant-1', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('should throw when agent not found', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        AgentService.update('missing', 'tenant-1', { name: 'X' })
      ).rejects.toThrow(AgentNotFoundError);
    });
  });

  describe('delete()', () => {
    it('should soft delete agent', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        tenantId: 'tenant-1',
      });
      (mockPrisma.agent.update as jest.Mock).mockResolvedValue({});

      await AgentService.delete('agent-1', 'tenant-1');

      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: expect.objectContaining({ status: 'archived' }),
      });
    });

    it('should throw when agent not found', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(AgentService.delete('missing', 'tenant-1')).rejects.toThrow(
        AgentNotFoundError
      );
    });
  });

  describe('pause() / resume()', () => {
    it('should pause an active agent', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        tenantId: 'tenant-1',
      });
      (mockPrisma.agent.update as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        status: 'paused',
      });

      await AgentService.pause('agent-1', 'tenant-1');

      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { status: 'paused' },
      });
    });

    it('should resume a paused agent', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        tenantId: 'tenant-1',
      });
      (mockPrisma.agent.update as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        status: 'active',
      });

      await AgentService.resume('agent-1', 'tenant-1');

      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { status: 'active' },
      });
    });
  });

  describe('run()', () => {
    it('should throw if agent is not active', async () => {
      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        tenantId: 'tenant-1',
        status: 'paused',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        systemPrompt: 'Test',
        model: 'gpt-4',
        temperature: 0.3,
        maxSteps: 5,
        maxTokensPerRun: 1000,
        maxDurationSeconds: 60,
        allowedTools: [],
        capabilities: [],
        requiresApproval: true,
        approvalThreshold: 'high',
        triggers: [],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        AgentService.run('agent-1', 'tenant-1', { objective: 'Test' })
      ).rejects.toThrow(AgentError);
    });

    it('should delegate to AgentExecutor when active', async () => {
      const { AgentExecutor } = require('../../../lib/agents/agent-executor');

      (mockPrisma.agent.findFirst as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        tenantId: 'tenant-1',
        name: 'Test Agent',
        description: 'Test',
        category: 'custom',
        systemPrompt: 'Test',
        model: 'gpt-4',
        temperature: 0.3,
        maxSteps: 5,
        maxTokensPerRun: 1000,
        maxDurationSeconds: 60,
        allowedTools: [],
        capabilities: [],
        requiresApproval: true,
        approvalThreshold: 'high',
        triggers: [],
        status: 'active',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await AgentService.run('agent-1', 'tenant-1', {
        objective: 'Test',
      });

      expect(AgentExecutor.execute).toHaveBeenCalled();
      expect(result.status).toBe('completed');
    });
  });

  describe('listRuns()', () => {
    it('should list runs with limit', async () => {
      (mockPrisma.agentRun.findMany as jest.Mock).mockResolvedValue([]);

      await AgentService.listRuns('agent-1', 'tenant-1', 10);

      expect(mockPrisma.agentRun.findMany).toHaveBeenCalledWith({
        where: { agentId: 'agent-1', tenantId: 'tenant-1' },
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: expect.any(Object),
      });
    });

    it('should cap limit at 200', async () => {
      (mockPrisma.agentRun.findMany as jest.Mock).mockResolvedValue([]);

      await AgentService.listRuns('agent-1', 'tenant-1', 5000);

      expect(mockPrisma.agentRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 })
      );
    });
  });

  describe('getRun()', () => {
    it('should return run details', async () => {
      const mockRun = { id: 'run-1', agentId: 'agent-1', status: 'completed' };
      (mockPrisma.agentRun.findFirst as jest.Mock).mockResolvedValue(mockRun);

      const result = await AgentService.getRun('run-1', 'tenant-1');
      expect(result.id).toBe('run-1');
    });

    it('should throw when run not found', async () => {
      (mockPrisma.agentRun.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(AgentService.getRun('missing', 'tenant-1')).rejects.toThrow(
        AgentError
      );
    });
  });
});
