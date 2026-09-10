/**
 * VYENFITA Role Repository
 * 
 * Data access for Role model
 * 
 * @version 1.0.0
 */

import { Role } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateRoleInput {
  tenantId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  permissions?: string[]; // format: "resource:action"
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

export class RoleRepository extends BaseRepository<
  Role,
  CreateRoleInput,
  UpdateRoleInput,
  any
> {
  protected modelName = 'Role';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.role;
  }

  /**
   * Find roles by tenant (including system roles)
   */
  async findByTenant(
    tenantId: string,
    tx?: TransactionClient
  ): Promise<any[]> {
    const client = tx || PrismaClient;
    return this.getModel(client).findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Find role by name within tenant
   */
  async findByName(
    tenantId: string,
    name: string,
    tx?: TransactionClient
  ): Promise<Role | null> {
    return this.findOne({ tenantId, name } as any, tx);
  }

  /**
   * Get role with permissions
   */
  async findWithPermissions(roleId: string, tx?: TransactionClient): Promise<any> {
    const client = tx || PrismaClient;
    return this.getModel(client).findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  /**
   * Get default role for tenant
   */
  async getDefault(tenantId: string, tx?: TransactionClient): Promise<Role | null> {
    const client = tx || PrismaClient;
    return this.getModel(client).findFirst({
      where: {
        tenantId,
        isDefault: true,
      },
    });
  }
}

export const roleRepository = new RoleRepository();
