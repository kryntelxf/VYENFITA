/**
 * VYENFITA Region Registry
 * 
 * Registry of all supported regions.
 * 
 * @version 1.0.0
 */

import { RegionCode, RegionDefinition, RegionError } from './region.types';

export class RegionRegistry {
  private regions: Map<RegionCode, RegionDefinition> = new Map();

  constructor() {
    this.registerDefaultRegions();
  }

  /**
   * Register a region
   */
  register(region: RegionDefinition): void {
    this.regions.set(region.code, region);
  }

  /**
   * Get a region
   */
  get(code: RegionCode): RegionDefinition | undefined {
    return this.regions.get(code);
  }

  /**
   * Get region or throw
   */
  getOrThrow(code: RegionCode): RegionDefinition {
    const region = this.regions.get(code);
    if (!region) {
      throw new RegionError(`Unknown region: ${code}`, 'REGION_NOT_FOUND');
    }
    return region;
  }

  /**
   * List all regions
   */
  list(): RegionDefinition[] {
    return Array.from(this.regions.values());
  }

  /**
   * List regions by data residency
   */
  listByDataResidency(residency: string): RegionDefinition[] {
    return this.list().filter((r) => r.dataResidency === residency);
  }

  /**
   * Get the primary region
   */
  getPrimary(): RegionDefinition {
    const primary = this.list().find((r) => r.isPrimary);
    if (!primary) {
      throw new RegionError('No primary region defined', 'NO_PRIMARY');
    }
    return primary;
  }

  /**
   * Find the closest region to a geo location
   */
  findClosest(latitude: number, longitude: number): RegionDefinition {
    const regions = this.list();
    if (regions.length === 0) {
      throw new RegionError('No regions registered', 'NO_REGIONS');
    }

    let closest = regions[0];
    let minDistance = this.haversineDistance(
      latitude,
      longitude,
      closest.latitude,
      closest.longitude
    );

    for (const region of regions.slice(1)) {
      const distance = this.haversineDistance(
        latitude,
        longitude,
        region.latitude,
        region.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        closest = region;
      }
    }

    return closest;
  }

  /**
   * Haversine distance formula (returns km)
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Register default regions
   */
  private registerDefaultRegions(): void {
    // US East (Primary)
    this.register({
      code: 'us-east-1',
      name: 'US East (N. Virginia)',
      provider: 'aws',
      location: 'Virginia, USA',
      latitude: 37.926868,
      longitude: -78.024902,
      apiEndpoint: 'https://us-east-1.api.vyenfita.com',
      wsEndpoint: 'wss://us-east-1.ws.vyenfita.com',
      cdnEndpoint: 'https://cdn-us-east.vyenfita.com',
      dataResidency: 'US',
      isPrimary: true,
      replicationTargets: ['us-west-2', 'eu-west-1', 'ap-southeast-1'],
      weight: 100,
    });

    // US West
    this.register({
      code: 'us-west-2',
      name: 'US West (Oregon)',
      provider: 'aws',
      location: 'Oregon, USA',
      latitude: 43.804133,
      longitude: -120.554201,
      apiEndpoint: 'https://us-west-2.api.vyenfita.com',
      wsEndpoint: 'wss://us-west-2.ws.vyenfita.com',
      cdnEndpoint: 'https://cdn-us-west.vyenfita.com',
      dataResidency: 'US',
      isPrimary: false,
      replicationTargets: ['us-east-1'],
      weight: 100,
    });

    // EU West (Ireland)
    this.register({
      code: 'eu-west-1',
      name: 'EU West (Ireland)',
      provider: 'aws',
      location: 'Dublin, Ireland',
      latitude: 53.1424,
      longitude: -7.6921,
      apiEndpoint: 'https://eu-west-1.api.vyenfita.com',
      wsEndpoint: 'wss://eu-west-1.ws.vyenfita.com',
      cdnEndpoint: 'https://cdn-eu.vyenfita.com',
      dataResidency: 'EU',
      isPrimary: false,
      replicationTargets: ['eu-central-1'],
      weight: 100,
    });

    // EU Central (Frankfurt)
    this.register({
      code: 'eu-central-1',
      name: 'EU Central (Frankfurt)',
      provider: 'aws',
      location: 'Frankfurt, Germany',
      latitude: 50.1109,
      longitude: 8.6821,
      apiEndpoint: 'https://eu-central-1.api.vyenfita.com',
      wsEndpoint: 'wss://eu-central-1.ws.vyenfita.com',
      cdnEndpoint: 'https://cdn-eu-central.vyenfita.com',
      dataResidency: 'EU',
      isPrimary: false,
      replicationTargets: ['eu-west-1'],
      weight: 100,
    });

    // AP Southeast (Singapore) - PRIMARY for Asia
    this.register({
      code: 'ap-southeast-1',
      name: 'Asia Pacific (Singapore)',
      provider: 'aws',
      location: 'Singapore',
      latitude: 1.3521,
      longitude: 103.8198,
      apiEndpoint: 'https://ap-southeast-1.api.vyenfita.com',
      wsEndpoint: 'wss://ap-southeast-1.ws.vyenfita.com',
      cdnEndpoint: 'https://cdn-apac.vyenfita.com',
      dataResidency: 'APAC',
      isPrimary: false,
      replicationTargets: ['ap-southeast-2', 'ap-northeast-1'],
      weight: 100,
    });

    // AP Southeast (Sydney)
    this.register({
      code: 'ap-southeast-2',
      name: 'Asia Pacific (Sydney)',
      provider: 'aws',
      location: 'Sydney, Australia',
      latitude: -33.8688,
      longitude: 151.2093,
      apiEndpoint: 'https://ap-southeast-2.api.vyenfita.com',
      wsEndpoint: 'wss://ap-southeast-2.ws.vyenfita.com',
      dataResidency: 'APAC',
      isPrimary: false,
      replicationTargets: ['ap-southeast-1'],
      weight: 100,
    });

    // AP Northeast (Tokyo)
    this.register({
      code: 'ap-northeast-1',
      name: 'Asia Pacific (Tokyo)',
      provider: 'aws',
      location: 'Tokyo, Japan',
      latitude: 35.6762,
      longitude: 139.6503,
      apiEndpoint: 'https://ap-northeast-1.api.vyenfita.com',
      wsEndpoint: 'wss://ap-northeast-1.ws.vyenfita.com',
      dataResidency: 'APAC',
      isPrimary: false,
      replicationTargets: ['ap-southeast-1'],
      weight: 100,
    });

    // AP South (Mumbai) - for India
    this.register({
      code: 'ap-south-1',
      name: 'Asia Pacific (Mumbai)',
      provider: 'aws',
      location: 'Mumbai, India',
      latitude: 19.076,
      longitude: 72.8777,
      apiEndpoint: 'https://ap-south-1.api.vyenfita.com',
      wsEndpoint: 'wss://ap-south-1.ws.vyenfita.com',
      dataResidency: 'APAC',
      isPrimary: false,
      replicationTargets: ['ap-southeast-1'],
      weight: 100,
    });

    // SA East (São Paulo) - for South America
    this.register({
      code: 'sa-east-1',
      name: 'South America (São Paulo)',
      provider: 'aws',
      location: 'São Paulo, Brazil',
      latitude: -23.5505,
      longitude: -46.6333,
      apiEndpoint: 'https://sa-east-1.api.vyenfita.com',
      wsEndpoint: 'wss://sa-east-1.ws.vyenfita.com',
      dataResidency: 'GLOBAL',
      isPrimary: false,
      replicationTargets: ['us-east-1'],
      weight: 100,
    });
  }
}

// ============================================================
// SINGLETON
// ============================================================

let instance: RegionRegistry | undefined;

export function getRegionRegistry(): RegionRegistry {
  if (!instance) {
    instance = new RegionRegistry();
  }
  return instance;
}

export default RegionRegistry;
