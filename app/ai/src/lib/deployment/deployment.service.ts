/**
 * VYENFITA Deployment Service
 * 
 * Production-grade deployment orchestration
 * - Build → Deploy → Verify
 * - Rollback on failure
 * - Persistent state
 * - Audit logging
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { BuildService } from './build.service';
import { DockerDriver } from './drivers/docker.driver';
import {
  DeploymentDriver,
  DeploymentLogEntry,
  DeployRequest,
  DeployResult,
  HealthCheckResult,
} from './deployment.interface';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface CreateDeploymentParams {
  tenantId: string;
  userId: string;
  applicationId: string;
  environmentId: string;
  versionId: string;
  target: {
    type: string;
    name: string;
    config: Record<string, any>;
  };
  config?: Record<string, any>;
}

export class DeploymentService {
  private drivers: Map<string, DeploymentDriver> = new Map();

  constructor() {
    // Register drivers
    this.drivers.set('docker', new DockerDriver());
  }

  /**
   * Create and execute a deployment
   */
  async deploy(params: CreateDeploymentParams): Promise<DeployResult> {
    // Verify application belongs to tenant
    const application = await prisma.application.findFirst({
      where: {
        id: params.applicationId,
        tenantId: params.tenantId,
        deletedAt: null,
      },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    // Verify environment
    const environment = await prisma.environment.findFirst({
      where: {
        id: params.environmentId,
        applicationId: params.applicationId,
      },
    });

    if (!environment) {
      throw new Error('Environment not found');
    }

    // Verify version
    const version = await prisma.applicationVersion.findFirst({
      where: {
        id: params.versionId,
        applicationId: params.applicationId,
      },
    });

    if (!version) {
      throw new Error('Version not found');
    }

    // Get driver
    const driver = this.drivers.get(params.target.type);
    if (!driver) {
      throw new Error(`No driver registered for type: ${params.target.type}`);
    }

    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        tenantId: params.tenantId,
        applicationId: params.applicationId,
        environmentId: params.environmentId,
        versionId: params.versionId,
        status: 'pending',
        platform: params.target.type,
        config: {
          target: params.target,
          ...params.config,
        },
        triggeredBy: params.userId,
      },
    });

    const logEntries: DeploymentLogEntry[] = [];

    const log = (entry: DeploymentLogEntry) => {
      logEntries.push(entry);
      logger.info(entry.message, { ...entry.data, deploymentId: deployment.id });
    };

    try {
      // Update status
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'building' },
      });

      // ============================================================
      // STEP 1: BUILD
      // ============================================================
      const artifact = await BuildService.build(
        {
          applicationId: params.applicationId,
          versionId: params.versionId,
          applicationName: application.name,
          environmentName: environment.name,
        },
        log
      );

      log({
        timestamp: new Date(),
        level: 'info',
        message: 'Artifact built',
        data: { artifactId: artifact.id, checksum: artifact.checksum },
      });

      // Update status
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'deploying' },
      });

      // ============================================================
      // STEP 2: DEPLOY
      // ============================================================
      const deployRequest: DeployRequest = {
        tenantId: params.tenantId,
        applicationId: params.applicationId,
        environmentId: params.environmentId,
        versionId: params.versionId,
        target: {
          id: deployment.id,
          type: params.target.type as any,
          name: params.target.name,
          config: params.target.config,
        },
        config: params.config,
        triggeredBy: params.userId,
      };

      const result = await driver.deploy(artifact, deployRequest, log);

      if (!result.success) {
        // Failed deployment
        await prisma.deployment.update({
          where: { id: deployment.id },
          data: {
            status: 'failed',
            error: result.error,
            logs: logEntries as any,
            completedAt: new Date(),
            duration: result.durationMs,
          },
        });

        await auditService.log({
          tenantId: params.tenantId,
          userId: params.userId,
          eventType: 'system',
          action: 'deployment.failed',
          resource: 'deployment',
          resourceId: deployment.id,
          details: {
            applicationId: params.applicationId,
            error: result.error,
          },
          status: 'error',
          duration: result.durationMs,
        });

        return result;
      }

      // ============================================================
      // STEP 3: VERIFY (health check)
      // ============================================================
      log({
        timestamp: new Date(),
        level: 'info',
        message: 'Running health check',
      });

      let health: HealthCheckResult = {
        healthy: false,
        status: 'unknown',
        checks: [],
        timestamp: new Date(),
      };

      // Retry health check up to 3 times
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          health = await driver.healthCheck(result.url || '', 10000);
          if (health.healthy) break;
        } catch (error) {
          log({
            timestamp: new Date(),
            level: 'warn',
            message: `Health check attempt ${attempt} failed: ${error instanceof Error ? error.message : 'unknown'}`,
          });
        }

        if (attempt < 3) {
          await this.sleep(2000);
        }
      }

      log({
        timestamp: new Date(),
        level: 'info',
        message: 'Health check complete',
        data: { healthy: health.healthy, status: health.status },
      });

      // Determine final status
      const finalStatus = health.healthy ? 'success' : 'degraded';

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: finalStatus,
          healthStatus: health.status,
          healthChecks: health.checks as any,
          logs: logEntries as any,
          completedAt: new Date(),
          duration: result.durationMs,
        },
      });

      await auditService.log({
        tenantId: params.tenantId,
        userId: params.userId,
        eventType: 'system',
        action: 'deployment.success',
        resource: 'deployment',
        resourceId: deployment.id,
        details: {
          applicationId: params.applicationId,
          environmentId: params.environmentId,
          healthStatus: health.status,
          durationMs: result.durationMs,
        },
        status: 'success',
        duration: result.durationMs,
      });

      return {
        ...result,
        success: finalStatus === 'success',
        logs: logEntries,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deployment failed';

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'failed',
          error: message,
          logs: logEntries as any,
          completedAt: new Date(),
        },
      });

      await auditService.log({
        tenantId: params.tenantId,
        userId: params.userId,
        eventType: 'system',
        action: 'deployment.error',
        resource: 'deployment',
        resourceId: deployment.id,
        details: { error: message },
        status: 'error',
      });

      throw error;
    }
  }

  /**
   * Rollback to previous successful deployment
   */
  async rollback(
    tenantId: string,
    deploymentId: string,
    userId: string
  ): Promise<DeployResult> {
    const deployment = await prisma.deployment.findFirst({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Find previous successful deployment for same application + environment
    const previous = await prisma.deployment.findFirst({
      where: {
        tenantId,
        applicationId: deployment.applicationId,
        environmentId: deployment.environmentId,
        status: 'success',
        id: { not: deploymentId },
        createdAt: { lt: deployment.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!previous) {
      throw new Error('No previous successful deployment to rollback to');
    }

    // Mark current as rolled_back
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'rolled_back',
        completedAt: new Date(),
      },
    });

    // Re-deploy the previous version
    return this.deploy({
      tenantId,
      userId,
      applicationId: previous.applicationId,
      environmentId: previous.environmentId,
      versionId: previous.versionId!,
      target: (previous.config as any).target,
      config: previous.config as any,
    });
  }

  /**
   * Stop and remove a deployment
   */
  async remove(tenantId: string, deploymentId: string): Promise<void> {
    const deployment = await prisma.deployment.findFirst({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const driver = this.drivers.get(deployment.platform);
    if (driver) {
      try {
        await driver.remove(deployment.id, (deployment.config as any).target);
      } catch (error) {
        logger.warn('Failed to remove deployment from driver', {
          deploymentId,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'removed',
        completedAt: new Date(),
      },
    });
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let serviceInstance: DeploymentService | undefined;

export function getDeploymentService(): DeploymentService {
  if (!serviceInstance) {
    serviceInstance = new DeploymentService();
  }
  return serviceInstance;
      }
