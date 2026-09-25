/**
 * VYENFITA Region Health Monitor
 * 
 * Monitors health of all regions.
 * 
 * @version 1.0.0
 */

import axios from 'axios';
import { getRegionRegistry } from './region-registry';
import { RegionCode, RegionHealth, RegionStatus } from './region.types';
import { logger } from '../observability/logger';

export class RegionHealthService {
  private static healthCache: Map<RegionCode, RegionHealth> = new Map();
  private static checkIntervalMs = 30000; // 30 seconds
  private static monitorTimer?: NodeJS.Timeout;

  /**
   * Start periodic health monitoring
   */
  static startMonitoring(): void {
    if (this.monitorTimer) return;

    this.monitorTimer = setInterval(() => {
      this.checkAllRegions().catch((error) => {
        logger.error('Region health check failed', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      });
    }, this.checkIntervalMs);

    // Initial check
    this.checkAllRegions().catch(() => {});

    logger.info('Region health monitoring started', {
      interval: this.checkIntervalMs,
    });
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
      logger.info('Region health monitoring stopped');
    }
  }

  /**
   * Check health of all regions
   */
  static async checkAllRegions(): Promise<Map<RegionCode, RegionHealth>> {
    const registry = getRegionRegistry();
    const regions = registry.list();

    const results = await Promise.all(
      regions.map((region) => this.checkRegion(region.code))
    );

    for (const health of results) {
      this.healthCache.set(health.regionCode, health);
    }

    // Log any unhealthy regions
    const unhealthy = results.filter(
      (h) => h.status === 'unhealthy' || h.status === 'degraded'
    );

    if (unhealthy.length > 0) {
      logger.warn('Unhealthy regions detected', {
        regions: unhealthy.map((h) => ({ code: h.regionCode, status: h.status })),
      });
    }

    return this.healthCache;
  }

  /**
   * Check health of a single region
   */
  static async checkRegion(regionCode: RegionCode): Promise<RegionHealth> {
    const registry = getRegionRegistry();
    const region = registry.getOrThrow(regionCode);

    const startTime = Date.now();

    try {
      const response = await axios.get(`${region.apiEndpoint}/health`, {
        timeout: 10000,
        validateStatus: () => true,
      });

      const latencyMs = Date.now() - startTime;

      let status: RegionStatus = 'healthy';
      if (response.status >= 500) status = 'unhealthy';
      else if (response.status >= 400) status = 'degraded';
      else if (latencyMs > 2000) status = 'degraded';

      return {
        regionCode,
        status,
        latencyMs,
        lastCheck: new Date(),
        metrics: {
          cpuPercent: response.data?.metrics?.cpuPercent || 0,
          memoryPercent: response.data?.metrics?.memoryPercent || 0,
          requestsPerSecond: response.data?.metrics?.requestsPerSecond || 0,
          errorRate: response.data?.metrics?.errorRate || 0,
        },
      };
    } catch (error) {
      return {
        regionCode,
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          cpuPercent: 0,
          memoryPercent: 0,
          requestsPerSecond: 0,
          errorRate: 1,
        },
      };
    }
  }

  /**
   * Get cached health for all regions
   */
  static getAllHealth(): RegionHealth[] {
    return Array.from(this.healthCache.values());
  }

  /**
   * Get health for a region
   */
  static getHealth(regionCode: RegionCode): RegionHealth | undefined {
    return this.healthCache.get(regionCode);
  }

  /**
   * Get healthy regions
   */
  static getHealthyRegions(): RegionCode[] {
    return this.getAllHealth()
      .filter((h) => h.status === 'healthy')
      .map((h) => h.regionCode);
  }
}

export default RegionHealthService;
