/**
 * VYENFITA Geo-Routing Service
 * 
 * Routes users to the nearest/appropriate region.
 * 
 * @version 1.0.0
 */

import { getRegionRegistry } from './region-registry';
import { prisma } from '../database/client';
import {
  RegionCode,
  RegionDefinition,
  GeoLocation,
  DataResidencyPolicy,
} from './region.types';
import { logger } from '../observability/logger';

export interface RoutingDecision {
  region: RegionDefinition;
  reason: string;
  alternatives: RegionDefinition[];
}

export class GeoRoutingService {
  /**
   * Route a user to the best region
   */
  static async route(params: {
    tenantId?: string;
    ipAddress?: string;
    country?: string;
    preferRegion?: RegionCode;
  }): Promise<RoutingDecision> {
    const registry = getRegionRegistry();

    // ============================================================
    // PRIORITY 1: Explicit preference
    // ============================================================
    if (params.preferRegion) {
      const preferred = registry.get(params.preferRegion);
      if (preferred) {
        return {
          region: preferred,
          reason: 'User preferred region',
          alternatives: [],
        };
      }
    }

    // ============================================================
    // PRIORITY 2: Tenant data residency policy
    // ============================================================
    if (params.tenantId) {
      const policy = await this.getDataResidencyPolicy(params.tenantId);
      if (policy && policy.allowedRegions.length > 0) {
        // Route to primary region of the policy
        const primary = registry.get(policy.primaryRegion);
        if (primary) {
          const alternatives = policy.allowedRegions
            .filter((r) => r !== policy.primaryRegion)
            .map((r) => registry.get(r))
            .filter((r): r is RegionDefinition => r !== undefined);

          return {
            region: primary,
            reason: `Tenant data residency policy (${policy.primaryRegion})`,
            alternatives,
          };
        }
      }
    }

    // ============================================================
    // PRIORITY 3: Geo location (from country)
    // ============================================================
    if (params.country) {
      const geo = this.getGeoFromCountry(params.country);
      if (geo) {
        const closest = registry.findClosest(geo.latitude, geo.longitude);
        return {
          region: closest,
          reason: `Closest to ${params.country}`,
          alternatives: registry.list().filter((r) => r.code !== closest.code),
        };
      }
    }

    // ============================================================
    // FALLBACK: Primary region
    // ============================================================
    const primary = registry.getPrimary();
    return {
      region: primary,
      reason: 'Default to primary region',
      alternatives: registry.list().filter((r) => r.code !== primary.code),
    };
  }

  /**
   * Get data residency policy for tenant
   */
  static async getDataResidencyPolicy(
    tenantId: string
  ): Promise<DataResidencyPolicy | null> {
    try {
      const policy = await prisma.dataResidencyPolicy.findUnique({
        where: { tenantId },
      });

      return policy as any;
    } catch {
      return null;
    }
  }

  /**
   * Get geo location from country code
   */
  private static getGeoFromCountry(country: string): GeoLocation | null {
    // Simplified country → coordinates mapping
    const countryGeo: Record<string, GeoLocation> = {
      US: { country: 'US', latitude: 37.0902, longitude: -95.7129 },
      CA: { country: 'CA', latitude: 56.1304, longitude: -106.3468 },
      GB: { country: 'GB', latitude: 55.3781, longitude: -3.436 },
      DE: { country: 'DE', latitude: 51.1657, longitude: 10.4515 },
      FR: { country: 'FR', latitude: 46.2276, longitude: 2.2137 },
      NL: { country: 'NL', latitude: 52.1326, longitude: 5.2913 },
      ES: { country: 'ES', latitude: 40.4637, longitude: -3.7492 },
      IT: { country: 'IT', latitude: 41.8719, longitude: 12.5674 },
      SG: { country: 'SG', latitude: 1.3521, longitude: 103.8198 },
      ID: { country: 'ID', latitude: -0.7893, longitude: 113.9213 },
      MY: { country: 'MY', latitude: 4.2105, longitude: 101.9758 },
      TH: { country: 'TH', latitude: 15.87, longitude: 100.9925 },
      VN: { country: 'VN', latitude: 14.0583, longitude: 108.2772 },
      PH: { country: 'PH', latitude: 12.8797, longitude: 121.774 },
      JP: { country: 'JP', latitude: 36.2048, longitude: 138.2529 },
      KR: { country: 'KR', latitude: 35.9078, longitude: 127.7669 },
      CN: { country: 'CN', latitude: 35.8617, longitude: 104.1954 },
      IN: { country: 'IN', latitude: 20.5937, longitude: 78.9629 },
      AU: { country: 'AU', latitude: -25.2744, longitude: 133.7751 },
      NZ: { country: 'NZ', latitude: -40.9006, longitude: 174.886 },
      BR: { country: 'BR', latitude: -14.235, longitude: -51.9253 },
      MX: { country: 'MX', latitude: 23.6345, longitude: -102.5528 },
      AR: { country: 'AR', latitude: -38.4161, longitude: -63.6167 },
    };

    return countryGeo[country.toUpperCase()] || null;
  }

  /**
   * Set data residency policy for tenant
   */
  static async setDataResidencyPolicy(params: {
    tenantId: string;
    allowedRegions: RegionCode[];
    primaryRegion: RegionCode;
    strict: boolean;
  }): Promise<DataResidencyPolicy> {
    const registry = getRegionRegistry();

    // Validate regions
    for (const region of params.allowedRegions) {
      registry.getOrThrow(region);
    }
    registry.getOrThrow(params.primaryRegion);

    if (!params.allowedRegions.includes(params.primaryRegion)) {
      throw new Error('Primary region must be in allowed regions');
    }

    const policy = await prisma.dataResidencyPolicy.upsert({
      where: { tenantId: params.tenantId },
      create: {
        tenantId: params.tenantId,
        allowedRegions: params.allowedRegions,
        primaryRegion: params.primaryRegion,
        dataTypes: [],
        strict: params.strict,
      },
      update: {
        allowedRegions: params.allowedRegions,
        primaryRegion: params.primaryRegion,
        strict: params.strict,
      },
    });

    logger.info('Data residency policy set', {
      tenantId: params.tenantId,
      allowedRegions: params.allowedRegions,
      primaryRegion: params.primaryRegion,
      strict: params.strict,
    });

    return policy as any;
  }
}

export default GeoRoutingService;
