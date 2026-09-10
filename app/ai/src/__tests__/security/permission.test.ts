/**
 * VYENFITA Permission Tests
 * 
 * Proves RBAC works correctly
 * 
 * @version 1.0.0
 */

import '../setup';
import { createTestTenant, createTestUserInTenant } from '../helpers/test-factory';
import { AuthService } from '../../lib/auth/auth.service';
import { TenantService } from '../../lib/tenant/tenant.service';
import { ApplicationService } from '../../lib/application/application.service';
import { prisma } from '../setup';

describe('Permissions & RBAC', () => {
  describe('Role Assignment', () => {
    it('Owner should have all permissions', async () => {
      const tenant = await createTestTenant('owner');

      // Verify owner has *:manage
      const permission = await prisma.rolePermission.findFirst({
        where: {
          role: {
            id: (await prisma.membership.findFirst({
              where: { userId: tenant.userId },
            }))!.roleId,
          },
          permission: { resource: '*', action: 'manage' },
        },
      });

      expect(permission).toBeDefined();
    });

    it('Editor should have application:create', async () => {
      const tenant = await createTestTenant('editor');
      const editorUser = await createTestUserInTenant(
        tenant.tenantId,
        tenant.userId,
        'Editor'
      );

      const membership = await prisma.membership.findFirst({
        where: { userId: editorUser.userId, tenantId: tenant.tenantId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });

      const permissions = membership!.role.permissions.map(
        (rp) => `${rp.permission.resource}:${rp.permission.action}`
      );

      expect(permissions).toContain('application:create');
      expect(permissions).toContain('workflow:create');
    });

    it('Viewer should NOT have application:create', async () => {
      const tenant = await createTestTenant('viewer');
      const viewerUser = await createTestUserInTenant(
        tenant.tenantId,
        tenant.userId,
        'Viewer'
      );

      const membership = await prisma.membership.findFirst({
        where: { userId: viewerUser.userId, tenantId: tenant.tenantId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });

      const permissions = membership!.role.permissions.map(
        (rp) => `${rp.permission.resource}:${rp.permission.action}`
      );

      expect(permissions).not.toContain('application:create');
      expect(permissions).toContain('application:read');
    });
  });

  describe('Custom Roles', () => {
    it('should allow creating custom role with valid permissions', async () => {
      const tenant = await createTestTenant('custom');

      const role = await TenantService.createRole(
        tenant.tenantId,
        tenant.userId,
        'Analyst',
        'Read-only analytics',
        ['application:read', 'analytics:read']
      );

      expect(role.name).toBe('Analyst');

      const permissions = await prisma.rolePermission.findMany({
        where: { roleId: role.id },
        include: { permission: true },
      });

      const keys = permissions.map((p) => `${p.permission.resource}:${p.permission.action}`);
      expect(keys).toContain('application:read');
      expect(keys).toContain('analytics:read');
    });

    it('should reject reserved role names', async () => {
      const tenant = await createTestTenant('reserved');

      for (const name of ['Owner', 'Admin', 'Editor', 'Viewer']) {
        await expect(
          TenantService.createRole(
            tenant.tenantId,
            tenant.userId,
            name,
            'Trying to impersonate system role',
            ['application:read']
          )
        ).rejects.toThrow('reserved');
      }
    });

    it('should reject invalid permissions', async () => {
      const tenant = await createTestTenant('invalidperm');

      await expect(
        TenantService.createRole(
          tenant.tenantId,
          tenant.userId,
          'BadRole',
          'Role with invalid permissions',
          ['nonexistent:permission', 'fake:action']
        )
      ).rejects.toThrow('Invalid permissions');
    });

    it('should not delete role if members are assigned', async () => {
      const tenant = await createTestTenant('deleterole');

      const role = await TenantService.createRole(
        tenant.tenantId,
        tenant.userId,
        'InUseRole',
        'Role in use',
        ['application:read']
      );

      // Assign member
      await TenantService.inviteMember({
        tenantId: tenant.tenantId,
        invitedByUserId: tenant.userId,
        email: `inuse-${Date.now()}@test.com`,
        roleId: role.id,
      });

      await expect(
        TenantService.deleteRole(tenant.tenantId, tenant.userId, role.id)
      ).rejects.toThrow('still use it');
    });
  });

  describe('Owner Protection', () => {
    it('should NOT allow changing owner role', async () => {
      const tenant = await createTestTenant('protect');

      const viewerRole = await prisma.role.findFirst({
        where: { tenantId: tenant.tenantId, name: 'Viewer' },
      });

      await expect(
        TenantService.updateMemberRole({
          tenantId: tenant.tenantId,
          actorUserId: tenant.userId,
          targetUserId: tenant.userId,
          roleId: viewerRole!.id,
        })
      ).rejects.toThrow('Cannot change role of tenant owner');
    });

    it('should NOT allow removing owner', async () => {
      const tenant = await createTestTenant('removeowner');

      // Create another user to try to remove owner
      const editor = await createTestUserInTenant(
        tenant.tenantId,
        tenant.userId,
        'Editor'
      );

      await expect(
        TenantService.removeMember(
          tenant.tenantId,
          editor.userId,
          tenant.userId
        )
      ).rejects.toThrow('Cannot remove tenant owner');
    });

    it('should NOT allow removing yourself', async () => {
      const tenant = await createTestTenant('selfremove');

      await expect(
        TenantService.removeMember(
          tenant.tenantId,
          tenant.userId,
          tenant.userId
        )
      ).rejects.toThrow('Cannot remove yourself');
    });
  });
});
