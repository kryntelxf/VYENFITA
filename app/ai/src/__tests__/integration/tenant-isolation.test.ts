/**
 * VYENFITA Tenant Isolation Integration Tests
 * 
 * CRITICAL: These tests prove tenant isolation works.
 * 
 * @version 1.0.0
 */

import '../setup';
import { createTestTenant, createTestApplication } from '../helpers/test-factory';
import { ApplicationService } from '../../lib/application/application.service';
import { WorkflowService } from '../../lib/workflow/workflow.service';

describe('Tenant Isolation', () => {
  let tenantA: any;
  let tenantB: any;

  beforeEach(async () => {
    tenantA = await createTestTenant('iso-a');
    tenantB = await createTestTenant('iso-b');
  });

  describe('applications', () => {
    it('should NOT allow Tenant A to read Tenant B application', async () => {
      const appB = await createTestApplication(
        tenantB.tenantId,
        tenantB.userId,
        'Secret B App'
      );

      await expect(
        ApplicationService.getById(tenantA.tenantId, appB.applicationId)
      ).rejects.toThrow('not found');
    });

    it('should NOT allow Tenant A to update Tenant B application', async () => {
      const appB = await createTestApplication(
        tenantB.tenantId,
        tenantB.userId,
        'Secret B App'
      );

      await expect(
        ApplicationService.update({
          tenantId: tenantA.tenantId,
          userId: tenantA.userId,
          applicationId: appB.applicationId,
          name: 'HACKED',
        })
      ).rejects.toThrow('not found');
    });

    it('should NOT allow Tenant A to delete Tenant B application', async () => {
      const appB = await createTestApplication(
        tenantB.tenantId,
        tenantB.userId,
        'Secret B App'
      );

      await expect(
        ApplicationService.delete(
          tenantA.tenantId,
          appB.applicationId,
          tenantA.userId
        )
      ).rejects.toThrow('not found');

      // Verify still exists
      const still = await ApplicationService.getById(
        tenantB.tenantId,
        appB.applicationId
      );
      expect(still).toBeDefined();
    });

    it('should only list applications from requesting tenant', async () => {
      await createTestApplication(tenantA.tenantId, tenantA.userId, 'A-1');
      await createTestApplication(tenantA.tenantId, tenantA.userId, 'A-2');
      await createTestApplication(tenantB.tenantId, tenantB.userId, 'B-1');

      const listA = await ApplicationService.list(tenantA.tenantId);
      const listB = await ApplicationService.list(tenantB.tenantId);

      expect(listA.data.length).toBe(2);
      expect(listB.data.length).toBe(1);

      expect(listA.data.every((a: any) => a.name.startsWith('A-'))).toBe(true);
      expect(listB.data.every((a: any) => a.name.startsWith('B-'))).toBe(true);
    });
  });

  describe('workflows', () => {
    it('should NOT allow Tenant A to read Tenant B workflow', async () => {
      const workflowB = await WorkflowService.create({
        tenantId: tenantB.tenantId,
        userId: tenantB.userId,
        name: 'B Workflow',
        definition: { steps: [{ id: 's1', type: 'set_variable', config: { variables: {} } }] },
      });

      await expect(
        WorkflowService.getById(tenantA.tenantId, workflowB.id)
      ).rejects.toThrow('not found');
    });

    it('should NOT allow Tenant A to delete Tenant B workflow', async () => {
      const workflowB = await WorkflowService.create({
        tenantId: tenantB.tenantId,
        userId: tenantB.userId,
        name: 'B Workflow',
        definition: { steps: [{ id: 's1', type: 'set_variable', config: { variables: {} } }] },
      });

      await expect(
        WorkflowService.delete(tenantA.tenantId, workflowB.id, tenantA.userId)
      ).rejects.toThrow('not found');
    });
  });
});
