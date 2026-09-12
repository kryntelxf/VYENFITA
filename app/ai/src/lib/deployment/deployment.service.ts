/**
 * VYENFITA Deployment Service
 * 
 * Production-grade deployment orchestration:
 * - Uses DriverRegistry to select driver
 * - Build → Deploy → Verify
 * - Rollback on failure
 * - Persistent state + audit
 * 
 * @version 2.0.0
 */

import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { BuildService } from './build.service';
import { getDriverRegistry } from './driver-registry';
import {
  DeploymentDriver,
  DeploymentLogEntry,
  DeployRequest,
  DeployResult,
  HealthCheckResult,
} from './deployment.interface';
import { logger } from '../observability/logger';

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
  /**
   * Create and execute a deployment
   */
  async deploy(params: CreateDeploymentParams): Promise<DeployResult> {
    // Verify application
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

    // Get driver from registry
    const registry = getDriverRegistry();
    const driver = registry.get(params.target.type);

    if (!driver) {
      throw new Error(
        `No driver registered for type: ${params.target.type}. Available: ${registry.list().join(', ')}`
      );
    }

    // Validate driver config
    const validation = driver.validate({
      id: params.target.name,
      type: params.target.type as any,
      name: params.target.name,
      config: params.target.config,
    });

    if (!validation.valid) {
      throw new Error(`Invalid target config: ${validation.errors.join(', ')}`);
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
      // ============================================================
      // STEP 1: Build
      // ============================================================
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'building' },
      });

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

      // ============================================================
      // STEP 2: Deploy
      // ============================================================
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'deploying' },
      });

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
            target: params.target.type,
            error: result.error,
          },
          status: 'error',
          duration: result.durationMs,
        });

        return result;
      }

      // ============================================================
      // STEP 3: Verify (health check with retry)
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

        if (attempt < 3) await this.sleep(2000);
      }

      log({
        timestamp: new Date(),
        level: 'info',
        message: 'Health check complete',
        data: { healthy: health.healthy, status: health.status },
      });

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
          target: params.target.type,
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

    // Find previous successful deployment for same app + env
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

    const registry = getDriverRegistry();
    const driver = registry.get(deployment.platform);

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

  /**
   * List available deployment targets
   */
  listAvailableTargets(): string[] {
    return getDriverRegistry().list();
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
