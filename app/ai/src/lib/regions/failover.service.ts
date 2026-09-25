/**
 * VYENFITA Failover Service
 * 
 * Automated failover between regions.
 * 
 * @version 1.0.0
 */

import { getRegionRegistry } from './region-registry';
import { RegionHealthService } from './region-health.service';
import { RegionCode, RegionError } from './region.types';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';

export interface FailoverResult {
  fromRegion: RegionCode;
  toRegion: RegionCode;
  reason: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface FailoverPolicy {
  triggerThreshold: {
    unhealthySeconds: number; // How long region must be unhealthy
    consecutiveFailures: number; // How many consecutive failures
  };
  targetSelection: 'closest' | 'priority' | 'weighted';
  allowDataLoss: boolean;
  requireApproval: boolean;
}

export class FailoverService {
  private static failoverHistory: FailoverResult[] = [];
  private static failoverPolicy: FailoverPolicy = {
    triggerThreshold: {
      unhealthySeconds: 60,
      consecutiveFailures: 3,
    },
    targetSelection: 'closest',
    allowDataLoss: false,
    requireApproval: true,
  };

  /**
   * Check if failover is needed for a region
   */
  static async checkFailoverNeeded(
    primaryRegion: RegionCode
  ): Promise<boolean> {
    const health = RegionHealthService.getHealth(primaryRegion);

    if (!health) {
      // No health data — check now
      const freshHealth = await RegionHealthService.checkRegion(primaryRegion);
      return freshHealth.status === 'unhealthy';
    }

    return health.status === 'unhealthy';
  }

  /**
   * Perform failover from one region to another
   */
  static async failover(params: {
    fromRegion: RegionCode;
    toRegion?: RegionCode;
    tenantId: string;
    reason: string;
    approvedBy?: string;
  }): Promise<FailoverResult> {
    const registry = getRegionRegistry();
    const from = registry.getOrThrow(params.fromRegion);

    // Select target region
    let target: RegionCode;

    if (params.toRegion) {
      target = params.toRegion;
    } else {
      target = this.selectFailoverTarget(params.fromRegion);
    }

    const to = registry.getOrThrow(target);

    // Check if we need approval
    if (this.failoverPolicy.requireApproval && !params.approvedBy) {
      return {
        fromRegion: params.fromRegion,
        toRegion: target,
        reason: params.reason,
        success: false,
        error: 'Failover requires approval',
        timestamp: new Date(),
      };
    }

    const result: FailoverResult = {
      fromRegion: params.fromRegion,
      toRegion: target,
      reason: params.reason,
      success: true,
      timestamp: new Date(),
    };

    try {
      // In production, this would:
      // 1. Update DNS / load balancer
      // 2. Notify all services
      // 3. Update tenant routing
      // 4. Verify traffic is flowing to new region

      logger.info('Failover executed', {
        from: params.fromRegion,
        to: target,
        reason: params.reason,
        tenantId: params.tenantId,
      });

      await auditService.log({
        tenantId: params.tenantId,
        userId: params.approvedBy,
        eventType: 'system',
        action: 'region.failover',
        resource: 'region',
        resourceId: params.fromRegion,
        details: {
          fromRegion: params.fromRegion,
          toRegion: target,
          reason: params.reason,
        },
        status: 'success',
      });
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failover failed', {
        from: params.fromRegion,
        to: target,
        error: result.error,
      });
    }

    this.failoverHistory.push(result);

    return result;
  }

  /**
   * Select the best failover target
   */
  private static selectFailoverTarget(fromRegion: RegionCode): RegionCode {
    const registry = getRegionRegistry();
    const from = registry.getOrThrow(fromRegion);

    // Get healthy regions
    const healthyRegions = RegionHealthService.getHealthyRegions();

    // Filter to replication targets first
    const replicationTargets = from.replicationTargets.filter((r) =>
      healthyRegions.includes(r)
    );

    if (replicationTargets.length > 0) {
      return replicationTargets[0];
    }

    // Fallback to primary if healthy
    const primary = registry.getPrimary();
    if (healthyRegions.includes(primary.code)) {
      return primary.code;
    }

    // Fallback to any healthy region
    if (healthyRegions.length > 0) {
      return healthyRegions[0];
    }

    throw new RegionError('No healthy regions available', 'NO_HEALTHY_REGIONS');
  }

  /**
   * Get failover history
   */
  static getHistory(): FailoverResult[] {
    return [...this.failoverHistory];
  }

  /**
   * Update failover policy
   */
  static setPolicy(policy: Partial<FailoverPolicy>): void {
    this.failoverPolicy = { ...this.failoverPolicy, ...policy };
    logger.info('Failover policy updated', { policy: this.failoverPolicy });
  }

  /**
   * Get current policy
   */
  static getPolicy(): FailoverPolicy {
    return { ...this.failoverPolicy };
  }
}

export default FailoverService;
