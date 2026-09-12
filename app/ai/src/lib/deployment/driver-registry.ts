/**
 * VYENFITA Deployment Driver Registry
 * 
 * Maps deployment target types to drivers:
 * - docker → DockerDriver
 * - kubernetes → KubernetesDriver
 * - aws-ecs → AWSECSDriver
 * - gcp-cloud-run → GCPCloudRunDriver
 * - vercel → VercelDriver
 * 
 * @version 1.0.0
 */

import { DeploymentDriver } from './deployment.interface';
import { DockerDriver } from './drivers/docker.driver';
import { KubernetesDriver } from './drivers/kubernetes.driver';
import { AWSECSDriver } from './drivers/aws-ecs.driver';
import { GCPCloudRunDriver } from './drivers/gcp-cloud-run.driver';
import { VercelDriver } from './drivers/vercel.driver';
import { logger } from '../observability/logger';

export class DriverRegistry {
  private drivers: Map<string, DeploymentDriver> = new Map();

  constructor() {
    // Register Docker (always available)
    this.register('docker', new DockerDriver());

    // Register Kubernetes (if configured)
    if (process.env.K8S_NAMESPACE || process.env.KUBERNETES_SERVICE_HOST) {
      try {
        this.register(
          'kubernetes',
          new KubernetesDriver({
            inCluster: !!process.env.KUBERNETES_SERVICE_HOST,
            kubeconfig: process.env.KUBECONFIG_BASE64,
            namespace: process.env.K8S_NAMESPACE || 'vyenfita',
            registry: process.env.DOCKER_REGISTRY,
          })
        );
      } catch (error) {
        logger.warn('Kubernetes driver not available', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Register AWS ECS (if configured)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ECS_CLUSTER) {
      try {
        this.register(
          'aws-ecs',
          new AWSECSDriver({
            region: process.env.AWS_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            cluster: process.env.AWS_ECS_CLUSTER,
            subnets: (process.env.AWS_SUBNETS || '').split(',').filter(Boolean),
            securityGroups: (process.env.AWS_SECURITY_GROUPS || '').split(',').filter(Boolean),
            executionRoleArn: process.env.AWS_EXECUTION_ROLE_ARN || '',
            taskRoleArn: process.env.AWS_TASK_ROLE_ARN,
            logGroup: process.env.AWS_LOG_GROUP,
          })
        );
      } catch (error) {
        logger.warn('AWS ECS driver not available', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Register GCP Cloud Run (if configured)
    if (process.env.GCP_PROJECT_ID) {
      try {
        this.register(
          'gcp-cloud-run',
          new GCPCloudRunDriver({
            projectId: process.env.GCP_PROJECT_ID,
            region: process.env.GCP_REGION || 'us-central1',
            serviceAccountJson: process.env.GCP_SERVICE_ACCOUNT_BASE64,
            accessToken: process.env.GCP_ACCESS_TOKEN,
          })
        );
      } catch (error) {
        logger.warn('GCP Cloud Run driver not available', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Register Vercel (if configured)
    if (process.env.VERCEL_TOKEN) {
      try {
        this.register(
          'vercel',
          new VercelDriver({
            token: process.env.VERCEL_TOKEN,
            teamId: process.env.VERCEL_TEAM_ID,
            projectName: process.env.VERCEL_PROJECT_NAME,
          })
        );
      } catch (error) {
        logger.warn('Vercel driver not available', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
  }

  register(type: string, driver: DeploymentDriver): void {
    this.drivers.set(type, driver);
    logger.info(`Deployment driver registered: ${type}`);
  }

  get(type: string): DeploymentDriver | undefined {
    return this.drivers.get(type);
  }

  has(type: string): boolean {
    return this.drivers.has(type);
  }

  list(): string[] {
    return Array.from(this.drivers.keys());
  }
}

let instance: DriverRegistry | undefined;

export function getDriverRegistry(): DriverRegistry {
  if (!instance) {
    instance = new DriverRegistry();
  }
  return instance;
        }
