/**
 * VYENFITA Agent Service
 * 
 * Manages agent lifecycle: create, update, run, list.
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { AgentExecutor } from './agent-executor';
import {
  AgentDefinition,
  AgentNotFoundError,
  AgentError,
  DEFAULT_AGENT_CONFIG,
} from './agent.types';

export interface CreateAgentInput {
  tenantId: string;
  userId: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxSteps?: number;
  maxTokensPerRun?: number;
  maxDurationSeconds?: number;
  allowedTools?: string[];
  capabilities?: Array<{ name: string; riskLevel: string; requiresApproval: boolean }>;
  requiresApproval?: boolean;
  approvalThreshold?: string;
  triggers?: any[];
}

export class AgentService {
  /**
   * Create a new agent
   */
  static async create(input: CreateAgentInput): Promise<any> {
    const agent = await prisma.agent.create({
      data: {
        id: uuidv4(),
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        icon: input.icon,
        category: input.category || 'custom',
        systemPrompt: input.systemPrompt,
        model: input.model || DEFAULT_AGENT_CONFIG.model,
        temperature: input.temperature ?? DEFAULT_AGENT_CONFIG.temperature,
        maxSteps: input.maxSteps ?? DEFAULT_AGENT_CONFIG.maxSteps,
        maxTokensPerRun: input.maxTokensPerRun ?? DEFAULT_AGENT_CONFIG.maxTokensPerRun,
        maxDurationSeconds: input.maxDurationSeconds ?? DEFAULT_AGENT_CONFIG.maxDurationSeconds,
        allowedTools: input.allowedTools || [],
        capabilities: (input.capabilities || [
          { name: 'tool:*', riskLevel: 'low', requiresApproval: false },
        ]) as any,
        requiresApproval: input.requiresApproval ?? DEFAULT_AGENT_CONFIG.requiresApproval,
        approvalThreshold: input.approvalThreshold ?? DEFAULT_AGENT_CONFIG.approvalThreshold,
        triggers: (input.triggers || []) as any,
        status: 'active',
        createdBy: input.userId,
      },
    });

    await auditService.log({
      tenantId: input.tenantId,
      userId: input.userId,
      eventType: 'create',
      action: 'agent.create',
      resource: 'agent',
      resourceId: agent.id,
      details: { name: input.name },
      status: 'success',
    });

    logger.info('Agent created', { agentId: agent.id, name: input.name });

    return agent;
  }

  /**
   * Get agent by ID
   */
  static async getById(agentId: string, tenantId: string): Promise<any> {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, tenantId, deletedAt: null },
    });

    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    return agent;
  }

  /**
   * List agents for a tenant
   */
  static async list(tenantId: string, status?: string): Promise<any[]> {
    const where: any = { tenantId, deletedAt: null };
    if (status) where.status = status;

    return prisma.agent.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Update agent
   */
  static async update(
    agentId: string,
    tenantId: string,
    updates: Partial<CreateAgentInput>
  ): Promise<any> {
    await this.getById(agentId, tenantId);

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: {
        name: updates.name,
        description: updates.description,
        icon: updates.icon,
        category: updates.category,
        systemPrompt: updates.systemPrompt,
        model: updates.model,
        temperature: updates.temperature,
        maxSteps: updates.maxSteps,
        maxTokensPerRun: updates.maxTokensPerRun,
        maxDurationSeconds: updates.maxDurationSeconds,
        allowedTools: updates.allowedTools,
        capabilities: updates.capabilities as any,
        requiresApproval: updates.requiresApproval,
        approvalThreshold: updates.approvalThreshold,
        triggers: updates.triggers as any,
      },
    });

    return updated;
  }

  /**
   * Delete agent (soft)
   */
  static async delete(agentId: string, tenantId: string): Promise<void> {
    await this.getById(agentId, tenantId);

    await prisma.agent.update({
      where: { id: agentId },
      data: { deletedAt: new Date(), status: 'archived' },
    });

    await auditService.log({
      tenantId,
      eventType: 'delete',
      action: 'agent.delete',
      resource: 'agent',
      resourceId: agentId,
      status: 'success',
    });
  }

  /**
   * Pause agent
   */
  static async pause(agentId: string, tenantId: string): Promise<any> {
    await this.getById(agentId, tenantId);

    return prisma.agent.update({
      where: { id: agentId },
      data: { status: 'paused' },
    });
  }

  /**
   * Resume agent
   */
  static async resume(agentId: string, tenantId: string): Promise<any> {
    await this.getById(agentId, tenantId);

    return prisma.agent.update({
      where: { id: agentId },
      data: { status: 'active' },
    });
  }

  /**
   * Run agent
   */
  static async run(
    agentId: string,
    tenantId: string,
    input: { objective: string; context?: any; constraints?: string[] }
  ): Promise<any> {
    const agentRecord = await this.getById(agentId, tenantId);

    if (agentRecord.status !== 'active') {
      throw new AgentError(
        `Agent is not active: ${agentRecord.status}`,
        'AGENT_NOT_ACTIVE',
        400
      );
    }

    const agent: AgentDefinition = {
      id: agentRecord.id,
      tenantId: agentRecord.tenantId,
      name: agentRecord.name,
      description: agentRecord.description,
      icon: agentRecord.icon || undefined,
      category: agentRecord.category,
      systemPrompt: agentRecord.systemPrompt,
      model: agentRecord.model,
      temperature: agentRecord.temperature,
      maxSteps: agentRecord.maxSteps,
      maxTokensPerRun: agentRecord.maxTokensPerRun,
      maxDurationSeconds: agentRecord.maxDurationSeconds,
      allowedTools: agentRecord.allowedTools,
      capabilities: agentRecord.capabilities as any,
      requiresApproval: agentRecord.requiresApproval,
      approvalThreshold: agentRecord.approvalThreshold as any,
      triggers: agentRecord.triggers as any,
      status: agentRecord.status as any,
      createdBy: agentRecord.createdBy || '',
      createdAt: agentRecord.createdAt,
      updatedAt: agentRecord.updatedAt,
    };

    return AgentExecutor.execute(agent, input);
  }

  /**
   * List runs for an agent
   */
  static async listRuns(
    agentId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<any[]> {
    return prisma.agentRun.findMany({
      where: { agentId, tenantId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        steps: {
          orderBy: { stepIndex: 'asc' },
        },
      },
    });
  }

  /**
   * Get run details
   */
  static async getRun(runId: string, tenantId: string): Promise<any> {
    const run = await prisma.agentRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        steps: {
          orderBy: { stepIndex: 'asc' },
        },
      },
    });

    if (!run) {
      throw new AgentError('Run not found', 'RUN_NOT_FOUND', 404);
    }

    return run;
  }

  /**
   * Approve a pending step
   */
  static async approveStep(
    stepId: string,
    tenantId: string,
    userId: string,
    approved: boolean,
    reason?: string
  ): Promise<any> {
    const step = await prisma.agentStep.findFirst({
      where: { id: stepId },
    });

    if (!step) {
      throw new AgentError('Step not found', 'STEP_NOT_FOUND', 404);
    }

    const run = await prisma.agentRun.findUnique({
      where: { id: step.runId },
    });

    if (!run || run.tenantId !== tenantId) {
      throw new AgentError('Run not found', 'RUN_NOT_FOUND', 404);
    }

    await prisma.agentStep.update({
      where: { id: stepId },
      data: {
        approval: {
          required: true,
          status: approved ? 'approved' : 'rejected',
          approvedBy: userId,
          approvedAt: new Date(),
          reason,
        } as any,
      },
    });

    await auditService.log({
      tenantId,
      userId,
      eventType: 'modify',
      action: approved ? 'agent.step.approve' : 'agent.step.reject',
      resource: 'agent_step',
      resourceId: stepId,
      details: { reason },
      status: 'success',
    });

    // Update run status
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: approved ? 'running' : 'failed',
        error: approved ? undefined : `Rejected: ${reason || 'No reason'}`,
      },
    });

    return { success: true, approved };
  }
}

export default AgentService;
