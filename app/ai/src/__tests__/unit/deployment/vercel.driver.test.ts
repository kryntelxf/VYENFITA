/**
 * VYENFITA Vercel Driver Unit Tests
 * 
 * Verifies:
 * - Config validation
 * - Health check logic
 * - Error handling without real Vercel API
 * 
 * @version 1.0.0
 */

import {
  VercelDriver,
  VercelConfig,
} from '../../../lib/deployment/drivers/vercel.driver';

describe('VercelDriver', () => {
  const validConfig: VercelConfig = {
    token: 'test-vercel-token',
    teamId: 'team-123',
    projectName: 'test-project',
  };

  describe('constructor', () => {
    it('should construct with valid config', () => {
      expect(() => new VercelDriver(validConfig)).not.toThrow();
    });

    it('should construct with minimal config (token only)', () => {
      const minimalConfig: VercelConfig = {
        token: 'test-token',
      };
      expect(() => new VercelDriver(minimalConfig)).not.toThrow();
    });
  });

  describe('type', () => {
    it('should have correct type identifier', () => {
      const driver = new VercelDriver(validConfig);
      expect(driver.type).toBe('vercel');
    });
  });

  describe('validate()', () => {
    it('should accept valid target config', () => {
      const driver = new VercelDriver(validConfig);
      const result = driver.validate({
        id: 'test-target',
        type: 'vercel',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject when token is missing', () => {
      const driver = new VercelDriver({
        ...validConfig,
        token: '',
      });

      const result = driver.validate({
        id: 'test',
        type: 'vercel',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('token is required');
    });

    it('should report error when token empty', () => {
      const driver = new VercelDriver({
        token: '',
      });

      const result = driver.validate({
        id: 'test',
        type: 'vercel',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('healthCheck()', () => {
    it('should return unhealthy for unreachable URL', async () => {
      const driver = new VercelDriver(validConfig);
      const result = await driver.healthCheck('https://10.255.255.1:9999', 500);

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('unhealthy');
      expect(result.checks[0].name).toBe('http_response');
      expect(result.checks[0].status).toBe('fail');
      expect(result.timestamp).toBeInstanceOf(Date);
    }, 10000);

    it('should return healthy for reachable URL', async () => {
      const driver = new VercelDriver(validConfig);
      // Use a URL that should be reachable from CI
      // (Example.com returns 200 with simple HTML)
      const result = await driver.healthCheck('https://example.com', 5000);

      expect(result.healthy).toBe(true);
      expect(result.status).toBe('healthy');
      expect(result.checks[0].status).toBe('pass');
      expect(result.checks[0].latencyMs).toBeGreaterThan(0);
    }, 10000);
  });

  describe('deploy() - graceful failure without real Vercel', () => {
    it('should return failed result when Vercel API rejects token', async () => {
      const driver = new VercelDriver({
        token: 'invalid-token-xyz-123',
        projectName: 'test-deploy-fail',
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
            type: 'vercel',
            name: 'test',
            config: {},
          },
        },
        logger
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Should have logged the start
      expect(logs.some((l) => l.message.includes('Vercel'))).toBe(true);
    }, 30000);

    it('should return fail result with error message on API error', async () => {
      const driver = new VercelDriver({
        token: 'invalid',
        projectName: 'test',
      });

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
            type: 'vercel',
            name: 'test',
            config: {},
          },
        },
        () => {}
      );

      expect(result.success).toBe(false);
      expect(result.deploymentId).toBe('');
      expect(typeof result.error).toBe('string');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('remove() - graceful failure', () => {
    it('should not throw when removing with invalid token', async () => {
      const driver = new VercelDriver({
        token: 'invalid-token',
      });

      await expect(
        driver.remove('invalid-deployment-id', {
          id: 'target-1',
          type: 'vercel',
          name: 'test',
          config: {},
        })
      ).resolves.not.toThrow();
    }, 15000);
  });
});
