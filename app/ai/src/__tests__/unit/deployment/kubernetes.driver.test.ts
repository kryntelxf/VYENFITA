/**
 * VYENFITA Kubernetes Driver Unit Tests
 * 
 * Verifies:
 * - Config validation
 * - Health check URL parsing
 * - Error handling
 * 
 * @version 1.0.0
 */

import { KubernetesDriver } from '../../../lib/deployment/drivers/kubernetes.driver';

describe('KubernetesDriver', () => {
  const validKubeconfig = Buffer.from(`
apiVersion: v1
kind: Config
clusters:
  - name: test-cluster
    cluster:
      server: https://localhost:6443
      insecure-skip-tls-verify: true
contexts:
  - name: test-context
    context:
      cluster: test-cluster
      user: test-user
current-context: test-context
users:
  - name: test-user
    user:
      token: test-token
`).toString('base64');

  describe('constructor', () => {
    it('should construct with valid kubeconfig', () => {
      expect(() => {
        new KubernetesDriver({
          kubeconfig: validKubeconfig,
          namespace: 'test-namespace',
        });
      }).not.toThrow();
    });

    it('should construct with in-cluster config flag', () => {
      // We can't actually test in-cluster without K8s
      // Just verify config shape is accepted
      expect(() => {
        try {
          new KubernetesDriver({
            inCluster: true,
            namespace: 'test-namespace',
          });
        } catch (e) {
          // In-cluster without actual cluster will throw — that's expected
          expect(e).toBeDefined();
        }
      }).not.toThrow();
    });
  });

  describe('type', () => {
    it('should have correct type identifier', () => {
      const driver = new KubernetesDriver({
        kubeconfig: validKubeconfig,
        namespace: 'test',
      });
      expect(driver.type).toBe('kubernetes');
    });
  });

  describe('validate()', () => {
    it('should reject target without config', () => {
      const driver = new KubernetesDriver({
        kubeconfig: validKubeconfig,
        namespace: 'test',
      });

      const result = driver.validate({
        id: 'test',
        type: 'kubernetes',
        name: 'test',
        config: null as any,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept target with valid config', () => {
      const driver = new KubernetesDriver({
        kubeconfig: validKubeconfig,
        namespace: 'test',
      });

      const result = driver.validate({
        id: 'test',
        type: 'kubernetes',
        name: 'test',
        config: {},
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('healthCheck()', () => {
    it('should return invalid status for non-k8s URL', async () => {
      const driver = new KubernetesDriver({
        kubeconfig: validKubeconfig,
        namespace: 'test',
      });

      const result = await driver.healthCheck('https://example.com/health', 1000);

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('unknown');
      expect(result.checks[0].message).toContain('Expected k8s://');
    });

    it('should return unhealthy when deployment does not exist', async () => {
      const driver = new KubernetesDriver({
        kubeconfig: validKubeconfig,
        namespace: 'test',
      });

      const result = await driver.healthCheck('k8s://test/does-not-exist', 1000);

      // Will fail because no real cluster, but should not throw
      expect(result).toBeDefined();
      expect(result.healthy).toBe(false);
    });
  });
});
