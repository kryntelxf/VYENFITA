/**
 * VYENFITA Cloud Driver Integration Tests
 * 
 * Tests AWS ECS, GCP Cloud Run, and Vercel drivers against REAL
 * cloud environments.
 * 
 * These tests require:
 * - CLOUD_INTEGRATION_TEST=true
 * - CLOUD_DRIVER=<aws-ecs|gcp-cloud-run|vercel>
 * - Appropriate credentials in env vars
 * 
 * They are SKIPPED by default to avoid hitting cloud APIs during
 * normal development and CI.
 * 
 * @version 1.0.0
 */

import { AWSECSDriver } from '../../../lib/deployment/drivers/aws-ecs.driver';
import { GCPCloudRunDriver } from '../../../lib/deployment/drivers/gcp-cloud-run.driver';
import { VercelDriver } from '../../../lib/deployment/drivers/vercel.driver';
import { DeploymentArtifact, DeployRequest } from '../../../lib/deployment/deployment.interface';

// ============================================================
// CONFIG
// ============================================================

const CLOUD_TEST_ENABLED = process.env.CLOUD_INTEGRATION_TEST === 'true';
const DRIVER = process.env.CLOUD_DRIVER;
const DRY_RUN = process.env.DRY_RUN === 'true';

const describeCloud = CLOUD_TEST_ENABLED ? describe : describe.skip;

// ============================================================
// SHARED TEST DATA
// ============================================================

const createTestArtifact = (driverType: string): DeploymentArtifact => ({
  id: `cloud-test-artifact-${Date.now()}`,
  applicationId: '12345678-1234-1234-1234-123456789012',
  version: '1.0.0',
  path: '/tmp/vyenfita-cloud-test-artifact',
  sizeBytes: 512,
  checksum: 'cloud-test-checksum',
  createdAt: new Date(),
  metadata: {
    versionId: 'cloud-version-1',
    applicationName: `Cloud Test ${driverType}`,
    environmentName: 'test',
    buildDurationMs: 100,
  },
});

const createTestRequest = (driverType: 'aws-ecs' | 'gcp-cloud-run' | 'vercel'): DeployRequest => ({
  tenantId: 'cloud-test-tenant',
  applicationId: '12345678-1234-1234-1234-123456789012',
  environmentId: 'cloud-test-env',
  versionId: 'cloud-version-1',
  target: {
    id: `cloud-target-${driverType}`,
    type: driverType,
    name: `vyenfita-cloud-test-${Date.now()}`,
    config: {},
  },
  triggeredBy: 'cloud-integration-test',
  config: {
    replicas: 1,
    desiredCount: 1,
    minInstances: 0,
    maxInstances: 1,
  },
});

// ============================================================
// AWS ECS
// ============================================================

describeCloud('AWS ECS Driver — Cloud Integration', () => {
  const shouldRun = DRIVER === 'aws-ecs' || DRIVER === 'all';

  if (!shouldRun) {
    it.skip('skipped — CLOUD_DRIVER is not aws-ecs', () => {});
    return;
  }

  let driver: AWSECSDriver;

  beforeAll(() => {
    const required = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_ECS_CLUSTER',
      'AWS_EXECUTION_ROLE_ARN',
    ];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
      }
    }

    driver = new AWSECSDriver({
      region: process.env.AWS_REGION!,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      cluster: process.env.AWS_ECS_CLUSTER!,
      subnets: (process.env.AWS_SUBNETS || '').split(',').filter(Boolean),
      securityGroups: (process.env.AWS_SECURITY_GROUPS || '').split(',').filter(Boolean),
      executionRoleArn: process.env.AWS_EXECUTION_ROLE_ARN!,
      taskRoleArn: process.env.AWS_TASK_ROLE_ARN,
      logGroup: process.env.AWS_LOG_GROUP,
    });
  });

  it('should validate AWS ECS config', () => {
    const result = driver.validate(createTestRequest('aws-ecs').target);
    expect(result.valid).toBe(true);
  });

  it(
    'should deploy artifact to AWS ECS',
    async () => {
      if (DRY_RUN) {
        console.log('[DRY RUN] Skipping actual deploy');
        return;
      }

      const logs: any[] = [];
      const artifact = createTestArtifact('aws-ecs');
      const request = createTestRequest('aws-ecs');

      const result = await driver.deploy(artifact, request, (entry) => logs.push(entry));

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBeDefined();
      expect(result.url).toBeDefined();

      // Health check
      const health = await driver.healthCheck(result.url!, 30000);
      expect(health.healthy).toBe(true);

      // Cleanup
      await driver.remove(result.deploymentId, request.target);
    },
    600000
  );
});

// ============================================================
// GCP CLOUD RUN
// ============================================================

describeCloud('GCP Cloud Run Driver — Cloud Integration', () => {
  const shouldRun = DRIVER === 'gcp-cloud-run' || DRIVER === 'all';

  if (!shouldRun) {
    it.skip('skipped — CLOUD_DRIVER is not gcp-cloud-run', () => {});
    return;
  }

  let driver: GCPCloudRunDriver;

  beforeAll(() => {
    const required = ['GCP_PROJECT_ID', 'GCP_REGION'];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
      }
    }

    if (!process.env.GCP_ACCESS_TOKEN && !process.env.GCP_SERVICE_ACCOUNT_BASE64) {
      throw new Error('Missing GCP_ACCESS_TOKEN or GCP_SERVICE_ACCOUNT_BASE64');
    }

    driver = new GCPCloudRunDriver({
      projectId: process.env.GCP_PROJECT_ID!,
      region: process.env.GCP_REGION!,
      accessToken: process.env.GCP_ACCESS_TOKEN,
      serviceAccountJson: process.env.GCP_SERVICE_ACCOUNT_BASE64,
    });
  });

  it('should validate GCP Cloud Run config', () => {
    const result = driver.validate(createTestRequest('gcp-cloud-run').target);
    expect(result.valid).toBe(true);
  });

  it(
    'should deploy artifact to GCP Cloud Run',
    async () => {
      if (DRY_RUN) {
        console.log('[DRY RUN] Skipping actual deploy');
        return;
      }

      const logs: any[] = [];
      const artifact = createTestArtifact('gcp-cloud-run');
      const request = createTestRequest('gcp-cloud-run');

      const result = await driver.deploy(artifact, request, (entry) => logs.push(entry));

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBeDefined();
      expect(result.url).toBeDefined();

      // Health check
      const health = await driver.healthCheck(result.url!, 30000);
      expect(health.healthy).toBe(true);

      // Cleanup
      await driver.remove(result.deploymentId, request.target);
    },
    600000
  );
});

// ============================================================
// VERCEL
// ============================================================

describeCloud('Vercel Driver — Cloud Integration', () => {
  const shouldRun = DRIVER === 'vercel' || DRIVER === 'all';

  if (!shouldRun) {
    it.skip('skipped — CLOUD_DRIVER is not vercel', () => {});
    return;
  }

  let driver: VercelDriver;

  beforeAll(() => {
    if (!process.env.VERCEL_TOKEN) {
      throw new Error('Missing required env var: VERCEL_TOKEN');
    }

    driver = new VercelDriver({
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID,
      projectName: process.env.VERCEL_PROJECT_NAME,
    });
  });

  it('should validate Vercel config', () => {
    const result = driver.validate(createTestRequest('vercel').target);
    expect(result.valid).toBe(true);
  });

  it(
    'should deploy artifact to Vercel',
    async () => {
      if (DRY_RUN) {
        console.log('[DRY RUN] Skipping actual deploy');
        return;
      }

      const logs: any[] = [];
      const artifact = createTestArtifact('vercel');
      const request = createTestRequest('vercel');

      const result = await driver.deploy(artifact, request, (entry) => logs.push(entry));

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBeDefined();
      expect(result.url).toBeDefined();

      // Health check
      const health = await driver.healthCheck(result.url!, 30000);
      expect(health.healthy).toBe(true);

      // Cleanup
      await driver.remove(result.deploymentId, request.target);
    },
    600000
  );
});
