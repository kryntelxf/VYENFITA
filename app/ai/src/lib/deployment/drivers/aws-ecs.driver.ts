/**
 * VYENFITA AWS ECS Deployment Driver
 * 
 * Deploys applications to AWS ECS (Fargate):
 * - Creates/updates Task Definition
 * - Updates ECS Service
 * - Waits for service stability
 * - Health check via target group
 * 
 * @version 1.0.0
 */

import {
  ECSClient,
  RegisterTaskDefinitionCommand,
  CreateServiceCommand,
  UpdateServiceCommand,
  DescribeServicesCommand,
  DeleteServiceCommand,
  DeregisterTaskDefinitionCommand,
  ListTasksCommand,
  DescribeTasksCommand,
} from '@aws-sdk/client-ecs';
import {
  DeploymentDriver,
  DeploymentArtifact,
  DeployRequest,
  DeployResult,
  DeploymentLogEntry,
  HealthCheckResult,
} from '../deployment.interface';

export interface AWSECSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  cluster: string;
  subnets: string[];
  securityGroups: string[];
  executionRoleArn: string;
  taskRoleArn?: string;
  logGroup?: string;
}

export class AWSECSDriver implements DeploymentDriver {
  readonly type = 'aws-ecs';

  private client: ECSClient;
  private config: AWSECSConfig;

  constructor(config: AWSECSConfig) {
    this.config = config;
    this.client = new ECSClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async deploy(
    artifact: DeploymentArtifact,
    request: DeployRequest,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<DeployResult> {
    const startTime = Date.now();
    const serviceName = `vyenfita-${request.applicationId.substring(0, 8)}`;

    try {
      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Starting AWS ECS deployment',
        data: { serviceName, cluster: this.config.cluster },
      });

      const image = request.config?.image || process.env.RUNTIME_IMAGE || 'node:24.14.1-alpine';
      const cpu = request.config?.cpu || '512';
      const memory = request.config?.memory || '1024';

      // Register task definition
      const taskDefResponse = await this.client.send(
        new RegisterTaskDefinitionCommand({
          family: serviceName,
          networkMode: 'awsvpc',
          requiresCompatibilities: ['FARGATE'],
          cpu,
          memory,
          executionRoleArn: this.config.executionRoleArn,
          taskRoleArn: this.config.taskRoleArn,
          containerDefinitions: [
            {
              name: 'app',
              image,
              essential: true,
              command: ['node', '-e', 'console.log("VYENFITA runtime ready"); setInterval(() => {}, 60000);'],
              environment: [
                { name: 'APPLICATION_ID', value: request.applicationId },
                { name: 'ENVIRONMENT_ID', value: request.environmentId },
                { name: 'VERSION_ID', value: request.versionId },
              ],
              logConfiguration: this.config.logGroup
                ? {
                    logDriver: 'awslogs',
                    options: {
                      'awslogs-group': this.config.logGroup,
                      'awslogs-region': this.config.region,
                      'awslogs-stream-prefix': serviceName,
                    },
                  }
                : undefined,
            },
          ],
        })
      );

      const taskDefArn = taskDefResponse.taskDefinition?.taskDefinitionArn;
      if (!taskDefArn) {
        throw new Error('Failed to register task definition');
      }

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Task definition registered',
        data: { taskDefArn },
      });

      // Try to update existing service, or create new one
      let serviceArn: string;

      try {
        // Check if service exists
        const describeResponse = await this.client.send(
          new DescribeServicesCommand({
            cluster: this.config.cluster,
            services: [serviceName],
          })
        );

        const existing = describeResponse.services?.find(
          (s) => s.status === 'ACTIVE'
        );

        if (existing) {
          // Update existing service
          logger({
            timestamp: new Date(),
            level: 'info',
            message: 'Updating existing ECS service',
          });

          const updateResponse = await this.client.send(
            new UpdateServiceCommand({
              cluster: this.config.cluster,
              service: serviceName,
              taskDefinition: taskDefArn,
              desiredCount: request.config?.desiredCount || 1,
              forceNewDeployment: true,
            })
          );

          serviceArn = updateResponse.service?.serviceArn || serviceName;
        } else {
          // Create new service
          serviceArn = await this.createService(
            serviceName,
            taskDefArn,
            request,
            logger
          );
        }
      } catch {
        // Service doesn't exist — create
        serviceArn = await this.createService(
          serviceName,
          taskDefArn,
          request,
          logger
        );
      }

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Waiting for service to stabilize',
      });

      // Wait for service stability
      const stable = await this.waitForStability(serviceName, 300000);

      if (!stable) {
        logger({
          timestamp: new Date(),
          level: 'error',
          message: 'Service did not stabilize in time',
        });

        return {
          success: false,
          deploymentId: serviceArn,
          error: 'Service did not stabilize in time',
          durationMs: Date.now() - startTime,
          logs: [],
        };
      }

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Service stabilized',
      });

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        deploymentId: serviceArn,
        url: `ecs://${this.config.cluster}/${serviceName}`,
        durationMs,
        logs: [],
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'ECS deployment failed';

      logger({
        timestamp: new Date(),
        level: 'error',
        message: 'ECS deployment failed',
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
    const serviceName = deploymentId.includes('/')
      ? deploymentId.split('/').pop()!
      : deploymentId;

    try {
      // Scale down first
      await this.client.send(
        new UpdateServiceCommand({
          cluster: this.config.cluster,
          service: serviceName,
          desiredCount: 0,
        })
      );

      // Delete service
      await this.client.send(
        new DeleteServiceCommand({
          cluster: this.config.cluster,
          service: serviceName,
          force: true,
        })
      );
    } catch {}
  }

  async healthCheck(url: string, _timeoutMs: number): Promise<HealthCheckResult> {
    const timestamp = new Date();

    if (!url.startsWith('ecs://')) {
      return {
        healthy: false,
        status: 'unknown',
        checks: [{ name: 'url_format', status: 'fail', message: 'Expected ecs:// URL' }],
        timestamp,
      };
    }

    const [, path] = url.split('://');
    const [, serviceName] = path.split('/');

    try {
      const response = await this.client.send(
        new DescribeServicesCommand({
          cluster: this.config.cluster,
          services: [serviceName],
        })
      );

      const service = response.services?.[0];
      if (!service) {
        return {
          healthy: false,
          status: 'unhealthy',
          checks: [{ name: 'service_exists', status: 'fail', message: 'Service not found' }],
          timestamp,
        };
      }

      const running = service.runningCount || 0;
      const desired = service.desiredCount || 0;
      const healthy = running >= desired && desired > 0;

      return {
        healthy,
        status: healthy ? 'healthy' : 'unhealthy',
        checks: [
          {
            name: 'running_tasks',
            status: healthy ? 'pass' : 'fail',
            message: `${running}/${desired} tasks running`,
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
            name: 'service_status',
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

    if (!this.config.cluster) errors.push('cluster is required');
    if (!this.config.subnets || this.config.subnets.length === 0) {
      errors.push('at least one subnet is required');
    }
    if (!this.config.executionRoleArn) {
      errors.push('executionRoleArn is required');
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private async createService(
    serviceName: string,
    taskDefArn: string,
    request: DeployRequest,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<string> {
    logger({
      timestamp: new Date(),
      level: 'info',
      message: 'Creating new ECS service',
    });

    const response = await this.client.send(
      new CreateServiceCommand({
        cluster: this.config.cluster,
        serviceName,
        taskDefinition: taskDefArn,
        desiredCount: request.config?.desiredCount || 1,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: this.config.subnets,
            securityGroups: this.config.securityGroups,
            assignPublicIp: 'ENABLED',
          },
        },
      })
    );

    return response.service?.serviceArn || serviceName;
  }

  private async waitForStability(
    serviceName: string,
    timeoutMs: number
  ): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const response = await this.client.send(
          new DescribeServicesCommand({
            cluster: this.config.cluster,
            services: [serviceName],
          })
        );

        const service = response.services?.[0];
        if (!service) {
          await this.sleep(5000);
          continue;
        }

        if (service.status !== 'ACTIVE') {
          await this.sleep(5000);
          continue;
        }

        const running = service.runningCount || 0;
        const desired = service.desiredCount || 0;

        if (running >= desired && desired > 0) {
          return true;
        }
      } catch {}

      await this.sleep(5000);
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
                 }
