/**
 * VYENFITA Kubernetes Deployment Driver
 * 
 * @version 1.0.1
 */

import * as k8s from '@kubernetes/client-node';
import {
  DeploymentDriver,
  DeploymentArtifact,
  DeployRequest,
  DeployResult,
  DeploymentLogEntry,
  HealthCheckResult,
} from '../deployment.interface';

export interface KubernetesConfig {
  kubeconfig?: string;
  inCluster?: boolean;
  context?: string;
  namespace: string;
  registry?: string;
}

export class KubernetesDriver implements DeploymentDriver {
  readonly type = 'kubernetes';

  private kc: k8s.KubeConfig;
  private appsApi: any;
  private coreApi: any;
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

    // Cast to any to avoid SDK version differences
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api) as any;
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api) as any;
  }

  async deploy(
    artifact: DeploymentArtifact,
    request: DeployRequest,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<DeployResult> {
    const startTime = Date.now();
    const namespace = this.config.namespace;
    const deploymentName = `vyenfita-${request.applicationId.substring(0, 8)}-${Date.now()}`;

    try {
      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Kubernetes API reachable',
      });

      await this.ensureNamespace(namespace, logger);

      const runtimeImage =
        request.config?.image ||
        process.env.RUNTIME_IMAGE ||
        'node:24.14.1-alpine';

      const configMapName = `${deploymentName}-artifact`;
      await this.createConfigMap(namespace, configMapName, artifact, logger);

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Creating Kubernetes Deployment',
        data: { deploymentName, namespace, image: runtimeImage },
      });

      const deployment: any = {
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
          selector: { matchLabels: { app: deploymentName } },
          template: {
            metadata: { labels: { app: deploymentName } },
            spec: {
              containers: [
                {
                  name: 'app',
                  image: runtimeImage,
                  command: [
                    'node',
                    '-e',
                    'console.log("VYENFITA runtime ready"); setInterval(() => {}, 60000);',
                  ],
                  env: [
                    { name: 'APPLICATION_ID', value: request.applicationId },
                    { name: 'ENVIRONMENT_ID', value: request.environmentId },
                    { name: 'VERSION_ID', value: request.versionId },
                  ],
                  resources: {
                    limits: { memory: '512Mi', cpu: '500m' },
                    requests: { memory: '128Mi', cpu: '100m' },
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
                { name: 'artifact', configMap: { name: configMapName } },
              ],
            },
          },
        },
      };

      await this.appsApi.createNamespacedDeployment(namespace, deployment);

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Deployment created, waiting for rollout',
      });

      const rolledOut = await this.waitForRollout(namespace, deploymentName, 120000);

      if (!rolledOut) {
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

      await this.createService(
        namespace,
        `${deploymentName}-svc`,
        deploymentName,
        logger
      );

      return {
        success: true,
        deploymentId: deploymentName,
        url: `k8s://${namespace}/${deploymentName}`,
        durationMs: Date.now() - startTime,
        logs: [],
      };
    } catch (error) {
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
        durationMs: Date.now() - startTime,
        logs: [],
      };
    }
  }

  async remove(deploymentId: string, _target: DeployRequest['target']): Promise<void> {
    const namespace = this.config.namespace;

    try {
      await this.appsApi.deleteNamespacedDeployment(deploymentId, namespace);
    } catch {}

    try {
      await this.coreApi.deleteNamespacedService(
        `${deploymentId}-svc`,
        namespace
      );
    } catch {}

    try {
      await this.coreApi.deleteNamespacedConfigMap(
        `${deploymentId}-artifact`,
        namespace
      );
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
      const deployment = await this.appsApi.readNamespacedDeployment(
        deploymentName,
        namespace
      );

      const available = deployment.body?.status?.availableReplicas || 0;
      const desired = deployment.body?.spec?.replicas || 1;
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
      errors.push('namespace is required');
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
      await this.coreApi.readNamespace(namespace);
    } catch {
      logger({
        timestamp: new Date(),
        level: 'info',
        message: `Creating namespace ${namespace}`,
      });

      const ns: any = {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { name: namespace },
      };

      try {
        await this.coreApi.createNamespace(ns);
      } catch {}
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

    const configMap: any = {
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
      await this.coreApi.createNamespacedConfigMap(namespace, configMap);
    } catch (error) {
      if ((error as any)?.response?.statusCode === 409) {
        try {
          await this.coreApi.replaceNamespacedConfigMap(name, namespace, configMap);
        } catch {}
      }
    }
  }

  private async createService(
    namespace: string,
    name: string,
    appLabel: string,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<void> {
    const service: any = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name, namespace },
      spec: {
        selector: { app: appLabel },
        ports: [{ port: 80, targetPort: 3000, protocol: 'TCP' }],
        type: 'ClusterIP',
      },
    };

    try {
      await this.coreApi.createNamespacedService(namespace, service);
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
        const deployment = await this.appsApi.readNamespacedDeployment(
          deploymentName,
          namespace
        );

        const status = deployment.body?.status;
        const available = status?.availableReplicas || 0;
        const desired = deployment.body?.spec?.replicas || 1;

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
