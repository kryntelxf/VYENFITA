/**
 * VYENFITA Kubernetes Driver Integration Tests
 * 
 * These tests require a REAL Kubernetes cluster (kind, minikube, etc).
 * 
 * They are SKIPPED by default. To run:
 * 
 *   K8S_INTEGRATION_TEST=true \
 *   KUBECONFIG_BASE64=<base64-encoded-kubeconfig> \
 *   K8S_NAMESPACE=vyenfita-test \
 *   yarn jest src/__tests__/integration/deployment/kubernetes.driver.integration.test.ts
 * 
 * In CI, these run via .github/workflows/k8s-driver-test.yml which
 * sets up a kind cluster automatically.
 * 
 * @version 1.0.0
 */

import { KubernetesDriver } from '../../../lib/deployment/drivers/kubernetes.driver';
import {
  DeploymentArtifact,
  DeployRequest,
} from '../../../lib/deployment/deployment.interface';

const SHOULD_RUN = process.env.K8S_INTEGRATION_TEST === 'true';
const KUBECONFIG_B64 = process.env.KUBECONFIG_BASE64;
const NAMESPACE = process.env.K8S_NAMESPACE || 'vyenfita-test';

// Use describe.skip when integration test flag not set
const describeIntegration = SHOULD_RUN ? describe : describe.skip;

describeIntegration('KubernetesDriver — Integration (real cluster)', () => {
  let driver: KubernetesDriver;

  const testArtifact: DeploymentArtifact = {
    id: 'integration-artifact-1',
    applicationId: '12345678-1234-1234-1234-123456789012',
    version: '1.0.0',
    path: '/tmp/vyenfita-integration-artifact',
    sizeBytes: 512,
    checksum: 'integration-checksum-abc',
    createdAt: new Date(),
    metadata: {
      versionId: 'version-integration',
      applicationName: 'Integration Test App',
      environmentName: 'test',
      buildDurationMs: 100,
    },
  };

  const testRequest: DeployRequest = {
    tenantId: 'integration-tenant',
    applicationId: testArtifact.applicationId,
    environmentId: 'integration-env',
    versionId: 'version-integration',
    target: {
      id: 'target-integration',
      type: 'kubernetes',
      name: 'integration-test',
      config: {},
    },
    triggeredBy: 'integration-test',
    config: {
      replicas: 1,
    },
  };

  beforeAll(() => {
    if (!KUBECONFIG_B64) {
      throw new Error(
        'KUBECONFIG_BASE64 env var is required for K8s integration tests'
      );
    }

    driver = new KubernetesDriver({
      kubeconfig: KUBECONFIG_B64,
      namespace: NAMESPACE,
    });
  });

  describe('deploy()', () => {
    let deploymentId: string;

    it('should successfully deploy an artifact to the cluster', async () => {
      const logs: any[] = [];
      const logger = (entry: any) => logs.push(entry);

      const result = await driver.deploy(testArtifact, testRequest, logger);

      // Save for cleanup
      deploymentId = result.deploymentId;

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBeDefined();
      expect(result.deploymentId).not.toBe('');
      expect(result.url).toContain('k8s://');
      expect(result.url).toContain(NAMESPACE);

      // Verify logs
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((l) => l.message.includes('Kubernetes API reachable'))).toBe(true);
      expect(logs.some((l) => l.message.includes('Creating'))).toBe(true);
      expect(logs.some((l) => l.message.includes('Rollout complete'))).toBe(true);
    }, 180000);

    it('should have created a running deployment', async () => {
      expect(deploymentId).toBeDefined();

      // Health check should pass
      const health = await driver.healthCheck(
        `k8s://${NAMESPACE}/${deploymentId}`,
        10000
      );

      expect(health.healthy).toBe(true);
      expect(health.status).toBe('healthy');
      expect(health.checks.length).toBeGreaterThan(0);
      expect(health.checks[0].status).toBe('pass');
      expect(health.checks[0].message).toMatch(/\d+\/\d+ replicas/);
    }, 60000);

    it('should return healthy status consistently on repeated checks', async () => {
      const health1 = await driver.healthCheck(
        `k8s://${NAMESPACE}/${deploymentId}`,
        5000
      );
      const health2 = await driver.healthCheck(
        `k8s://${NAMESPACE}/${deploymentId}`,
        5000
      );

      expect(health1.healthy).toBe(true);
      expect(health2.healthy).toBe(true);
    }, 30000);

    it('should clean up (remove) the deployment successfully', async () => {
      expect(deploymentId).toBeDefined();

      await expect(
        driver.remove(deploymentId, testRequest.target)
      ).resolves.not.toThrow();
    }, 60000);

    it('should report unhealthy after cleanup', async () => {
      // Wait briefly for cleanup to propagate
      await new Promise((r) => setTimeout(r, 3000));

      const health = await driver.healthCheck(
        `k8s://${NAMESPACE}/${deploymentId}`,
        5000
      );

      // After removal, health check should report unhealthy
      expect(health.healthy).toBe(false);
    }, 30000);
  });

  describe('error handling', () => {
    it('should reject invalid kubeconfig in validate()', () => {
      const result = driver.validate({
        id: 'test',
        type: 'kubernetes',
        name: 'test',
        config: null as any,
      });

      expect(result.valid).toBe(false);
    });

    it('should return unhealthy for non-existent deployment', async () => {
      const health = await driver.healthCheck(
        `k8s://${NAMESPACE}/non-existent-deployment-xyz`,
        5000
      );

      expect(health.healthy).toBe(false);
      expect(health.status).toBe('unhealthy');
    }, 30000);
  });
});
