/**
 * VYENFITA Application Version Repository
 * 
 * Data access for ApplicationVersion model
 * 
 * @version 1.0.0
 */

import { ApplicationVersion } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateApplicationVersionInput {
  applicationId: string;
  version: string;
  spec: Record<string, any>;
  changelog?: string;
  createdBy?: string;
}

export class ApplicationVersionRepository extends BaseRepository<
  ApplicationVersion,
  CreateApplicationVersionInput,
  never,
  any
> {
  protected modelName = 'ApplicationVersion';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.applicationVersion;
  }

  /**
   * Find versions by application
   */
  async findByApplication(
    applicationId: string,
    tx?: TransactionClient
  ): Promise<ApplicationVersion[]> {
    const client = tx || PrismaClient;
    return this.getModel(client).findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get current version
   */
  async getCurrent(applicationId: string, tx?: TransactionClient): Promise<ApplicationVersion | null> {
    const client = tx || PrismaClient;
    return this.getModel(client).findFirst({
      where: { applicationId, isCurrent: true },
    });
  }

  /**
   * Clear current flag on all versions
   */
  async clearCurrentFlag(applicationId: string, tx?: TransactionClient): Promise<void> {
    const client = tx || PrismaClient;
    await this.getModel(client).updateMany({
      where: { applicationId },
      data: { isCurrent: false },
    });
  }

  /**
   * Get next version number (semantic)
   */
  async getNextVersion(
    applicationId: string,
    type: 'major' | 'minor' | 'patch' = 'patch',
    tx?: TransactionClient
  ): Promise<string> {
    const latest = await this.getCurrent(applicationId, tx);

    if (!latest) {
      return '1.0.0';
    }

    const [major, minor, patch] = latest.version.split('.').map(Number);

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * Find by application and version string
   */
  async findByVersion(
    applicationId: string,
    version: string,
    tx?: TransactionClient
  ): Promise<ApplicationVersion | null> {
    const client = tx || PrismaClient;
    return this.getModel(client).findUnique({
      where: {
        applicationId_version: {
          applicationId,
          version,
        },
      },
    });
  }

  /**
   * Count versions for application
   */
  async countByApplication(applicationId: string, tx?: TransactionClient): Promise<number> {
    return this.count({ applicationId } as any, tx);
  }
}

export const applicationVersionRepository = new ApplicationVersionRepository();
