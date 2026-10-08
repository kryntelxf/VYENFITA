/**
 * VYENFITA Deployment Service Unit Tests
 * 
 * Verifies:
 * - Application/environment/version validation
 * - Driver selection
 * - Config validation
 * 
 * @version 1.0.0
 */

import { DeploymentService } from '../../../lib/deployment/deployment.service';

describe('DeploymentService', () => {
  let service: DeploymentService;

  beforeEach(() => {
    service = new DeploymentService();
  });

  describe('listAvailableTargets()', () => {
    it('should return array of target types', () => {
      const targets = service.listAvailableTargets();

      expect(Array.isArray(targets)).toBe(true);
      expect(targets).toContain('docker');
    });

    it('should return at least docker driver', () => {
      const targets = service.listAvailableTargets();
      expect(targets.length).toBeGreaterThan(0);
    });
  });

  describe('deploy() - input validation', () => {
    it('should reject deploy with non-existent application', async () => {
      await expect(
        service.deploy({
          tenantId: 'nonexistent-tenant',
          userId: 'user-123',
          applicationId: '00000000-0000-0000-0000-000000000000',
          environmentId: '00000000-0000-0000-0000-000000000000',
          versionId: '00000000-0000-0000-0000-000000000000',
          target: {
            type: 'docker',
            name: 'test',
            config: {},
          },
        })
      ).rejects.toThrow('Application not found');
    });
  });

  describe('rollback() - input validation', () => {
    it('should reject rollback for non-existent deployment', async () => {
      await expect(
        service.rollback(
          'nonexistent-tenant',
          '00000000-0000-0000-0000-000000000000',
          'user-123'
        )
      ).rejects.toThrow('Deployment not found');
    });
  });

  describe('remove() - input validation', () => {
    it('should reject remove for non-existent deployment', async () => {
      await expect(
        service.remove('nonexistent-tenant', '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Deployment not found');
    });
  });
});
