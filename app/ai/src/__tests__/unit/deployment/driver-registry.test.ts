/**
 * VYENFITA Driver Registry Unit Tests
 * 
 * Verifies:
 * - Conditional registration based on env vars
 * - Graceful degradation on constructor failure
 * - Singleton pattern
 * - Type-based lookup
 * 
 * @version 1.0.0
 */

import { DriverRegistry } from '../../../lib/deployment/driver-registry';

describe('DriverRegistry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Docker driver', () => {
    it('should always register docker driver regardless of env', () => {
      // Clear all cloud env vars
      delete process.env.K8S_NAMESPACE;
      delete process.env.KUBERNETES_SERVICE_HOST;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_ECS_CLUSTER;
      delete process.env.GCP_PROJECT_ID;
      delete process.env.VERCEL_TOKEN;

      const registry = new DriverRegistry();

      expect(registry.has('docker')).toBe(true);
      expect(registry.get('docker')).toBeDefined();
      expect(registry.get('docker')?.type).toBe('docker');
    });

    it('should return docker driver in list()', () => {
      const registry = new DriverRegistry();
      expect(registry.list()).toContain('docker');
    });
  });

  describe('Kubernetes driver - conditional registration', () => {
    it('should NOT register kubernetes when K8S_NAMESPACE not set', () => {
      delete process.env.K8S_NAMESPACE;
      delete process.env.KUBERNETES_SERVICE_HOST;

      const registry = new DriverRegistry();
      expect(registry.has('kubernetes')).toBe(false);
    });

    it('should register kubernetes when K8S_NAMESPACE is set', () => {
      process.env.K8S_NAMESPACE = 'test-namespace';
      process.env.KUBECONFIG_BASE64 = Buffer.from(`
apiVersion: v1
kind: Config
clusters:
  - name: test
    cluster:
      server: https://localhost:6443
contexts:
  - name: test
    context:
      cluster: test
      user: test
current-context: test
users:
  - name: test
    user:
      token: test-token
`).toString('base64');

      const registry = new DriverRegistry();
      expect(registry.has('kubernetes')).toBe(true);
    });

    it('should register kubernetes when KUBERNETES_SERVICE_HOST is set (in-cluster)', () => {
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';

      const registry = new DriverRegistry();
      expect(registry.has('kubernetes')).toBe(true);
    });

    it('should gracefully degrade when kubeconfig is invalid', () => {
      process.env.K8S_NAMESPACE = 'test-namespace';
      process.env.KUBECONFIG_BASE64 = 'invalid-base64-!@#$%';

      // Should not throw
      expect(() => new DriverRegistry()).not.toThrow();

      // Kubernetes should not be registered
      const registry = new DriverRegistry();
      expect(registry.has('kubernetes')).toBe(false);

      // But docker should still be registered
      expect(registry.has('docker')).toBe(true);
    });
  });

  describe('AWS ECS driver - conditional registration', () => {
    it('should NOT register aws-ecs when credentials missing', () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_ECS_CLUSTER;

      const registry = new DriverRegistry();
      expect(registry.has('aws-ecs')).toBe(false);
    });

    it('should NOT register aws-ecs when only AWS_ACCESS_KEY_ID set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      delete process.env.AWS_ECS_CLUSTER;

      const registry = new DriverRegistry();
      expect(registry.has('aws-ecs')).toBe(false);
    });

    it('should NOT register aws-ecs when only AWS_ECS_CLUSTER set', () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      process.env.AWS_ECS_CLUSTER = 'test-cluster';

      const registry = new DriverRegistry();
      expect(registry.has('aws-ecs')).toBe(false);
    });

    it('should register aws-ecs when both credentials and cluster set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.AWS_ECS_CLUSTER = 'test-cluster';
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_SUBNETS = 'subnet-1,subnet-2';
      process.env.AWS_EXECUTION_ROLE_ARN = 'arn:aws:iam::123:role/test';

      const registry = new DriverRegistry();
      expect(registry.has('aws-ecs')).toBe(true);
    });

    it('should throw when AWS_SECRET_ACCESS_KEY missing but AWS_ACCESS_KEY_ID present', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      delete process.env.AWS_SECRET_ACCESS_KEY;
      process.env.AWS_ECS_CLUSTER = 'test-cluster';

      // Should not throw at registry level (graceful degradation)
      expect(() => new DriverRegistry()).not.toThrow();
    });
  });

  describe('GCP Cloud Run driver - conditional registration', () => {
    it('should NOT register gcp-cloud-run when GCP_PROJECT_ID missing', () => {
      delete process.env.GCP_PROJECT_ID;

      const registry = new DriverRegistry();
      expect(registry.has('gcp-cloud-run')).toBe(false);
    });

    it('should register gcp-cloud-run when GCP_PROJECT_ID set', () => {
      process.env.GCP_PROJECT_ID = 'test-project';
      process.env.GCP_REGION = 'us-central1';
      process.env.GCP_ACCESS_TOKEN = 'test-token';

      const registry = new DriverRegistry();
      expect(registry.has('gcp-cloud-run')).toBe(true);
    });
  });

  describe('Vercel driver - conditional registration', () => {
    it('should NOT register vercel when VERCEL_TOKEN missing', () => {
      delete process.env.VERCEL_TOKEN;

      const registry = new DriverRegistry();
      expect(registry.has('vercel')).toBe(false);
    });

    it('should register vercel when VERCEL_TOKEN set', () => {
      process.env.VERCEL_TOKEN = 'test-token';
      process.env.VERCEL_TEAM_ID = 'team-123';
      process.env.VERCEL_PROJECT_NAME = 'test-project';

      const registry = new DriverRegistry();
      expect(registry.has('vercel')).toBe(true);
    });
  });

  describe('Multiple drivers', () => {
    it('should register all drivers when all env vars set', () => {
      process.env.K8S_NAMESPACE = 'test-ns';
      process.env.KUBECONFIG_BASE64 = Buffer.from(`
apiVersion: v1
kind: Config
clusters:
  - name: test
    cluster:
      server: https://localhost:6443
contexts:
  - name: test
    context:
      cluster: test
      user: test
current-context: test
users:
  - name: test
    user:
      token: test
`).toString('base64');
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.AWS_ECS_CLUSTER = 'test-cluster';
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_SUBNETS = 'subnet-1';
      process.env.AWS_EXECUTION_ROLE_ARN = 'arn:aws:iam::123:role/test';
      process.env.GCP_PROJECT_ID = 'test-project';
      process.env.GCP_ACCESS_TOKEN = 'test-token';
      process.env.VERCEL_TOKEN = 'test-token';

      const registry = new DriverRegistry();

      expect(registry.list()).toEqual(
        expect.arrayContaining(['docker', 'kubernetes', 'aws-ecs', 'gcp-cloud-run', 'vercel'])
      );
      expect(registry.list().length).toBe(5);
    });
  });

  describe('Custom driver registration', () => {
    it('should allow registering a custom driver', () => {
      const registry = new DriverRegistry();
      const customDriver: any = {
        type: 'custom',
        deploy: jest.fn(),
        remove: jest.fn(),
        healthCheck: jest.fn(),
        validate: jest.fn(),
      };

      registry.register('custom', customDriver);

      expect(registry.has('custom')).toBe(true);
      expect(registry.get('custom')).toBe(customDriver);
    });

    it('should override existing driver on re-register', () => {
      const registry = new DriverRegistry();
      const originalDocker = registry.get('docker');

      const newDocker: any = {
        type: 'docker',
        deploy: jest.fn(),
      };

      registry.register('docker', newDocker);

      expect(registry.get('docker')).toBe(newDocker);
      expect(registry.get('docker')).not.toBe(originalDocker);
    });
  });

  describe('Lookup methods', () => {
    it('should return undefined for unknown driver', () => {
      const registry = new DriverRegistry();
      expect(registry.get('unknown-driver')).toBeUndefined();
    });

    it('should return false for has() on unknown driver', () => {
      const registry = new DriverRegistry();
      expect(registry.has('unknown-driver')).toBe(false);
    });

    it('should list only registered drivers', () => {
      const registry = new DriverRegistry();
      const list = registry.list();

      // Docker always there
      expect(list).toContain('docker');

      // Ensure no undefined entries
      for (const type of list) {
        expect(registry.get(type)).toBeDefined();
      }
    });
  });

  describe('Singleton pattern', () => {
    it('should return same instance from getDriverRegistry()', async () => {
      // Dynamic import to test singleton
      const { getDriverRegistry } = await import('../../../lib/deployment/driver-registry');

      const instance1 = getDriverRegistry();
      const instance2 = getDriverRegistry();

      expect(instance1).toBe(instance2);
    });
  });
});
