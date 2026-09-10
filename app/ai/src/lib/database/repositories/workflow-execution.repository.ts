/**
 * VYENFITA Workflow Execution Repository
 * 
 * Data access for WorkflowExecution model
 * 
 * @version 1.0.0
 */

import { WorkflowExecution } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateWorkflowExecutionInput {
  workflowId: string;
  versionId?: string;
  tenantId: string;
  status?: string;
  input?: Record<string, any>;
  variables?: Record<string, any>;
  triggeredBy?: string;
  triggerType?: string;
}

export interface UpdateWorkflowExecutionInput {
  status?: string;
  output?: Record<string, any>;
  variables?: Record<string, any>;
  currentStep?: string;
  stepResults?: Record<string, any>[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  retryCount?: number;
}

export class WorkflowExecutionRepository extends BaseRepository<
  WorkflowExecution,
  CreateWorkflowExecutionInput,
  UpdateWorkflowExecutionInput,
  any
> {
  protected modelName = 'WorkflowExecution';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.workflowExecution;
  }

  /**
   * Find executions by workflow
   */
  async findByWorkflow(
    workflowId: string,
    options?: { status?: string; page?: number; limit?: number },
    tx?: TransactionClient
  ): Promise<any> {
    const where: any = { workflowId };
    if (options?.status) {
      where.status = options.status;
    }

    return this.findMany(where, {
      pagination: {
        page: options?.page,
        limit: options?.limit,
      },
      sort: { field: 'createdAt', direction: 'desc' },
    }, tx);
  }

  /**
   * Find executions by tenant
   */
  async findByTenant(
    tenantId: string,
    options?: { status?: string; page?: number; limit?: number },
    tx?: TransactionClient
  ): Promise<any> {
    const where: any = { tenantId };
    if (options?.status) {
      where.status = options.status;
    }

    return this.findMany(where, {
      pagination: {
        page: options?.page,
        limit: options?.limit,
      },
      sort: { field: 'createdAt', direction: 'desc' },
    }, tx);
  }

  /**
   * Get recent executions count
   */
  async countByStatus(
    tenantId: string,
    status: string,
    sinceDate?: Date,
    tx?: TransactionClient
  ): Promise<number> {
    const where: any = { tenantId, status };
    if (sinceDate) {
      where.createdAt = { gte: sinceDate };
    }
    return this.count(where, tx);
  }

  /**
   * Get running executions
   */
  async getRunning(tenantId: string, tx?: TransactionClient): Promise<WorkflowExecution[]> {
    const client = tx || PrismaClient;
    return this.getModel(client).findMany({
      where: { tenantId, status: 'running' },
      orderBy: { startedAt: 'asc' },
    });
  }

  /**
   * Cleanup old executions
   */
  async deleteOlderThan(cutoffDate: Date, tx?: TransactionClient): Promise<number> {
    const result = await this.deleteMany({ createdAt: { lt: cutoffDate } } as any, tx);
    return result.count;
  }
}

export const workflowExecutionRepository = new WorkflowExecutionRepository();
