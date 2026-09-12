/**
 * VYENFITA Vercel Deployment Driver
 * 
 * Deploys to Vercel:
 * - Uses Vercel API to create deployment
 * - Waits for deployment readiness
 * - Health check via deployment URL
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

export interface VercelConfig {
  token: string;
  teamId?: string;
  projectName?: string;
}

export class VercelDriver implements DeploymentDriver {
  readonly type = 'vercel';

  private config: VercelConfig;
  private baseUrl = 'https://api.vercel.com';

  constructor(config: VercelConfig) {
    this.config = config;
  }

  async deploy(
    artifact: DeploymentArtifact,
    request: DeployRequest,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<DeployResult> {
    const startTime = Date.now();
    const projectName = this.config.projectName || `vyenfita-${request.applicationId.substring(0, 8)}`;

    try {
      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Starting Vercel deployment',
        data: { projectName },
      });

      // Vercel deployment requires the source code to be uploaded
      // Since we only have a spec artifact, we'll create a deployment with a placeholder
      // In production, this would upload the artifact contents

      const body = {
        name: projectName,
        files: [
          {
            file: 'package.json',
            data: JSON.stringify({
              name: projectName,
              version: artifact.version,
              scripts: {
                start: 'node server.js',
              },
            }),
          },
          {
            file: 'server.js',
            data: `
              const http = require('http');
              const server = http.createServer((req, res) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  applicationId: '${request.applicationId}',
                  version: '${artifact.version}',
                  status: 'running'
                }));
              });
              server.listen(3000);
            `,
          },
          {
            file: 'vercel.json',
            data: JSON.stringify({
              version: 2,
              builds: [{ src: 'server.js', use: '@vercel/node' }],
              routes: [{ src: '/(.*)', dest: 'server.js' }],
            }),
          },
        ],
        projectSettings: {
          framework: null,
        },
        target: 'production',
      };

      const query = this.config.teamId ? `?teamId=${this.config.teamId}` : '';

      const response = await fetch(`${this.baseUrl}/v13/deployments${query}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Vercel API error: ${response.status} ${text}`);
      }

      const deployment = (await response.json()) as any;

      logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Deployment created, waiting for readiness',
        data: { deploymentId: deployment.id, url: deployment.url },
      });

      // Wait for deployment to be ready
      const ready = await this.waitForReady(deployment.id, 300000);

      if (!ready) {
        return {
          success: false,
          deploymentId: deployment.id,
          error: 'Deployment did not become ready in time',
          durationMs: Date.now() - startTime,
          logs: [],
        };
      }

      const durationMs = Date.now() - startTime;
      const url = `https://${deployment.url}`;

      return {
        success: true,
        deploymentId: deployment.id,
        url,
        durationMs,
        logs: [],
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Vercel deployment failed';

      logger({
        timestamp: new Date(),
        level: 'error',
        message: 'Vercel deployment failed',
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
      const query = this.config.teamId ? `?teamId=${this.config.teamId}` : '';
      await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}${query}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
    } catch {}
  }

  async healthCheck(url: string, timeoutMs: number): Promise<HealthCheckResult> {
    const timestamp = new Date();

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

  validate(target: DeployRequest['target']): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.token) errors.push('token is required');

    return { valid: errors.length === 0, errors };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private async waitForReady(deploymentId: string, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    const query = this.config.teamId ? `?teamId=${this.config.teamId}` : '';

    while (Date.now() - start < timeoutMs) {
      try {
        const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}${query}`, {
          headers: { Authorization: `Bearer ${this.config.token}` },
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data.readyState === 'READY') return true;
          if (data.readyState === 'ERROR') return false;
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
