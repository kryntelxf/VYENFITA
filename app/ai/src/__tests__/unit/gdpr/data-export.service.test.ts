/**
 * VYENFITA Data Export Service Unit Tests
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    user: { findFirst: jest.fn() },
    membership: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    session: { findMany: jest.fn() },
    auditEvent: { findMany: jest.fn() },
    activityLog: { findMany: jest.fn() },
    usageRecord: { findMany: jest.fn() },
    tenant: { findFirst: jest.fn() },
    application: { count: jest.fn() },
    workflow: { count: jest.fn() },
    deployment: { count: jest.fn() },
    integrationConnection: { count: jest.fn() },
    marketplaceTemplate: { count: jest.fn() },
    rolePermission: { findFirst: jest.fn() },
  },
}));

jest.mock('../../../lib/audit/audit.service', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { DataExportService } from '../../../lib/gdpr/data-export.service';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('DataExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportUserData()', () => {
    it('should throw when user not found', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        DataExportService.exportUserData('missing', 'tenant-1')
      ).rejects.toThrow('User not found');
    });

    it('should throw when user is not a member of tenant', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      (mockPrisma.membership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        DataExportService.exportUserData('user-1', 'other-tenant')
      ).rejects.toThrow('User is not a member of this tenant');
    });

    it('should return all user data sections', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        emailVerified: true,
        preferredLanguage: 'en',
        timezone: 'UTC',
        createdAt: new Date('2025-01-01'),
        lastLoginAt: new Date('2026-01-01'),
      });
      (mockPrisma.membership.findFirst as jest.Mock).mockResolvedValue({
        id: 'm-1',
      });
      (mockPrisma.membership.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'm-1',
          tenantId: 'tenant-1',
          tenant: { name: 'Test Tenant' },
          role: { name: 'Owner' },
          status: 'active',
          joinedAt: new Date('2025-01-01'),
        },
      ]);
      (mockPrisma.session.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.auditEvent.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.usageRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await DataExportService.exportUserData('user-1', 'tenant-1');

      expect(result.metadata.userId).toBe('user-1');
      expect(result.metadata.tenantId).toBe('tenant-1');
      expect(result.user.email).toBe('test@example.com');
      expect(result.memberships).toHaveLength(1);
      expect(result.memberships[0].tenantName).toBe('Test Tenant');
      expect(Array.isArray(result.sessions)).toBe(true);
      expect(Array.isArray(result.auditEvents)).toBe(true);
      expect(Array.isArray(result.consents)).toBe(true);
    });

    it('should handle null name and lastLoginAt', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: null,
        status: 'active',
        emailVerified: false,
        preferredLanguage: 'en',
        timezone: 'UTC',
        createdAt: new Date(),
        lastLoginAt: null,
      });
      (mockPrisma.membership.findFirst as jest.Mock).mockResolvedValue({
        id: 'm-1',
      });
      (mockPrisma.membership.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.session.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.auditEvent.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.usageRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await DataExportService.exportUserData('user-1', 'tenant-1');

      expect(result.user.name).toBeNull();
      expect(result.user.lastLoginAt).toBeNull();
    });
  });

  describe('exportTenantData()', () => {
    it('should throw when tenant not found', async () => {
      (mockPrisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        DataExportService.exportTenantData('missing', 'user-1')
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw when exporter is not a member', async () => {
      (mockPrisma.tenant.findFirst as jest.Mock).mockResolvedValue({
        id: 'tenant-1',
      });
      (mockPrisma.membership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        DataExportService.exportTenantData('tenant-1', 'stranger')
      ).rejects.toThrow('Exporter is not a member');
    });

    it('should throw when exporter lacks admin permission', async () => {
      (mockPrisma.tenant.findFirst as jest.Mock).mockResolvedValue({
        id: 'tenant-1',
      });
      (mockPrisma.membership.findFirst as jest.Mock).mockResolvedValue({
        id: 'm-1',
        roleId: 'role-viewer',
        role: { name: 'Viewer' },
      });
      (mockPrisma.rolePermission.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        DataExportService.exportTenantData('tenant-1', 'user-1')
      ).rejects.toThrow('Only tenant administrators');
    });

    it('should return tenant data for admin', async () => {
      (mockPrisma.tenant.findFirst as jest.Mock).mockResolvedValue({
        id: 'tenant-1',
        slug: 'test-tenant',
        name: 'Test Tenant',
        description: 'A test tenant',
        plan: 'free',
        status: 'active',
        settings: {},
        createdAt: new Date('2025-01-01'),
      });
      (mockPrisma.membership.findFirst as jest.Mock).mockResolvedValue({
        id: 'm-1',
        roleId: 'role-owner',
        role: { name: 'Owner' },
      });
      (mockPrisma.rolePermission.findFirst as jest.Mock).mockResolvedValue({
        id: 'rp-1',
      });
      (mockPrisma.membership.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 'user-1',
          user: { email: 'admin@test.com', name: 'Admin' },
          role: { name: 'Owner' },
          status: 'active',
          joinedAt: new Date(),
        },
      ]);
      (mockPrisma.membership.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.application.count as jest.Mock).mockResolvedValue(5);
      (mockPrisma.workflow.count as jest.Mock).mockResolvedValue(3);
      (mockPrisma.deployment.count as jest.Mock).mockResolvedValue(2);
      (mockPrisma.integrationConnection.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.marketplaceTemplate.count as jest.Mock).mockResolvedValue(0);

      const result = await DataExportService.exportTenantData(
        'tenant-1',
        'user-1'
      );

      expect(result.tenant.id).toBe('tenant-1');
      expect(result.tenant.slug).toBe('test-tenant');
      expect(result.members).toHaveLength(1);
      expect(result.metadata.exportedBy).toBe('user-1');
    });
  });
});
