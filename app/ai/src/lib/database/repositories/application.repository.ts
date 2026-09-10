/**
 * VYENFITA Application Repository
 * 
 * Data access for Application model
 * 
 * @version 1.0.0
 */

import { Application } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateApplicationInput {
  tenantId: string;
  name: string;
  description?: string;
  slug: string;
  status?: string;
  metadata?: Record<string, any>;
  settings?: Record<string, any>;
  tags?: string[];
}

export interface UpdateApplicationInput {
  name?: string;
  description?: string;
  status?: string;
  metadata?: Record<string, any>;
  settings?: Record<string, any>;
  tags?: string[];
  currentVersionId?: string;
}

export class ApplicationRepository extends BaseRepository<
  Application,
  CreateApplicationInput,
  UpdateApplicationInput,
  any
> {
  protected modelName = 'Application';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.application;
  }

  /**
   * Find applications by tenant
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
   * Find application by slug within tenant
   */
  async findBySlug(
    tenantId: string,
    slug: string,
    tx?: TransactionClient
  ): Promise<Application | null> {
    return this.findOne({ tenantId, slug, deletedAt: null } as any, tx);
  }

  /**
   * Find application with versions
   */
  async findWithVersions(id: string, tx?: TransactionClient): Promise<any> {
    const client = tx || PrismaClient;
    return this.getModel(client).findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
        },
        environments: true,
      },
    });
  }

  /**
   * Get current version
   */
  async getCurrentVersion(id: string, tx?: TransactionClient): Promise<any> {
    const client = tx || PrismaClient;
    const app = await this.getModel(client).findUnique({
      where: { id },
      select: { currentVersionId: true },
    });

    if (!app?.currentVersionId) return null;

    return client.applicationVersion.findUnique({
      where: { id: app.currentVersionId },
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
   * Count applications by tenant
   */
  async countByTenant(tenantId: string, tx?: TransactionClient): Promise<number> {
    return this.count({ tenantId, deletedAt: null } as any, tx);
  }
}

export const applicationRepository = new ApplicationRepository();
