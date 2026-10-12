/**
 * VYENFITA Data Deletion Service Unit Tests
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    user: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    membership: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    session: { updateMany: jest.fn() },
    auditEvent: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../lib/audit/audit.service', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { DataDeletionService } from '../../../lib/gdpr/data-deletion.service';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as any;

describe('DataDeletionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default transaction mock: run callback with tx = prisma
    (mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (cb: any) => cb(mockPrisma)
    );
  });

  describe('requestUserDeletion()', () => {
    it('should throw when user not found', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        DataDeletionService.requestUserDeletion('missing', 'tenant-1', {
          confirmEmail: 'x@test.com',
        })
      ).rejects.toThrow('User not found');
    });

    it('should throw when email confirmation mismatches', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'real@test.com',
      });

      await expect(
        DataDeletionService.requestUserDeletion('user-1', 'tenant-1', {
          confirmEmail: 'wrong@test.com',
        })
      ).rejects.toThrow('Email confirmation does not match');
    });

    it('should throw when user is sole owner of a tenant', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'owner@test.com',
        metadata: {},
      });
      (mockPrisma.membership.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'm-1',
          tenantId: 'tenant-1',
          role: { name: 'Owner' },
          tenant: { name: 'Test Tenant' },
        },
      ]);
      (mockPrisma.membership.count as jest.Mock).mockResolvedValue(1);

      await expect(
        DataDeletionService.requestUserDeletion('user-1', 'tenant-1', {
          confirmEmail: 'owner@test.com',
        })
      ).rejects.toThrow(/sole owner/);
    });

    it('should soft-delete user and revoke sessions on success', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        metadata: {},
      });
      (mockPrisma.membership.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.session.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await DataDeletionService.requestUserDeletion(
        'user-1',
        'tenant-1',
        { confirmEmail: 'user@test.com', reason: 'No longer needed' }
      );

      expect(result.success).toBe(true);
      expect(result.gracePeriodDays).toBe(30);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          status: 'deleted',
          deletedAt: expect.any(Date),
        }),
      });
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('cancelUserDeletion()', () => {
    it('should throw when no pending deletion', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        DataDeletionService.cancelUserDeletion('user-1', 'tenant-1')
      ).rejects.toThrow('No pending deletion');
    });

    it('should reactivate user', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        deletedAt: new Date(),
        metadata: {},
      });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await DataDeletionService.cancelUserDeletion(
        'user-1',
        'tenant-1'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          status: 'active',
          deletedAt: null,
        }),
      });
    });
  });

  describe('processExpiredDeletions()', () => {
    it('should return empty when no expired users', async () => {
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await DataDeletionService.processExpiredDeletions();

      expect(result.processed).toBe(0);
      expect(result.anonymized).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should anonymize each expired user', async () => {
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-1', email: 'a@test.com' },
        { id: 'user-2', email: 'b@test.com' },
      ]);
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.session.updateMany as jest.Mock).mockResolvedValue({});
      (mockPrisma.auditEvent.updateMany as jest.Mock).mockResolvedValue({});
      (mockPrisma.membership.deleteMany as jest.Mock).mockResolvedValue({});

      const result = await DataDeletionService.processExpiredDeletions();

      expect(result.processed).toBe(2);
      expect(result.anonymized).toEqual(['user-1', 'user-2']);
      expect(result.errors).toEqual([]);
    });

    it('should report errors without stopping batch', async () => {
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-1', email: 'a@test.com' },
        { id: 'user-2', email: 'b@test.com' },
      ]);
      (mockPrisma.user.update as jest.Mock)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('DB error'));
      (mockPrisma.session.updateMany as jest.Mock).mockResolvedValue({});
      (mockPrisma.auditEvent.updateMany as jest.Mock).mockResolvedValue({});
      (mockPrisma.membership.deleteMany as jest.Mock).mockResolvedValue({});

      const result = await DataDeletionService.processExpiredDeletions();

      expect(result.processed).toBe(2);
      expect(result.anonymized).toEqual(['user-1']);
      expect(result.errors.length).toBe(1);
    });
  });
});
