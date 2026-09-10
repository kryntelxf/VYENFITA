/**
 * VYENFITA Permission Repository
 * 
 * @version 1.0.0
 */

import { Permission } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export class PermissionRepository extends BaseRepository<
  Permission,
  any,
  never,
  any
> {
  protected modelName = 'Permission';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.permission;
  }

  async findAllPermissions(tx?: TransactionClient): Promise<Permission[]> {
    const client = tx || PrismaClient;
    return this.getModel(client).findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * Find permission by resource:action
   */
  async findByKey(resource: string, action: string, tx?: TransactionClient): Promise<Permission | null> {
    const client = tx || PrismaClient;
    return this.getModel(client).findUnique({
      where: {
        resource_action: { resource, action },
      },
    });
  }
}

export const permissionRepository = new PermissionRepository();
