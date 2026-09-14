/**
 * VYENFITA Application CRUD Integration Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { createTestTenant, createTestApplication } from '../helpers/test-factory';
import { ApplicationService } from '../../lib/application/application.service';

describe('Application CRUD Integration', () => {
  describe('create', () => {
    it('should create an application with initial version', async () => {
      const tenant = await createTestTenant('crud-create');

      const app = await ApplicationService.create({
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        name: 'My App',
        description: 'Test',
        spec: { metadata: {}, entities: [] },
      });

      expect(app.id).toBeDefined();
      expect(app.name).toBe('My App');
      expect(app.currentVersionId).toBeDefined();
    });

    it('should reject duplicate slug in same tenant', async () => {
      const tenant = await createTestTenant('crud-dup');

      await ApplicationService.create({
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        name: 'My App',
        slug: 'my-app',
        spec: {},
      });

      await expect(
        ApplicationService.create({
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          name: 'My App 2',
          slug: 'my-app',
          spec: {},
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('read', () => {
    it('should get application by ID', async () => {
      const tenant = await createTestTenant('crud-read');
      const { applicationId } = await createTestApplication(
        tenant.tenantId,
        tenant.userId,
        'Test App'
      );

      const app = await ApplicationService.getById(tenant.tenantId, applicationId);
      expect(app.name).toBe('Test App');
    });

    it('should list applications with pagination', async () => {
      const tenant = await createTestTenant('crud-list');

      for (let i = 0; i < 5; i++) {
        await createTestApplication(tenant.tenantId, tenant.userId, `App ${i}`);
      }

      const result = await ApplicationService.list(tenant.tenantId, {
        page: 1,
        limit: 3,
      });

      expect(result.data.length).toBe(3);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.hasNext).toBe(true);
    });
  });

  describe('update', () => {
    it('should update and create new version when spec changes', async () => {
      const tenant = await createTestTenant('crud-update');
      const { applicationId } = await createTestApplication(
        tenant.tenantId,
        tenant.userId,
        'Update Test'
      );

      const updated = await ApplicationService.update({
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        applicationId,
        name: 'Updated Name',
        spec: { metadata: { name: 'Updated' }, entities: [] },
        changeLog: 'Updated spec',
      });

      expect(updated.name).toBe('Updated Name');

      const versions = await ApplicationService.getVersionHistory(
        tenant.tenantId,
        applicationId
      );
      expect(versions.length).toBe(2);
    });
  });

  describe('delete', () => {
    it('should soft delete application', async () => {
      const tenant = await createTestTenant('crud-delete');
      const { applicationId } = await createTestApplication(
        tenant.tenantId,
        tenant.userId,
        'Delete Test'
      );

      await ApplicationService.delete(tenant.tenantId, applicationId, tenant.userId);

      await expect(
        ApplicationService.getById(tenant.tenantId, applicationId)
      ).rejects.toThrow('not found');
    });
  });

  describe('rollback', () => {
    it('should rollback to previous version', async () => {
      const tenant = await createTestTenant('crud-rollback');
      const { applicationId } = await createTestApplication(
        tenant.tenantId,
        tenant.userId,
        'Rollback Test'
      );

      // Update to v2
      await ApplicationService.update({
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        applicationId,
        spec: { metadata: { name: 'V2' }, entities: [] },
        changeLog: 'v2',
      });

      const versions = await ApplicationService.getVersionHistory(
        tenant.tenantId,
        applicationId
      );
      const v1 = versions.find((v: any) => v.version === '1.0.0');
      expect(v1).toBeDefined();

      // Rollback to v1
      const result = await ApplicationService.rollback(
        tenant.tenantId,
        applicationId,
        v1.id,
        tenant.userId
      );

      expect(result.version.version).toBe('1.0.1');
    });
  });
});
