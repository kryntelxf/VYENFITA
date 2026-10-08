/**
 * VYENFITA GCP Cloud Run Driver Unit Tests
 * 
 * Verifies:
 * - Config validation
 * - Health check logic
 * - Error handling without real GCP API
 * 
 * @version 1.0.0
 */

import {
  GCPCloudRunDriver,
  GCPCloudRunConfig,
} from '../../../lib/deployment/drivers/gcp-cloud-run.driver';

describe('GCPCloudRunDriver', () => {
  const validConfig: GCPCloudRunConfig = {
    projectId: 'test-project-123',
    region: 'us-central1',
    accessToken: 'test-access-token',
  };

  describe('constructor', () => {
    it('should construct with valid config', () => {
      expect(() => new GCPCloudRunDriver(validConfig)).not.toThrow();
    });

    it('should construct with service account JSON', () => {
      const saConfig: GCPCloudRunConfig = {
        projectId: 'test-project',
        region: 'us-central1',
        serviceAccountJson: Buffer.from(JSON.stringify({
          type: 'service_account',
          project_id: 'test-project',
          private_key: 'fake',
          client_email: 'test@test.iam.gserviceaccount.com',
        })).toString('base64'),
      };
      expect(() => new GCPCloudRunDriver(saConfig)).not.toThrow();
    });
  });

  describe('type', () => {
    it('should have correct type identifier', () => {
      const driver = new GCPCloudRunDriver(validConfig);
      expect(driver.type).toBe('gcp-cloud-run');
    });
  });

  describe('validate()', () => {
    it('should accept valid target config', () => {
      const driver = new GCPCloudRunDriver(validConfig);
      const result = driver.validate({
        id: 'test-target',
        type: 'gcp-cloud-run',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject when projectId is missing', () => {
      const driver = new GCPCloudRunDriver({
        ...validConfig,
        projectId: '',
      });

      const result = driver.validate({
        id: 'test',
        type: 'gcp-cloud-run',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('projectId is required');
    });

    it('should reject when region is missing', () => {
      const driver = new GCPCloudRunDriver({
        ...validConfig,
        region: '',
      });

      const result = driver.validate({
        id: 'test',
        type: 'gcp-cloud-run',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('region is required');
    });

    it('should reject when neither serviceAccountJson nor accessToken is set', () => {
      const driver = new GCPCloudRunDriver({
        projectId: 'test',
        region: 'us-central1',
      });

      const result = driver.validate({
        id: 'test',
        type: 'gcp-cloud-run',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('serviceAccountJson'))).toBe(true);
    });

    it('should report multiple errors at once', () => {
      const driver = new GCPCloudRunDriver({
        projectId: '',
        region: '',
      });

      const result = driver.validate({
        id: 'test',
        type: 'gcp-cloud-run',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('healthCheck()', () => {
    it('should return unhealthy for unreachable HTTPS URL', async () => {
      const driver = new GCPCloudRunDriver(validConfig);
      const result = await driver.healthCheck('https://10.255.255.1:9999', 500);

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('unhealthy');
      expect(result.timestamp).toBeInstanceOf(Date);
    }, 10000);

    it('should return result for gcp-cloud-run:// URL when API fails', async () => {
      const driver = new GCPCloudRunDriver({
        ...validConfig,
        projectId: 'invalid-project-xyz',
        accessToken: 'invalid-token',
      });

      const result = await driver.healthCheck(
        'gcp-cloud-run://us-central1/test-service',
        1000
      );

      expect(result).toBeDefined();
      expect(result.healthy).toBe(false);
      expect(result.checks.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('deploy() - graceful failure without real GCP', () => {
    it('should return failed result when GCP API is unreachable', async () => {
      const driver = new GCPCloudRunDriver({
        projectId: 'invalid-project-xyz',
        region: 'us-central1',
        accessToken: 'invalid-token',
      });

      const logs: any[] = [];
      const logger = (entry: any) => logs.push(entry);

      const result = await driver.deploy(
        {
          id: 'artifact-1',
          applicationId: 'app-1',
          version: '1.0.0',
          path: '/tmp/artifact',
          sizeBytes: 100,
          checksum: 'abc',
          createdAt: new Date(),
          metadata: {},
        },
        {
          tenantId: 'tenant-1',
          applicationId: 'app-1',
          environmentId: 'env-1',
          versionId: 'version-1',
          target: {
            id: 'target-1',
            type: 'gcp-cloud-run',
            name: 'test',
            config: {},
          },
        },
        logger
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(logs.some((l) => l.message.includes('Cloud Run'))).toBe(true);
    }, 60000);

    it('should fail fast when no auth configured', async () => {
      const driver = new GCPCloudRunDriver({
        projectId: 'test',
        region: 'us-central1',
        // no accessToken, no serviceAccountJson
      });

      const logs: any[] = [];
      const result = await driver.deploy(
        {
          id: 'artifact-1',
          applicationId: 'app-1',
          version: '1.0.0',
          path: '/tmp/artifact',
          sizeBytes: 100,
          checksum: 'abc',
          createdAt: new Date(),
          metadata: {},
        },
        {
          tenantId: 'tenant-1',
          applicationId: 'app-1',
          environmentId: 'env-1',
          versionId: 'version-1',
          target: {
            id: 'target-1',
            type: 'gcp-cloud-run',
            name: 'test',
            config: {},
          },
        },
        (e) => logs.push(e)
      );

      expect(result.success).toBe(false);
      // Error should mention authentication
      expect(result.error).toMatch(/auth|token|service account/i);
    }, 30000);
  });

  describe('remove() - graceful failure', () => {
    it('should not throw when removing with invalid credentials', async () => {
      const driver = new GCPCloudRunDriver({
        projectId: 'test',
        region: 'us-central1',
        accessToken: 'invalid-token',
      });

      await expect(
        driver.remove('test-service', {
          id: 'target-1',
          type: 'gcp-cloud-run',
          name: 'test',
          config: {},
        })
      ).resolves.not.toThrow();
    }, 15000);
  });
});
