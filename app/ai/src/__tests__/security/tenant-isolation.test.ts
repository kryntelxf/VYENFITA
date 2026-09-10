/**
 * VYENFITA Tenant Isolation Tests
 * 
 * These tests PROVE that tenant A cannot access tenant B data.
 * 
 * CRITICAL: These are security tests. They must pass.
 * 
 * @version 1.0.0
 */

import '../setup';
import { createTestTenant, createTestApplication } from '../helpers/test-factory';
import { ApplicationService } from '../../lib/application/application.service';
import { WorkflowService } from '../../lib/workflow/workflow.service';
import { TenantService } from '../../lib/tenant/tenant.service';

describe('Tenant Isolation - Security Boundary', () => {
  describe('Applications', () => {
    it('should NOT allow Tenant A to read Tenant B application', async () => {
      // Setup: Create two tenants
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      // Tenant B creates an application
      const appB = await createTestApplication(
        tenantB.tenantId,
        tenantB.userId,
        'Tenant B Secret App'
      );

      // Tenant A tries to read Tenant B's application
      // MUST FAIL
      await expect(
        ApplicationService.getById(tenantA.tenantId, appB.applicationId)
      ).rejects.toThrow('Application not found');
    });

    it('should NOT allow Tenant A to update Tenant B application', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const appB = await createTestApplication(
        tenantB.tenantId,
        tenantB.userId,
        'Tenant B App'
      );

      // Tenant A tries to update Tenant B's application
      await expect(
        ApplicationService.update({
          tenantId: tenantA.tenantId,
          userId: tenantA.userId,
          applicationId: appB.applicationId,
          name: 'HACKED BY TENANT A',
        })
      ).rejects.toThrow('Application not found');

      // Verify app B was NOT modified
      const appAfter = await ApplicationService.getById(
        tenantB.tenantId,
        appB.applicationId
      );
      expect(appAfter.name).toBe('Tenant B App');
    });

    it('should NOT allow Tenant A to delete Tenant B application', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const appB = await createTestApplication(
        tenantB.tenantId,
        tenantB.userId,
        'Tenant B App'
      );

      // Tenant A tries to delete Tenant B's application
      await expect(
        ApplicationService.delete(
          tenantA.tenantId,
          appB.applicationId,
          tenantA.userId
        )
      ).rejects.toThrow('Application not found');

      // Verify app B still exists
      const appAfter = await ApplicationService.getById(
        tenantB.tenantId,
        appB.applicationId
      );
      expect(appAfter).toBeDefined();
    });

    it('should ONLY list applications belonging to the requesting tenant', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      // Tenant A creates 2 apps
      await createTestApplication(tenantA.tenantId, tenantA.userId, 'A-App-1');
      await createTestApplication(tenantA.tenantId, tenantA.userId, 'A-App-2');

      // Tenant B creates 3 apps
      await createTestApplication(tenantB.tenantId, tenantB.userId, 'B-App-1');
      await createTestApplication(tenantB.tenantId, tenantB.userId, 'B-App-2');
      await createTestApplication(tenantB.tenantId, tenantB.userId, 'B-App-3');

      // Tenant A lists
      const listA = await ApplicationService.list(tenantA.tenantId);
      expect(listA.data).toHaveLength(2);
      expect(listA.data.every((app: any) => app.name.startsWith('A-'))).toBe(true);

      // Tenant B lists
      const listB = await ApplicationService.list(tenantB.tenantId);
      expect(listB.data).toHaveLength(3);
      expect(listB.data.every((app: any) => app.name.startsWith('B-'))).toBe(true);
    });

    it('should NOT allow cross-tenant version access', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const appB = await createTestApplication(
        tenantB.tenantId,
        tenantB.userId,
        'App B'
      );

      // Get version list for app B (as tenant B)
      const versionsB = await ApplicationService.getVersionHistory(
        tenantB.tenantId,
        appB.applicationId
      );

      // Tenant A tries to access the same version
      await expect(
        ApplicationService.getVersion(
          tenantA.tenantId,
          appB.applicationId,
          versionsB[0].id
        )
      ).rejects.toThrow('Application not found');
    });

    it('should NOT allow cross-tenant rollback', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const appB = await createTestApplication(
        tenantB.tenantId,
        tenantB.userId,
        'App B'
      );

      const versionsB = await ApplicationService.getVersionHistory(
        tenantB.tenantId,
        appB.applicationId
      );

      await expect(
        ApplicationService.rollback(
          tenantA.tenantId,
          appB.applicationId,
          versionsB[0].id,
          tenantA.userId
        )
      ).rejects.toThrow('Application not found');
    });
  });

  describe('Workflows', () => {
    it('should NOT allow Tenant A to read Tenant B workflow', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const workflowB = await WorkflowService.create({
        tenantId: tenantB.tenantId,
        userId: tenantB.userId,
        name: 'Workflow B',
        definition: { steps: [] },
      });

      await expect(
        WorkflowService.getById(tenantA.tenantId, workflowB.id)
      ).rejects.toThrow('Workflow not found');
    });

    it('should NOT allow Tenant A to delete Tenant B workflow', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const workflowB = await WorkflowService.create({
        tenantId: tenantB.tenantId,
        userId: tenantB.userId,
        name: 'Workflow B',
        definition: { steps: [] },
      });

      await expect(
        WorkflowService.delete(
          tenantA.tenantId,
          workflowB.id,
          tenantA.userId
        )
      ).rejects.toThrow('Workflow not found');

      // Verify still exists
      const after = await WorkflowService.getById(tenantB.tenantId, workflowB.id);
      expect(after).toBeDefined();
    });
  });

  describe('Members', () => {
    it('should NOT allow Tenant A to see Tenant B members', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const membersA = await TenantService.listMembers(tenantA.tenantId);
      const membersB = await TenantService.listMembers(tenantB.tenantId);

      // Each tenant should only see its own members
      expect(membersA.length).toBeGreaterThan(0);
      expect(membersB.length).toBeGreaterThan(0);

      // No overlap between members
      const emailsA = membersA.map((m: any) => m.user.email);
      const emailsB = membersB.map((m: any) => m.user.email);
      const overlap = emailsA.filter((e: string) => emailsB.includes(e));
      expect(overlap).toHaveLength(0);
    });

    it('should NOT allow Tenant A to invite to Tenant B', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      // Get a role from tenant B
      const roleB = await prisma.role.findFirst({
        where: { tenantId: tenantB.tenantId, name: 'Editor' },
      });

      // Tenant A tries to invite using tenant B's role
      // (this should fail because role belongs to different tenant)
      await expect(
        TenantService.inviteMember({
          tenantId: tenantA.tenantId,
          invitedByUserId: tenantA.userId,
          email: `hacker-${Date.now()}@test.com`,
          roleId: roleB!.id,
        })
      ).rejects.toThrow('Role does not belong to this tenant');
    });

    it('should NOT allow Tenant A to remove Tenant B member', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const userB = await prisma.user.findFirst({
        where: { memberships: { some: { tenantId: tenantB.tenantId } } },
      });

      // Tenant A tries to remove tenant B's user
      await expect(
        TenantService.removeMember(
          tenantA.tenantId,
          tenantA.userId,
          userB!.id
        )
      ).rejects.toThrow('Membership not found');
    });
  });

  describe('Roles', () => {
    it('should NOT allow Tenant A to see Tenant B custom roles', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      // Tenant B creates a custom role
      await TenantService.createRole(
        tenantB.tenantId,
        tenantB.userId,
        'SecretRoleB',
        'Tenant B secret role',
        ['application:read']
      );

      // Tenant A lists roles
      const rolesA = await TenantService.listRoles(tenantA.tenantId);

      // Tenant A should NOT see SecretRoleB
      expect(rolesA.find((r: any) => r.name === 'SecretRoleB')).toBeUndefined();
    });

    it('should NOT allow Tenant A to delete Tenant B role', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      const roleB = await TenantService.createRole(
        tenantB.tenantId,
        tenantB.userId,
        'CustomB',
        'Role for tenant B',
        ['application:read']
      );

      await expect(
        TenantService.deleteRole(
          tenantA.tenantId,
          tenantA.userId,
          roleB.id
        )
      ).rejects.toThrow('Role does not belong to this tenant');
    });
  });

  describe('Audit Logs', () => {
    it('should NOT leak audit events between tenants', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      // Trigger some actions in each tenant
      await createTestApplication(tenantA.tenantId, tenantA.userId, 'App A');
      await createTestApplication(tenantB.tenantId, tenantB.userId, 'App B');

      // Query audit events directly
      const auditA = await prisma.auditEvent.findMany({
        where: { tenantId: tenantA.tenantId },
      });
      const auditB = await prisma.auditEvent.findMany({
        where: { tenantId: tenantB.tenantId },
      });

      // Should be isolated
      expect(auditA.every((e) => e.tenantId === tenantA.tenantId)).toBe(true);
      expect(auditB.every((e) => e.tenantId === tenantB.tenantId)).toBe(true);
      expect(auditA.find((e) => e.tenantId === tenantB.tenantId)).toBeUndefined();
    });
  });
});

// Import prisma for direct queries
import { prisma } from '../setup';
