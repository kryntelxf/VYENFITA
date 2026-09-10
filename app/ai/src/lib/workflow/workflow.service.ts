/**
 * VYENFITA Workflow Service
 * 
 * Business logic for workflows
 * 
 * @version 1.0.0
 */

import { workflowRepository } from '../database/repositories/workflow.repository';
import { workflowExecutionRepository } from '../database/repositories/workflow-execution.repository';
import { prisma, withTransaction } from '../database/client';
import { auditService } from '../audit/audit.service';

export interface CreateWorkflowParams {
  tenantId: string;
  userId: string;
  name: string;
  description?: string;
  slug?: string;
  definition: Record<string, any>;
  triggers?: Record<string, any>[];
  ipAddress?: string;
  userAgent?: string;
}

export class WorkflowService {
  static async create(params: CreateWorkflowParams): Promise<any> {
    if (!params.name || params.name.length < 1 || params.name.length > 255) {
      throw new Error('Workflow name must be between 1 and 255 characters');
    }

    const slug = params.slug || this.generateSlug(params.name);

    const slugExists = await workflowRepository.slugExists(params.tenantId, slug);
    if (slugExists) {
      throw new Error('A workflow with this slug already exists in your tenant');
    }

    const result = await withTransaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          tenantId: params.tenantId,
          name: params.name,
          description: params.description,
          slug,
          status: 'draft',
          triggers: params.triggers || [],
        },
      });

      const version = await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: '1.0.0',
          definition: params.definition,
          changelog: 'Initial version',
          createdBy: params.userId,
          isCurrent: true,
        },
      });

      const updated = await tx.workflow.update({
        where: { id: workflow.id },
        data: { currentVersionId: version.id },
      });

      return { workflow: updated, version };
    });

    await auditService.log({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType: 'create',
      action: 'workflow.create',
      resource: 'workflow',
      resourceId: result.workflow.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: { name: params.name, slug },
      status: 'success',
    });

    return result.workflow;
  }

  static async getById(tenantId: string, workflowId: string): Promise<any> {
    const workflow = await workflowRepository.findOne({
      id: workflowId,
      tenantId,
      deletedAt: null,
    } as any);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return workflowRepository.findWithDetails(workflowId);
  }

  static async list(
    tenantId: string,
    options: { status?: string; page?: number; limit?: number } = {}
  ): Promise<any> {
    return workflowRepository.findByTenant(tenantId, options);
  }

  static async delete(
    tenantId: string,
    workflowId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const existing = await workflowRepository.findOne({
      id: workflowId,
      tenantId,
      deletedAt: null,
    } as any);

    if (!existing) {
      throw new Error('Workflow not found');
    }

    await workflowRepository.softDelete(workflowId);

    await auditService.log({
      tenantId,
      userId,
      eventType: 'delete',
      action: 'workflow.delete',
      resource: 'workflow',
      resourceId: workflowId,
      ipAddress,
      userAgent,
      details: { name: existing.name },
      status: 'success',
    });
  }

  static async getStats(tenantId: string): Promise<any> {
    const [total, active, executions24h] = await Promise.all([
      workflowRepository.countByTenant(tenantId),
      workflowRepository.count({ tenantId, status: 'active', deletedAt: null } as any),
      workflowExecutionRepository.countByStatus(
        tenantId,
        'completed',
        new Date(Date.now() - 24 * 60 * 60 * 1000)
      ),
    ]);

    return { total, active, executions24h };
  }

  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100) || 'workflow';
  }
  }
