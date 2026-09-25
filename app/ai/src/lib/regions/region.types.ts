/**
 * VYENFITA Region Types
 * 
 * @version 1.0.0
 */

export type RegionCode = 
  | 'us-east-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'eu-central-1'
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'ap-northeast-1'
  | 'ap-south-1'
  | 'sa-east-1';

export type RegionStatus = 'healthy' | 'degraded' | 'unhealthy' | 'maintenance';

export interface RegionDefinition {
  code: RegionCode;
  name: string;
  provider: 'aws' | 'gcp' | 'azure';
  location: string;
  latitude: number;
  longitude: number;
  
  // Infrastructure
  apiEndpoint: string;
  wsEndpoint: string;
  cdnEndpoint?: string;
  
  // Data
  dataResidency: 'US' | 'EU' | 'APAC' | 'GLOBAL';
  databaseEndpoint?: string;
  storageBucket?: string;
  
  // Configuration
  isPrimary: boolean;
  replicationTargets: RegionCode[];
  weight: number; // For weighted routing
}

export interface RegionHealth {
  regionCode: RegionCode;
  status: RegionStatus;
  latencyMs: number;
  lastCheck: Date;
  error?: string;
  metrics: {
    cpuPercent: number;
    memoryPercent: number;
    requestsPerSecond: number;
    errorRate: number;
  };
}

export interface DataResidencyPolicy {
  id: string;
  tenantId: string;
  allowedRegions: RegionCode[];
  primaryRegion: RegionCode;
  dataTypes: Array<{
    type: 'user_data' | 'application_data' | 'analytics' | 'logs' | 'backups';
    regions: RegionCode[];
  }>;
  strict: boolean; // If true, data CANNOT leave allowed regions
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoLocation {
  country: string;
  region?: string;
  city?: string;
  latitude: number;
  longitude: number;
}

export class RegionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'RegionError';
  }
}
