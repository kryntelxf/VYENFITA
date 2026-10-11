/**
 * VYENFITA Marketplace Install Service Unit Tests
 * 
 * Verifies:
 * - Install flow with tenant quota
 * - Duplicate install prevention
 * - Uninstall
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    marketplaceTemplate: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    marketplaceInstall: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    marketplaceVersion: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { InstallService } from '../../../lib/marketplace/install.service';
import { MarketplaceError } from '../../../lib/marketplace/marketplace.types';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('InstallService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('install()', () => {
    it('should install published template', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'published',
        currentVersionId: 'version-1',
      });
      (mockPrisma.marketplaceInstall.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplaceInstall.create as jest.Mock).mockResolvedValue({
        id: 'install-1',
        templateId: 'template-1',
        tenantId: 'tenant-1',
        status: 'completed',
        applicationId: 'app-new-1',
      });
      (mockPrisma.marketplaceTemplate.update as jest.Mock).mockResolvedValue({});

      const result = await InstallService.install({
        templateId: 'template-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      expect(result.id).toBe('install-1');
      expect(result.status).toBe('completed');
    });

    it('should reject install of non-published template', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'draft',
      });

      await expect(
        InstallService.install({
          templateId: 'template-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
        })
      ).rejects.toThrow(MarketplaceError);
    });

    it('should reject when template not found', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        InstallService.install({
          templateId: 'missing',
          tenantId: 'tenant-1',
          userId: 'user-1',
        })
      ).rejects.toThrow(/not found/);
    });

    it('should reject duplicate install in same tenant', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'published',
      });
      (mockPrisma.marketplaceInstall.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-install',
      });

      await expect(
        InstallService.install({
          templateId: 'template-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
        })
      ).rejects.toThrow(/already installed/);
    });

    it('should increment template install count on success', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        status: 'published',
      });
      (mockPrisma.marketplaceInstall.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplaceInstall.create as jest.Mock).mockResolvedValue({
        id: 'install-1',
        status: 'completed',
      });
      (mockPrisma.marketplaceTemplate.update as jest.Mock).mockResolvedValue({});

      await InstallService.install({
        templateId: 'template-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      expect(mockPrisma.marketplaceTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: { installCount: { increment: 1 } },
      });
    });
  });

  describe('uninstall()', () => {
    it('should remove an install', async () => {
      (mockPrisma.marketplaceInstall.findFirst as jest.Mock).mockResolvedValue({
        id: 'install-1',
        tenantId: 'tenant-1',
      });
      (mockPrisma.marketplaceInstall.update as jest.Mock).mockResolvedValue({});

      await InstallService.uninstall('install-1', 'tenant-1');

      expect(mockPrisma.marketplaceInstall.update).toHaveBeenCalled();
    });

    it('should reject cross-tenant uninstall', async () => {
      (mockPrisma.marketplaceInstall.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        InstallService.uninstall('install-1', 'other-tenant')
      ).rejects.toThrow();
    });
  });

  describe('listByTenant()', () => {
    it('should list installs for tenant', async () => {
      (mockPrisma.marketplaceInstall.findMany as jest.Mock).mockResolvedValue([
        { id: 'install-1' },
        { id: 'install-2' },
      ]);

      const result = await InstallService.listByTenant('tenant-1');
      expect(result.length).toBe(2);
    });
  });
});
