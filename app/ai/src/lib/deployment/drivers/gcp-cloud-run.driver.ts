/**
 * VYENFITA GCP Cloud Run Deployment Driver
 * 
 * Deploys to Google Cloud Run:
 * - Creates/updates Cloud Run service
 * - Waits for revision readiness
 * - Health check via Cloud Run status
 * 
 * @version 1.0.0
 */

import {
  DeploymentDriver,
  DeploymentArtifact,
  DeployRequest,
  DeployResult,
  DeploymentLogEntry,
  HealthCheckResult,
} from '../deployment.interface';

export interface GCPCloudRunConfig {
  projectId: string;
  region: string;
  serviceAccountJson?: string; // base64-encoded service account
  accessToken?: string;
}

export class GCPCloudRunDriver implements DeploymentDriver {
  readonly type = 'gcp-cloud-run';

  private config: GCPCloudRunConfig;
  private baseUrl = 'https://run.googleapis.com/v2';

  constructor(config: GCPCloudRunConfig) {
    this.config = config;
  }

  async deploy(
    artifact: DeploymentArtifact,
    request: DeployRequest,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<DeployResult> {
    const startTime = Date.now();
    const serviceName = `vyenfita-${request.applicationId.substring(0, 8)}`;

    try {
      const token = await this.getAccessToken();

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Starting GCP Cloud Run deployment',
        data: { serviceName, region: this.config.region },
      });

      const image = request.config?.image || process.env.RUNTIME_IMAGE || 'us-docker.pkg.dev/cloudrun/container/hello:latest';

      const body = {
        template: {
          containers: [
            {
              image,
              env: [
                { name: 'APPLICATION_ID', value: request.applicationId },
                { name: 'ENVIRONMENT_ID', value: request.environmentId },
                { name: 'VERSION_ID', value: request.versionId },
              ],
              resources: {
                limits: {
                  cpu: request.config?.cpu || '1',
                  memory: request.config?.memory || '512Mi',
                },
              },
            },
          ],
          scaling: {
            minInstanceCount: request.config?.minInstances || 0,
            maxInstanceCount: request.config?.maxInstances || 10,
          },
        },
      };

      // Check if service exists
      const exists = await this.serviceExists(serviceName, token);

      const url = exists
        ? `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.region}/services/${serviceName}`
        : `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.region}/services?serviceId=${serviceName}`;

      const response = await fetch(url, {
        method: exists ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`GCP API error: ${response.status} ${text}`);
      }

      const result = (await response.json()) as any;

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Cloud Run service deployed, waiting for readiness',
      });

      // Wait for readiness
      const ready = await this.waitForReady(serviceName, token, 300000);

      if (!ready) {
        return {
          success: false,
          deploymentId: serviceName,
          error: 'Service did not become ready in time',
          durationMs: Date.now() - startTime,
          logs: [],
        };
      }

      // Get service URL
      const serviceUrl = await this.getServiceUrl(serviceName, token);

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        deploymentId: serviceName,
        url: serviceUrl || `gcp-cloud-run://${this.config.region}/${serviceName}`,
        durationMs,
        logs: [],
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Cloud Run deployment failed';

      logger({
        timestamp: new Date(),
        level: 'error',
        message: 'Cloud Run deployment failed',
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
    try {
      const token = await this.getAccessToken();
      const url = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.region}/services/${deploymentId}`;

      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  }

  async healthCheck(url: string, timeoutMs: number): Promise<HealthCheckResult> {
    const timestamp = new Date();

    // If it's an HTTP(S) URL, use HTTP health check
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const startTime = Date.now();
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        return {
          healthy: response.ok,
          status: response.ok ? 'healthy' : 'unhealthy',
          checks: [
            {
              name: 'http_response',
              status: response.ok ? 'pass' : 'fail',
              message: `HTTP ${response.status}`,
              latencyMs: Date.now() - startTime,
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
              name: 'http_response',
              status: 'fail',
              message: error instanceof Error ? error.message : 'Unknown',
            },
          ],
          timestamp,
        };
      }
    }

    // Otherwise, check Cloud Run status
    try {
      const token = await this.getAccessToken();
      const serviceName = url.split('/').pop()!;
      const apiUrl = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.region}/services/${serviceName}`;

      const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return {
          healthy: false,
          status: 'unhealthy',
          checks: [{ name: 'service_status', status: 'fail', message: `HTTP ${response.status}` }],
          timestamp,
        };
      }

      const data = (await response.json()) as any;
      const ready = data.terminalCondition?.type === 'Ready' &&
        data.terminalCondition?.state === 'CONDITION_SUCCEEDED';

      return {
        healthy: ready,
        status: ready ? 'healthy' : 'unhealthy',
        checks: [
          {
            name: 'cloud_run_ready',
            status: ready ? 'pass' : 'fail',
            message: ready ? 'Service is ready' : 'Service is not ready',
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
            name: 'health_check',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown',
          },
        ],
        timestamp,
      };
    }
  }

  validate(target: DeployRequest['target']): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.projectId) errors.push('projectId is required');
    if (!this.config.region) errors.push('region is required');
    if (!this.config.serviceAccountJson && !this.config.accessToken) {
      errors.push('serviceAccountJson or accessToken is required');
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private async getAccessToken(): Promise<string> {
    if (this.config.accessToken) {
      return this.config.accessToken;
    }

    if (!this.config.serviceAccountJson) {
      throw new Error('No service account or access token configured');
    }

    // In production, use google-auth-library
    // For now, expect accessToken to be provided
    throw new Error('Service account authentication requires google-auth-library package');
  }

  private async serviceExists(serviceName: string, token: string): Promise<boolean> {
    const url = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.region}/services/${serviceName}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async waitForReady(
    serviceName: string,
    token: string,
    timeoutMs: number
  ): Promise<boolean> {
    const start = Date.now();
    const url = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.region}/services/${serviceName}`;

    while (Date.now() - start < timeoutMs) {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const ready = data.terminalCondition?.type === 'Ready' &&
            data.terminalCondition?.state === 'CONDITION_SUCCEEDED';

          if (ready) return true;
        }
      } catch {}

      await this.sleep(5000);
    }

    return false;
  }

  private async getServiceUrl(serviceName: string, token: string): Promise<string | null> {
    const url = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.region}/services/${serviceName}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        return data.uri || null;
      }
    } catch {}

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  }
