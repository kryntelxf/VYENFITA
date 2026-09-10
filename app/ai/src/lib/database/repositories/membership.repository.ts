/**
 * VYENFITA Membership Repository
 * 
 * Data access for Membership model (User ↔ Tenant ↔ Role)
 * 
 * @version 1.0.0
 */

import { Membership } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateMembershipInput {
  userId: string;
  tenantId: string;
  roleId: string;
  status?: string;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt?: Date;
}

export interface UpdateMembershipInput {
  roleId?: string;
  status?: string;
  joinedAt?: Date;
}

export class MembershipRepository extends BaseRepository<
  Membership,
  CreateMembershipInput,
  UpdateMembershipInput,
  any
> {
  protected modelName = 'Membership';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.membership;
  }

  /**
   * Find memberships for a user
   */
  async findByUser(userId: string, tx?: TransactionClient): Promise<any[]> {
    const client = tx || PrismaClient;
    return this.getModel(client).findMany({
      where: { userId, deletedAt: null },
      include: {
        tenant: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find memberships for a tenant
   */
  async findByTenant(tenantId: string, tx?: TransactionClient): Promise<any[]> {
    const client = tx || PrismaClient;
    return this.getModel(client).findMany({
      where: { tenantId, deletedAt: null },
      include: {
        user: true,
        role: true,
      },
    });
  }

  /**
   * Find specific membership
   */
  async findByUserAndTenant(
    userId: string,
    tenantId: string,
    tx?: TransactionClient
  ): Promise<Membership | null> {
    return this.findOne({ userId, tenantId, deletedAt: null } as any, tx);
  }

  /**
   * Check if user is member of tenant
   */
  async isMember(userId: string, tenantId: string, tx?: TransactionClient): Promise<boolean> {
    return this.exists({ userId, tenantId, deletedAt: null } as any, tx);
  }

  /**
   * Get user's role in tenant
   */
  async getUserRole(
    userId: string,
    tenantId: string,
    tx?: TransactionClient
  ): Promise<any | null> {
    const client = tx || PrismaClient;
    const membership = await this.getModel(client).findFirst({
      where: { userId, tenantId, deletedAt: null },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    return membership?.role || null;
  }

  /**
   * Count members in tenant
   */
  async countByTenant(tenantId: string, tx?: TransactionClient): Promise<number> {
    return this.count({ tenantId, deletedAt: null } as any, tx);
  }
}

export const membershipRepository = new MembershipRepository();
