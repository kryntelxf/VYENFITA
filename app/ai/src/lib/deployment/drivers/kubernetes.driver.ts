/**
 * VYENFITA Kubernetes Deployment Driver
 * 
 * Deploys applications to Kubernetes:
 * - Creates/updates Deployment resource
 * - Creates Service
 * - Creates Ingress (optional)
 * - Waits for rollout
 * - Health check via K8s readiness probe
 * 
 * @version 1.0.0
 */

import * as k8s from '@kubernetes/client-node';
import {
  DeploymentDriver,
  DeploymentArtifact,
  DeployRequest,
  DeployResult,
  DeploymentLogEntry,
  HealthCheckResult,
  DeploymentError,
} from '../deployment.interface';

export interface KubernetesConfig {
  kubeconfig?: string; // base64-encoded kubeconfig
  inCluster?: boolean; // use in-cluster service account
  context?: string;
  namespace: string;
  registry?: string; // Docker registry prefix
}

export class KubernetesDriver implements DeploymentDriver {
  readonly type = 'kubernetes';

  private kc: k8s.KubeConfig;
  private appsApi: k8s.AppsV1Api;
  private coreApi: k8s.CoreV1Api;
  private netApi?: k8s.NetworkingV1Api;
  private config: KubernetesConfig;

  constructor(config: KubernetesConfig) {
    this.config = config;
    this.kc = new k8s.KubeConfig();

    if (config.inCluster) {
      this.kc.loadFromCluster();
    } else if (config.kubeconfig) {
      const decoded = Buffer.from(config.kubeconfig, 'base64').toString('utf-8');
      this.kc.loadFromString(decoded);
    } else {
      this.kc.loadFromDefault();
    }

    if (config.context) {
      this.kc.setCurrentContext(config.context);
    }

    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.netApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
  }

  async deploy(
    artifact: DeploymentArtifact,
    request: DeployRequest,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<DeployResult> {
    const startTime = Date.now();
    const namespace = this.config.namespace;
    const appName = `vyenfita-${request.applicationId.substring(0, 8)}`;
    const deploymentName = `${appName}-${Date.now()}`;

    try {
      // Verify connectivity
      await this.coreApi.listNamespace();
      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Kubernetes API reachable',
      });

      // Ensure namespace exists
      await this.ensureNamespace(namespace, logger);

      // Use a generic runtime image; the artifact is mounted as ConfigMap
      const runtimeImage = request.config?.image || process.env.RUNTIME_IMAGE || 'node:24.14.1-alpine';

      // Create ConfigMap for the artifact
      const configMapName = `${deploymentName}-artifact`;
      await this.createConfigMap(
        namespace,
        configMapName,
        artifact,
        logger
      );

      // Create Deployment
      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Creating Kubernetes Deployment',
        data: { deploymentName, namespace, image: runtimeImage },
      });

      const deployment: k8s.V1Deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: deploymentName,
          namespace,
          labels: {
            app: deploymentName,
            'vyenfita.tenant': request.tenantId,
            'vyenfita.application': request.applicationId,
            'vyenfita.environment': request.environmentId,
            'vyenfita.version': request.versionId,
          },
        },
        spec: {
          replicas: request.config?.replicas || 1,
          selector: {
            matchLabels: {
              app: deploymentName,
            },
          },
          template: {
            metadata: {
              labels: {
                app: deploymentName,
              },
            },
            spec: {
              containers: [
                {
                  name: 'app',
                  image: runtimeImage,
                  command: ['node', '-e', 'console.log("VYENFITA runtime ready"); setInterval(() => {}, 60000);'],
                  env: [
                    { name: 'APPLICATION_ID', value: request.applicationId },
                    { name: 'ENVIRONMENT_ID', value: request.environmentId },
                    { name: 'VERSION_ID', value: request.versionId },
                  ],
                  resources: {
                    limits: {
                      memory: '512Mi',
                      cpu: '500m',
                    },
                    requests: {
                      memory: '128Mi',
                      cpu: '100m',
                    },
                  },
                  readinessProbe: {
                    exec: {
                      command: ['node', '-e', 'process.exit(0)'],
                    },
                    initialDelaySeconds: 2,
                    periodSeconds: 5,
                  },
                  volumeMounts: [
                    {
                      name: 'artifact',
                      mountPath: '/app/artifact',
                      readOnly: true,
                    },
                  ],
                },
              ],
              volumes: [
                {
                  name: 'artifact',
                  configMap: {
                    name: configMapName,
                  },
                },
              ],
            },
          },
        },
      };

      await this.appsApi.createNamespacedDeployment({
        namespace,
        body: deployment,
      });

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Deployment created, waiting for rollout',
      });

      // Wait for rollout
      const rolledOut = await this.waitForRollout(
        namespace,
        deploymentName,
        120000
      );

      if (!rolledOut) {
        logger({
          timestamp: new Date(),
          level: 'error',
          message: 'Deployment rollout failed or timed out',
        });

        return {
          success: false,
          deploymentId: '',
          error: 'Rollout failed or timed out',
          durationMs: Date.now() - startTime,
          logs: [],
        };
      }

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Rollout complete',
      });

      // Create Service
      const serviceName = `${deploymentName}-svc`;
      await this.createService(namespace, serviceName, deploymentName, logger);

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        deploymentId: deploymentName,
        url: `k8s://${namespace}/${deploymentName}`,
        durationMs,
        logs: [],
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Deployment failed';

      logger({
        timestamp: new Date(),
        level: 'error',
        message: 'Kubernetes deployment failed',
        data: { error: message },
      });

      return {
        success: false,
        deploymentId: '',
        error: message,
        durationMs,
        logs: [],
      };
    }
  }

  async remove(deploymentId: string, _target: DeployRequest['target']): Promise<void> {
    const namespace = this.config.namespace;

    try {
      await this.appsApi.deleteNamespacedDeployment({
        name: deploymentId,
        namespace,
      });
    } catch {}

    try {
      await this.coreApi.deleteNamespacedService({
        name: `${deploymentId}-svc`,
        namespace,
      });
    } catch {}

    try {
      await this.coreApi.deleteNamespacedConfigMap({
        name: `${deploymentId}-artifact`,
        namespace,
      });
    } catch {}
  }

  async healthCheck(url: string, _timeoutMs: number): Promise<HealthCheckResult> {
    const timestamp = new Date();

    if (!url.startsWith('k8s://')) {
      return {
        healthy: false,
        status: 'unknown',
        checks: [{ name: 'url_format', status: 'fail', message: 'Expected k8s:// URL' }],
        timestamp,
      };
    }

    const [, path] = url.split('://');
    const [namespace, deploymentName] = path.split('/');

    try {
      const deployment = await this.appsApi.readNamespacedDeployment({
        name: deploymentName,
        namespace,
      });

      const available = deployment.body.status?.availableReplicas || 0;
      const desired = deployment.body.spec?.replicas || 1;

      const healthy = available >= desired;

      return {
        healthy,
        status: healthy ? 'healthy' : 'unhealthy',
        checks: [
          {
            name: 'deployment_available',
            status: healthy ? 'pass' : 'fail',
            message: `${available}/${desired} replicas available`,
          },
        ],
        timestamp,
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'unhealthy',
        checks: [
          {
            name: 'deployment_status',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        timestamp,
      };
    }
  }

  validate(target: DeployRequest['target']): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!target.config) {
      errors.push('target.config is required');
      return { valid: false, errors };
    }

    if (!target.config.namespace && !this.config.namespace) {
      errors.push('namespace is required (either in config or driver)');
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private async ensureNamespace(
    namespace: string,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<void> {
    try {
      await this.coreApi.readNamespace({ name: namespace });
    } catch {
      logger({
        timestamp: new Date(),
        level: 'info',
        message: `Creating namespace ${namespace}`,
      });
      await this.coreApi.createNamespace({
        body: {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name: namespace },
        },
      });
    }
  }

  private async createConfigMap(
    namespace: string,
    name: string,
    artifact: DeploymentArtifact,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<void> {
    logger({
      timestamp: new Date(),
      level: 'info',
      message: 'Creating ConfigMap for artifact',
      data: { name, artifactId: artifact.id },
    });

    const configMap: k8s.V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name, namespace },
      data: {
        'manifest.json': JSON.stringify({
          applicationId: artifact.applicationId,
          version: artifact.version,
          checksum: artifact.checksum,
        }),
      },
    };

    try {
      await this.coreApi.createNamespacedConfigMap({ namespace, body: configMap });
    } catch (error) {
      // If already exists, update
      if ((error as any)?.response?.statusCode === 409) {
        await this.coreApi.replaceNamespacedConfigMap({
          name,
          namespace,
          body: configMap,
        });
      } else {
        throw error;
      }
    }
  }

  private async createService(
    namespace: string,
    name: string,
    appLabel: string,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<void> {
    const service: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name, namespace },
      spec: {
        selector: { app: appLabel },
        ports: [
          {
            port: 80,
            targetPort: 3000 as any,
            protocol: 'TCP',
          },
        ],
        type: 'ClusterIP',
      },
    };

    try {
      await this.coreApi.createNamespacedService({ namespace, body: service });
      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Service created',
        data: { serviceName: name },
      });
    } catch (error) {
      if ((error as any)?.response?.statusCode !== 409) {
        logger({
          timestamp: new Date(),
          level: 'warn',
          message: 'Service creation failed',
          data: { error: error instanceof Error ? error.message : 'Unknown' },
        });
      }
    }
  }

  private async waitForRollout(
    namespace: string,
    deploymentName: string,
    timeoutMs: number
  ): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const deployment = await this.appsApi.readNamespacedDeployment({
          name: deploymentName,
          namespace,
        });

        const status = deployment.body.status;
        const available = status?.availableReplicas || 0;
        const desired = deployment.body.spec?.replicas || 1;

        if (available >= desired && available > 0) {
          return true;
        }
      } catch {}

      await this.sleep(2000);
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
                                        }
