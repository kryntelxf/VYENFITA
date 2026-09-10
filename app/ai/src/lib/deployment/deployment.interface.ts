/**
 * VYENFITA Deployment Interface
 * 
 * Contract for all deployment drivers
 * 
 * @version 1.0.0
 */

export interface DeploymentTarget {
  id: string;
  type: 'docker' | 'kubernetes' | 'aws' | 'gcp' | 'azure' | 'vercel' | 'netlify' | 'custom';
  name: string;
  config: Record<string, any>;
}

export interface DeploymentArtifact {
  id: string;
  applicationId: string;
  version: string;
  path: string;
  sizeBytes: number;
  checksum: string;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface DeployRequest {
  tenantId: string;
  applicationId: string;
  environmentId: string;
  versionId: string;
  target: DeploymentTarget;
  config?: Record<string, any>;
  triggeredBy?: string;
}

export interface DeployResult {
  success: boolean;
  deploymentId: string;
  url?: string;
  containerId?: string;
  error?: string;
  durationMs: number;
  logs: DeploymentLogEntry[];
}

export interface DeploymentLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, any>;
}

export interface HealthCheckResult {
  healthy: boolean;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    latencyMs?: number;
  }[];
  timestamp: Date;
}

export interface DeploymentDriver {
  readonly type: string;

  /**
   * Deploy an artifact
   */
  deploy(
    artifact: DeploymentArtifact,
    request: DeployRequest,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<DeployResult>;

  /**
   * Remove a deployment
   */
  remove(deploymentId: string, target: DeploymentTarget): Promise<void>;

  /**
   * Health check a deployment
   */
  healthCheck(url: string, timeoutMs: number): Promise<HealthCheckResult>;

  /**
   * Validate target configuration
   */
  validate(target: DeploymentTarget): { valid: boolean; errors: string[] };
}

/**
 * Custom errors
 */
export class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}
