/**
 * VYENFITA Install Service
 * 
 * Handles one-click template installation to tenant.
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma, withTransaction } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { PurchaseService } from './purchase.service';
import {
  InstallTemplateInput,
  MarketplaceError,
  TemplateNotFoundError,
  PurchaseRequiredError,
} from './marketplace.types';

export class InstallService {
  /**
   * Install a template to a tenant
   */
  static async install(input: InstallTemplateInput): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: input.templateId },
      include: {
        versions: {
          where: input.versionId
            ? { id: input.versionId }
            : { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!template) {
      throw new TemplateNotFoundError(input.templateId);
    }

    if (template.status !== 'published') {
      throw new MarketplaceError(
        'Template is not available for installation',
        'NOT_AVAILABLE'
      );
    }

    // Check access (purchase required for paid templates)
    const hasAccess = await PurchaseService.hasAccess(
      input.templateId,
      input.userId,
      input.tenantId
    );

    if (!hasAccess) {
      throw new PurchaseRequiredError(input.templateId);
    }

    const version = template.versions[0];
    if (!version) {
      throw new MarketplaceError('Template has no installable version', 'NO_VERSION');
    }

    // Check existing install
    const existing = await prisma.marketplaceInstall.findUnique({
      where: {
        templateId_tenantId: {
          templateId: input.templateId,
          tenantId: input.tenantId,
        },
      },
    });

    if (existing && existing.status === 'installed') {
      throw new MarketplaceError(
        'Template already installed in this tenant',
        'ALREADY_INSTALLED',
        409
      );
    }

    // Create application from template spec
    const app = await withTransaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          tenantId: input.tenantId,
          name: template.name,
          description: template.description || `From marketplace: ${template.slug}`,
          slug: `${template.slug}-${Date.now()}`,
          status: 'draft',
          metadata: {
            installedFrom: template.id,
            installedVersion: version.version,
            installedAt: new Date().toISOString(),
          },
        },
      });

      const appVersion = await tx.applicationVersion.create({
        data: {
          applicationId: application.id,
          version: '1.0.0',
          spec: version.spec as any,
          changelog: `Installed from marketplace template "${template.name}" v${version.version}`,
          createdBy: input.userId,
          isCurrent: true,
        },
      });

      await tx.application.update({
        where: { id: application.id },
        data: { currentVersionId: appVersion.id },
      });

      // Create or update install record
      const install = existing
        ? await tx.marketplaceInstall.update({
            where: { id: existing.id },
            data: {
              status: 'installed',
              versionId: version.id,
              applicationId: application.id,
              installedAt: new Date(),
            },
          })
        : await tx.marketplaceInstall.create({
            data: {
              id: uuidv4(),
              templateId: template.id,
              versionId: version.id,
              tenantId: input.tenantId,
              userId: input.userId,
              applicationId: application.id,
              status: 'installed',
              installedAt: new Date(),
            },
          });

      // Update template install count
      await tx.marketplaceTemplate.update({
        where: { id: template.id },
        data: { installCount: { increment: 1 } },
      });

      return { application, install };
    });

    await auditService.log({
      tenantId: input.tenantId,
      userId: input.userId,
      eventType: 'create',
      action: 'marketplace.template.install',
      resource: 'marketplace_install',
      resourceId: app.install.id,
      details: {
        templateId: template.id,
        version: version.version,
        applicationId: app.application.id,
      },
      status: 'success',
    });

    logger.info('Template installed', {
      templateId: template.id,
      tenantId: input.tenantId,
      applicationId: app.application.id,
    });

    return {
      install: app.install,
      application: app.application,
    };
  }

  /**
   * Uninstall a template from tenant
   */
  static async uninstall(installId: string, tenantId: string): Promise<void> {
    const install = await prisma.marketplaceInstall.findUnique({
      where: { id: installId },
    });

    if (!install) {
      throw new MarketplaceError('Install not found', 'INSTALL_NOT_FOUND', 404);
    }

    if (install.tenantId !== tenantId) {
      throw new MarketplaceError('Not authorized', 'UNAUTHORIZED', 403);
    }

    await prisma.marketplaceInstall.update({
      where: { id: installId },
      data: { status: 'uninstalled' },
    });

    await auditService.log({
      tenantId,
      eventType: 'delete',
      action: 'marketplace.template.uninstall',
      resource: 'marketplace_install',
      resourceId: installId,
      status: 'success',
    });
  }

  /**
   * List installs for tenant
   */
  static async listByTenant(tenantId: string): Promise<any[]> {
    return prisma.marketplaceInstall.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            author: {
              select: { id: true, displayName: true, avatarUrl: true, verified: true },
            },
          },
        },
      },
    });
  }
}

export default InstallService;
