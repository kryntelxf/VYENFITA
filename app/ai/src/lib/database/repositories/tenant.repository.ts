/**
 * VYENFITA Tenant Repository
 * 
 * Data access for Tenant model
 * 
 * @version 1.0.0
 */

import { Tenant } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateTenantInput {
  slug: string;
  name: string;
  description?: string;
  plan?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateTenantInput {
  name?: string;
  description?: string;
  plan?: string;
  status?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class TenantRepository extends BaseRepository<
  Tenant,
  CreateTenantInput,
  UpdateTenantInput,
  any
> {
  protected modelName = 'Tenant';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.tenant;
  }

  /**
   * Find tenant by slug
   */
  async findBySlug(slug: string, tx?: TransactionClient): Promise<Tenant | null> {
    return this.findOne({ slug, deletedAt: null } as any, tx);
  }

  /**
   * Find active tenants
   */
  async findActive(tx?: TransactionClient): Promise<Tenant[]> {
    return this.findAll({ status: 'active', deletedAt: null } as any, {}, tx);
  }

  /**
   * Find tenant with members
   */
  async findWithMembers(id: string, tx?: TransactionClient): Promise<any> {
    const client = tx || PrismaClient;
    return this.getModel(client).findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string, tx?: TransactionClient): Promise<boolean> {
    return this.exists({ slug } as any, tx);
  }
}

export const tenantRepository = new TenantRepository();
