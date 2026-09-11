/**
 * VYENFITA Approval Service
 * 
 * Human-in-the-loop approval for workflows:
 * - Request approval
 * - List pending approvals
 * - Approve/reject
 * - Audit trail
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  workflowId: string;
  executionId: string;
  stepId: string;
  requesterId: string;
  approvers: string[];
  message: string;
  data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: Date;
  respondedAt?: Date;
  respondedBy?: string;
  response?: string;
  expiresAt: Date;
}

export interface CreateApprovalInput {
  tenantId: string;
  workflowId: string;
  executionId: string;
  stepId: string;
  requesterId: string;
  approvers: string[];
  message: string;
  data?: Record<string, any>;
  expiresInMs?: number;
}

export class ApprovalService {
  /**
   * Create an approval request
   */
  async create(input: CreateApprovalInput): Promise<ApprovalRequest> {
    const approval: ApprovalRequest = {
      id: uuidv4(),
      tenantId: input.tenantId,
      workflowId: input.workflowId,
      executionId: input.executionId,
      stepId: input.stepId,
      requesterId: input.requesterId,
      approvers: input.approvers,
      message: input.message,
      data: input.data || {},
      status: 'pending',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + (input.expiresInMs || 24 * 60 * 60 * 1000)),
    };

    // Store in workflow execution
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: input.executionId },
    });

    if (!execution) {
      throw new Error('Workflow execution not found');
    }

    const stepResults = (execution.stepResults as any[]) || [];
    stepResults.push({
      type: 'approval_request',
      approval,
    });

    await prisma.workflowExecution.update({
      where: { id: input.executionId },
      data: {
        status: 'waiting_approval',
        stepResults,
      },
    });

    await auditService.log({
      tenantId: input.tenantId,
      userId: input.requesterId,
      eventType: 'create',
      action: 'approval.request',
      resource: 'approval',
      resourceId: approval.id,
      details: {
        workflowId: input.workflowId,
        executionId: input.executionId,
        approvers: input.approvers,
      },
      status: 'success',
    });

    logger.info('Approval requested', {
      approvalId: approval.id,
      workflowId: input.workflowId,
      approvers: input.approvers,
    });

    return approval;
  }

  /**
   * Get approval by ID
   */
  async get(approvalId: string, tenantId: string): Promise<ApprovalRequest | null> {
    const executions = await prisma.workflowExecution.findMany({
      where: { tenantId },
    });

    for (const execution of executions) {
      const stepResults = (execution.stepResults as any[]) || [];
      for (const result of stepResults) {
        if (result.type === 'approval_request' && result.approval?.id === approvalId) {
          return result.approval as ApprovalRequest;
        }
      }
    }

    return null;
  }

  /**
   * List pending approvals for a user
   */
  async listPendingForUser(
    userId: string,
    tenantId: string
  ): Promise<ApprovalRequest[]> {
    const executions = await prisma.workflowExecution.findMany({
      where: { tenantId, status: 'waiting_approval' },
    });

    const pending: ApprovalRequest[] = [];

    for (const execution of executions) {
      const stepResults = (execution.stepResults as any[]) || [];
      for (const result of stepResults) {
        if (result.type === 'approval_request' && result.approval) {
          const approval = result.approval as ApprovalRequest;
          if (approval.status === 'pending' && approval.approvers.includes(userId)) {
            pending.push(approval);
          }
        }
      }
    }

    return pending;
  }

  /**
   * Approve a request
   */
  async approve(
    approvalId: string,
    userId: string,
    tenantId: string,
    response?: string
  ): Promise<ApprovalRequest> {
    const approval = await this.get(approvalId, tenantId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    if (approval.status !== 'pending') {
      throw new Error(`Cannot approve: status is ${approval.status}`);
    }

    if (!approval.approvers.includes(userId)) {
      throw new Error('User is not an approver');
    }

    if (new Date() > approval.expiresAt) {
      approval.status = 'expired';
      await this.updateApproval(approval);
      throw new Error('Approval has expired');
    }

    approval.status = 'approved';
    approval.respondedAt = new Date();
    approval.respondedBy = userId;
    approval.response = response;

    await this.updateApproval(approval);

    await auditService.log({
      tenantId,
      userId,
      eventType: 'modify',
      action: 'approval.approve',
      resource: 'approval',
      resourceId: approvalId,
      details: {
        workflowId: approval.workflowId,
        executionId: approval.executionId,
      },
      status: 'success',
    });

    logger.info('Approval approved', { approvalId, userId });

    return approval;
  }

  /**
   * Reject a request
   */
  async reject(
    approvalId: string,
    userId: string,
    tenantId: string,
    response?: string
  ): Promise<ApprovalRequest> {
    const approval = await this.get(approvalId, tenantId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    if (approval.status !== 'pending') {
      throw new Error(`Cannot reject: status is ${approval.status}`);
    }

    if (!approval.approvers.includes(userId)) {
      throw new Error('User is not an approver');
    }

    approval.status = 'rejected';
    approval.respondedAt = new Date();
    approval.respondedBy = userId;
    approval.response = response;

    await this.updateApproval(approval);

    // Mark workflow execution as failed
    await prisma.workflowExecution.update({
      where: { id: approval.executionId },
      data: {
        status: 'failed',
        error: 'Approval rejected',
        completedAt: new Date(),
      },
    });

    await auditService.log({
      tenantId,
      userId,
      eventType: 'modify',
      action: 'approval.reject',
      resource: 'approval',
      resourceId: approvalId,
      details: {
        workflowId: approval.workflowId,
        executionId: approval.executionId,
        response,
      },
      status: 'success',
    });

    logger.info('Approval rejected', { approvalId, userId });

    return approval;
  }

  /**
   * Update approval in storage
   */
  private async updateApproval(approval: ApprovalRequest): Promise<void> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: approval.executionId },
    });

    if (!execution) return;

    const stepResults = (execution.stepResults as any[]) || [];
    const index = stepResults.findIndex(
      (r: any) => r.type === 'approval_request' && r.approval?.id === approval.id
    );

    if (index === -1) return;

    stepResults[index].approval = approval;

    await prisma.workflowExecution.update({
      where: { id: approval.executionId },
      data: { stepResults },
    });
  }
}

let instance: ApprovalService | undefined;

export function getApprovalService(): ApprovalService {
  if (!instance) {
    instance = new ApprovalService();
  }
  return instance;
        }
