/**
 * VYENFITA Application Service
 * 
 * Business logic for applications:
 * - Create with validation
 * - Read with tenant isolation
 * - Update with versioning
 * - Delete (soft)
 * - Publish
 * 
 * @version 1.0.0
 */

import { applicationRepository } from '../database/repositories/application.repository';
import { applicationVersionRepository } from '../database/repositories/application-version.repository';
import { prisma, withTransaction } from '../database/client';
import { auditService } from '../audit/audit.service';

export interface CreateApplicationParams {
  tenantId: string;
  userId: string;
  name: string;
  description?: string;
  slug?: string;
  spec: Record<string, any>;
  tags?: string[];
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateApplicationParams {
  tenantId: string;
  userId: string;
  applicationId: string;
  name?: string;
  description?: string;
  status?: string;
  spec?: Record<string, any>;
  tags?: string[];
  changeLog?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class ApplicationService {
  /**
   * Create a new application with initial version
   */
  static async create(params: CreateApplicationParams): Promise<any> {
    // Validate
    if (!params.name || params.name.length < 1 || params.name.length > 255) {
      throw new Error('Application name must be between 1 and 255 characters');
    }

    // Generate slug if not provided
    const slug = params.slug || this.generateSlug(params.name);

    // Check slug uniqueness within tenant
    const slugExists = await applicationRepository.slugExists(params.tenantId, slug);
    if (slugExists) {
      throw new Error('An application with this slug already exists in your tenant');
    }

    // Create application + initial version in transaction
    const result = await withTransaction(async (tx) => {
      // Create application
      const application = await tx.application.create({
        data: {
          tenantId: params.tenantId,
          name: params.name,
          description: params.description,
          slug,
          status: 'draft',
          tags: params.tags || [],
        },
      });

      // Create initial version
      const version = await tx.applicationVersion.create({
        data: {
          applicationId: application.id,
          version: '1.0.0',
          spec: params.spec,
          changelog: 'Initial version',
          createdBy: params.userId,
          isCurrent: true,
        },
      });

      // Update application with current version
      const updated = await tx.application.update({
        where: { id: application.id },
        data: { currentVersionId: version.id },
      });

      return { application: updated, version };
    });

    // Audit
    await auditService.log({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType: 'create',
      action: 'application.create',
      resource: 'application',
      resourceId: result.application.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: {
        name: params.name,
        slug,
        version: '1.0.0',
      },
      status: 'success',
    });

    return {
      ...result.application,
      currentVersion: result.version,
    };
  }

  /**
   * Get application by ID with tenant isolation
   */
  static async getById(
    tenantId: string,
    applicationId: string,
    userId?: string
  ): Promise<any> {
    const application = await applicationRepository.findOne({
      id: applicationId,
      tenantId,
      deletedAt: null,
    } as any);

    if (!application) {
      throw new Error('Application not found');
    }

    // Load current version
    const currentVersion = application.currentVersionId
      ? await applicationVersionRepository.findById(application.currentVersionId)
      : null;

    return {
      ...application,
      currentVersion,
    };
  }

  /**
   * List applications for tenant
   */
  static async list(
    tenantId: string,
    options: { status?: string; page?: number; limit?: number } = {}
  ): Promise<any> {
    return applicationRepository.findByTenant(tenantId, options);
  }

  /**
   * Update application (creates new version if spec changed)
   */
  static async update(params: UpdateApplicationParams): Promise<any> {
    // Verify application exists and belongs to tenant
    const existing = await applicationRepository.findOne({
      id: params.applicationId,
      tenantId: params.tenantId,
      deletedAt: null,
    } as any);

    if (!existing) {
      throw new Error('Application not found');
    }

    // Prepare update data
    const updateData: any = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.tags !== undefined) updateData.tags = params.tags;

    // Handle spec change - creates new version
    let newVersion: any = null;
    if (params.spec) {
      newVersion = await withTransaction(async (tx) => {
        // Clear current flag
        await tx.applicationVersion.updateMany({
          where: { applicationId: params.applicationId },
          data: { isCurrent: false },
        });

        // Get next version number
        const latestVersions = await tx.applicationVersion.findMany({
          where: { applicationId: params.applicationId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        const latestVersion = latestVersions[0];
        const [major, minor, patch] = latestVersion
          ? latestVersion.version.split('.').map(Number)
          : [1, 0, 0];

        const nextVersion = `${major}.${minor}.${patch + 1}`;

        // Create new version
        const version = await tx.applicationVersion.create({
          data: {
            applicationId: params.applicationId,
            version: nextVersion,
            spec: params.spec!,
            changelog: params.changeLog || 'Updated specification',
            createdBy: params.userId,
            isCurrent: true,
          },
        });

        return version;
      });

      updateData.currentVersionId = newVersion.id;
    }

    // Update application
    const updated = await applicationRepository.update(
      params.applicationId,
      updateData
    );

    // Audit
    await auditService.log({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType: 'modify',
      action: 'application.update',
      resource: 'application',
      resourceId: params.applicationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: {
        fields: Object.keys(updateData),
        newVersion: newVersion?.version,
      },
      status: 'success',
    });

    return {
      ...updated,
      currentVersion: newVersion,
    };
  }

  /**
   * Soft delete application
   */
  static async delete(
    tenantId: string,
    applicationId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Verify ownership
    const existing = await applicationRepository.findOne({
      id: applicationId,
      tenantId,
      deletedAt: null,
    } as any);

    if (!existing) {
      throw new Error('Application not found');
    }

    // Soft delete
    await applicationRepository.softDelete(applicationId);

    // Audit
    await auditService.log({
      tenantId,
      userId,
      eventType: 'delete',
      action: 'application.delete',
      resource: 'application',
      resourceId: applicationId,
      ipAddress,
      userAgent,
      details: { name: existing.name, slug: existing.slug },
      status: 'success',
    });
  }

  /**
   * Get version history
   */
  static async getVersionHistory(
    tenantId: string,
    applicationId: string
  ): Promise<any[]> {
    // Verify tenant access
    const application = await applicationRepository.findOne({
      id: applicationId,
      tenantId,
      deletedAt: null,
    } as any);

    if (!application) {
      throw new Error('Application not found');
    }

    return applicationVersionRepository.findByApplication(applicationId);
  }

  /**
   * Get specific version
   */
  static async getVersion(
    tenantId: string,
    applicationId: string,
    versionId: string
  ): Promise<any> {
    // Verify tenant access
    const application = await applicationRepository.findOne({
      id: applicationId,
      tenantId,
      deletedAt: null,
    } as any);

    if (!application) {
      throw new Error('Application not found');
    }

    const version = await applicationVersionRepository.findById(versionId);
    if (!version || version.applicationId !== applicationId) {
      throw new Error('Version not found');
    }

    return version;
  }

  /**
   * Rollback to a specific version
   */
  static async rollback(
    tenantId: string,
    applicationId: string,
    versionId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    // Verify tenant access
    const application = await applicationRepository.findOne({
      id: applicationId,
      tenantId,
      deletedAt: null,
    } as any);

    if (!application) {
      throw new Error('Application not found');
    }

    // Get target version
    const targetVersion = await applicationVersionRepository.findById(versionId);
    if (!targetVersion || targetVersion.applicationId !== applicationId) {
      throw new Error('Version not found');
    }

    // Create new version that's a copy of target
    const result = await withTransaction(async (tx) => {
      // Clear current flag
      await tx.applicationVersion.updateMany({
        where: { applicationId },
        data: { isCurrent: false },
      });

      // Get latest version number
      const latestVersions = await tx.applicationVersion.findMany({
        where: { applicationId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      const latest = latestVersions[0];
      const [major, minor, patch] = latest
        ? latest.version.split('.').map(Number)
        : [1, 0, 0];

      const nextVersion = `${major}.${minor}.${patch + 1}`;

      // Create new version with target spec
      const newVersion = await tx.applicationVersion.create({
        data: {
          applicationId,
          version: nextVersion,
          spec: targetVersion.spec as any,
          changelog: `Rollback to version ${targetVersion.version}`,
          createdBy: userId,
          isCurrent: true,
        },
      });

      // Update application
      const updated = await tx.application.update({
        where: { id: applicationId },
        data: { currentVersionId: newVersion.id },
      });

      return { application: updated, version: newVersion };
    });

    // Audit
    await auditService.log({
      tenantId,
      userId,
      eventType: 'modify',
      action: 'application.rollback',
      resource: 'application',
      resourceId: applicationId,
      ipAddress,
      userAgent,
      details: {
        targetVersion: targetVersion.version,
        newVersion: result.version.version,
      },
      status: 'success',
    });

    return result;
  }

  /**
   * Get statistics for tenant
   */
  static async getStats(tenantId: string): Promise<any> {
    const [total, drafts, published] = await Promise.all([
      applicationRepository.countByTenant(tenantId),
      applicationRepository.count({ tenantId, status: 'draft', deletedAt: null } as any),
      applicationRepository.count({ tenantId, status: 'published', deletedAt: null } as any),
    ]);

    return { total, drafts, published };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100) || 'app';
  }
                                                  }
