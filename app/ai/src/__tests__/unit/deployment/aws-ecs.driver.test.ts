/**
 * VYENFITA AWS ECS Driver Unit Tests
 * 
 * Verifies:
 * - Config validation
 * - Health check URL parsing
 * - Error handling without real AWS API
 * 
 * NOTE: Full integration test with real AWS requires credentials
 * and lives in the manual test workflow (cloud-driver-manual-test.yml).
 * 
 * @version 1.0.0
 */

import { AWSECSDriver, AWSECSConfig } from '../../../lib/deployment/drivers/aws-ecs.driver';

describe('AWSECSDriver', () => {
  const validConfig: AWSECSConfig = {
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    cluster: 'test-cluster',
    subnets: ['subnet-1', 'subnet-2'],
    securityGroups: ['sg-1'],
    executionRoleArn: 'arn:aws:iam::123456789012:role/ecsTaskExecutionRole',
    logGroup: '/ecs/vyenfita-test',
  };

  describe('constructor', () => {
    it('should construct with valid config', () => {
      expect(() => new AWSECSDriver(validConfig)).not.toThrow();
    });

    it('should construct with minimal config', () => {
      const minimalConfig: AWSECSConfig = {
        region: 'us-west-2',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        cluster: 'cluster',
        subnets: [],
        securityGroups: [],
        executionRoleArn: 'arn:aws:iam::123:role/test',
      };
      expect(() => new AWSECSDriver(minimalConfig)).not.toThrow();
    });
  });

  describe('type', () => {
    it('should have correct type identifier', () => {
      const driver = new AWSECSDriver(validConfig);
      expect(driver.type).toBe('aws-ecs');
    });
  });

  describe('validate()', () => {
    it('should accept valid target config', () => {
      const driver = new AWSECSDriver(validConfig);
      const result = driver.validate({
        id: 'test-target',
        type: 'aws-ecs',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject when cluster is missing', () => {
      const driver = new AWSECSDriver({
        ...validConfig,
        cluster: '',
      });

      const result = driver.validate({
        id: 'test',
        type: 'aws-ecs',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cluster is required');
    });

    it('should reject when subnets are empty', () => {
      const driver = new AWSECSDriver({
        ...validConfig,
        subnets: [],
      });

      const result = driver.validate({
        id: 'test',
        type: 'aws-ecs',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('at least one subnet is required');
    });

    it('should reject when executionRoleArn is missing', () => {
      const driver = new AWSECSDriver({
        ...validConfig,
        executionRoleArn: '',
      });

      const result = driver.validate({
        id: 'test',
        type: 'aws-ecs',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('executionRoleArn is required');
    });

    it('should report multiple errors at once', () => {
      const driver = new AWSECSDriver({
        ...validConfig,
        cluster: '',
        subnets: [],
        executionRoleArn: '',
      });

      const result = driver.validate({
        id: 'test',
        type: 'aws-ecs',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('healthCheck()', () => {
    it('should return unknown status for non-ecs URL', async () => {
      const driver = new AWSECSDriver(validConfig);
      const result = await driver.healthCheck('https://example.com/health', 1000);

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('unknown');
      expect(result.checks[0].name).toBe('url_format');
      expect(result.checks[0].status).toBe('fail');
    });

    it('should return unhealthy when ECS API call fails', async () => {
      const driver = new AWSECSDriver({
        ...validConfig,
        // Invalid credentials so the API call fails
        accessKeyId: 'invalid',
        secretAccessKey: 'invalid',
      });

      const result = await driver.healthCheck('ecs://test-cluster/test-service', 1000);

      // Should not throw
      expect(result).toBeDefined();
      expect(result.healthy).toBe(false);
      expect(result.status).toBe('unhealthy');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should include check details on failure', async () => {
      const driver = new AWSECSDriver({
        ...validConfig,
        accessKeyId: 'invalid',
        secretAccessKey: 'invalid',
      });

      const result = await driver.healthCheck('ecs://cluster/service', 1000);

      expect(result.checks).toBeDefined();
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checks[0]).toHaveProperty('name');
      expect(result.checks[0]).toHaveProperty('status');
    });
  });

  describe('deploy() - graceful failure without real AWS', () => {
    it('should return failed result when AWS API is unreachable', async () => {
      const driver = new AWSECSDriver({
        ...validConfig,
        accessKeyId: 'invalid-key',
        secretAccessKey: 'invalid-secret',
        region: 'invalid-region-12345',
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
            type: 'aws-ecs',
            name: 'test',
            config: {},
          },
        },
        logger
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      // Should have logged at least "Starting AWS ECS deployment"
      expect(logs.some((l) => l.message.includes('AWS ECS'))).toBe(true);
    }, 60000);
  });

  describe('remove() - graceful failure', () => {
    it('should not throw when removing non-existent deployment', async () => {
      const driver = new AWSECSDriver({
        ...validConfig,
        accessKeyId: 'invalid',
        secretAccessKey: 'invalid',
      });

      await expect(
        driver.remove('ecs://test-cluster/non-existent', {
          id: 'target-1',
          type: 'aws-ecs',
          name: 'test',
          config: {},
        })
      ).resolves.not.toThrow();
    }, 30000);
  });
});
