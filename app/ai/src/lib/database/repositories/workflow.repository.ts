/**
 * VYENFITA Workflow Repository
 * 
 * Data access for Workflow model
 * 
 * @version 1.0.0
 */

import { Workflow } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateWorkflowInput {
  tenantId: string;
  name: string;
  description?: string;
  slug: string;
  status?: string;
  triggers?: Record<string, any>[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  status?: string;
  triggers?: Record<string, any>[];
  currentVersionId?: string;
}

export class WorkflowRepository extends BaseRepository<
  Workflow,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  any
> {
  protected modelName = 'Workflow';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.workflow;
  }

  /**
   * Find workflows by tenant
   */
  async findByTenant(
    tenantId: string,
    options?: { status?: string; page?: number; limit?: number },
    tx?: TransactionClient
  ): Promise<any> {
    const where: any = { tenantId, deletedAt: null };
    if (options?.status) {
      where.status = options.status;
    }

    return this.findMany(where, {
      pagination: {
        page: options?.page,
        limit: options?.limit,
      },
    }, tx);
  }

  /**
   * Find workflow by slug within tenant
   */
  async findBySlug(
    tenantId: string,
    slug: string,
    tx?: TransactionClient
  ): Promise<Workflow | null> {
    return this.findOne({ tenantId, slug, deletedAt: null } as any, tx);
  }

  /**
   * Find workflow with versions and executions
   */
  async findWithDetails(id: string, tx?: TransactionClient): Promise<any> {
    const client = tx || PrismaClient;
    return this.getModel(client).findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Check if slug exists in tenant
   */
  async slugExists(
    tenantId: string,
    slug: string,
    excludeId?: string,
    tx?: TransactionClient
  ): Promise<boolean> {
    const where: any = { tenantId, slug, deletedAt: null };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    return this.exists(where, tx);
  }

  /**
   * Count workflows by tenant
   */
  async countByTenant(tenantId: string, tx?: TransactionClient): Promise<number> {
    return this.count({ tenantId, deletedAt: null } as any, tx);
  }
}

export const workflowRepository = new WorkflowRepository();
