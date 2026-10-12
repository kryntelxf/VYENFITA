/**
 * VYENFITA GDPR Data Export Service
 * 
 * Implements GDPR Article 15 (right of access):
 * Users can export all their personal data in a machine-readable format.
 * 
 * Also implements GDPR Article 20 (right to data portability).
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { UserDataExport, TenantDataExport } from './gdpr.types';
import { GDPR_EXPORT_VERSION } from './gdpr.constants';

export class DataExportService {
  /**
   * Export all data for a specific user
   * 
   * GDPR Article 15: Right of access by the data subject
   */
  static async exportUserData(
    userId: string,
    tenantId: string
  ): Promise<UserDataExport> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const membership = await prisma.membership.findFirst({
      where: { userId, tenantId, deletedAt: null },
    });

    if (!membership) {
      throw new Error('User is not a member of this tenant');
    }

    const [
      memberships,
      sessions,
      auditEvents,
      activityLogs,
      usageRecords,
    ] = await Promise.all([
      prisma.membership.findMany({
        where: { userId, deletedAt: null },
        include: { tenant: true, role: true },
      }),
      prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditEvent.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10000,
      }),
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10000,
      }),
      prisma.usageRecord.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10000,
      }),
    ]);

    const consents: any[] = [];

    const exportData: UserDataExport = {
      metadata: {
        exportedAt: new Date().toISOString(),
        userId,
        tenantId,
        version: GDPR_EXPORT_VERSION,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        emailVerified: user.emailVerified,
        preferredLanguage: user.preferredLanguage,
        timezone: user.timezone,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      },
      memberships: memberships.map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        roleName: m.role.name,
        status: m.status,
        joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      })),
      auditEvents: auditEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        action: e.action,
        resource: e.resource,
        resourceId: e.resourceId,
        status: e.status,
        timestamp: e.timestamp.toISOString(),
        details: (e.details as Record<string, any>) || {},
      })),
      activityLogs: activityLogs.map((l) => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        resourceId: l.resourceId,
        details: (l.details as Record<string, any>) || {},
        timestamp: l.timestamp.toISOString(),
      })),
      usageRecords: usageRecords.map((u) => ({
        id: u.id,
        service: u.service,
        operation: u.operation,
        quantity: u.quantity,
        unit: u.unit,
        timestamp: u.timestamp.toISOString(),
      })),
      consents,
    };

    await auditService.log({
      tenantId,
      userId,
      eventType: 'access',
      action: 'gdpr.user_export',
      resource: 'user',
      resourceId: userId,
      details: {
        membershipsCount: memberships.length,
        sessionsCount: sessions.length,
        auditEventsCount: auditEvents.length,
        usageRecordsCount: usageRecords.length,
      },
      status: 'success',
    });

    logger.info('User data exported', {
      userId,
      tenantId,
      size: JSON.stringify(exportData).length,
    });

    return exportData;
  }

  /**
   * Export all data for a tenant (admin only)
   */
  static async exportTenantData(
    tenantId: string,
    exportedBy: string,
    options: { includeLarge?: boolean } = {}
  ): Promise<TenantDataExport> {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const exporterMembership = await prisma.membership.findFirst({
      where: {
        userId: exportedBy,
        tenantId,
        deletedAt: null,
        status: 'active',
      },
      include: { role: true },
    });

    if (!exporterMembership) {
      throw new Error('Exporter is not a member of this tenant');
    }

    const hasAdminPermission = await this.userHasAdminPermission(
      exporterMembership.roleId
    );

    if (!hasAdminPermission) {
      throw new Error('Only tenant administrators can export full tenant data');
    }

    const [
      counts,
      members,
    ] = await Promise.all([
      this.getTenantCounts(tenantId, exportedBy),
      prisma.membership.findMany({
        where: { tenantId, deletedAt: null },
        include: { user: true, role: true },
      }),
    ]);

    const exportData: TenantDataExport = {
      metadata: {
        exportedAt: new Date().toISOString(),
        tenantId,
        exportedBy,
        version: GDPR_EXPORT_VERSION,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        description: tenant.description,
        plan: tenant.plan,
        status: tenant.status,
        settings: (tenant.settings as Record<string, any>) || {},
        createdAt: tenant.createdAt.toISOString(),
      },
      counts,
      members: members.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        roleName: m.role.name,
        status: m.status,
        joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
      })),
    };

    await auditService.log({
      tenantId,
      userId: exportedBy,
      eventType: 'access',
      action: 'gdpr.tenant_export',
      resource: 'tenant',
      resourceId: tenantId,
      details: {
        includeLarge: options.includeLarge || false,
        memberCount: members.length,
        counts,
      },
      status: 'success',
    });

    logger.info('Tenant data exported', {
      tenantId,
      exportedBy,
      size: JSON.stringify(exportData).length,
    });

    return exportData;
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static async getTenantCounts(
    tenantId: string,
    exportedBy: string
  ): Promise<{
    members: number;
    applications: number;
    workflows: number;
    deployments: number;
    integrations: number;
    marketplaceTemplates: number;
  }> {
    const [
      members,
      applications,
      workflows,
      deployments,
      integrations,
      marketplaceTemplates,
    ] = await Promise.all([
      prisma.membership.count({ where: { tenantId, deletedAt: null } }),
      prisma.application.count({ where: { tenantId, deletedAt: null } }),
      prisma.workflow.count({ where: { tenantId, deletedAt: null } }),
      prisma.deployment.count({ where: { tenantId } }),
      prisma.integrationConnection.count({ where: { tenantId } }),
      prisma.marketplaceTemplate.count({
        where: { author: { userId: exportedBy } },
      }),
    ]);

    return {
      members,
      applications,
      workflows,
      deployments,
      integrations,
      marketplaceTemplates,
    };
  }

  private static async userHasAdminPermission(roleId: string): Promise<boolean> {
    const adminPermission = await prisma.rolePermission.findFirst({
      where: {
        roleId,
        permission: {
          OR: [
            { resource: '*', action: 'manage' },
            { resource: 'tenant', action: 'manage' },
            { resource: 'tenant', action: 'all' },
          ],
        },
      },
    });

    return !!adminPermission;
  }
      }
