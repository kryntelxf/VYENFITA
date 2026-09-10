/**
 * VYENFITA Health Service
 * 
 * Dependency health checks:
 * - Database (PostgreSQL)
 * - AI providers
 * - Workflow engine
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import { getAIService } from '../ai/ai.service';
import { checkDatabaseHealth } from '../database/client';

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  latencyMs?: number;
  critical: boolean;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheck[];
}

const startTime = Date.now();

export class HealthService {
  /**
   * Full health check
   */
  static async check(): Promise<HealthReport> {
    const checks: HealthCheck[] = [];

    // Database
    const dbStart = Date.now();
    try {
      const dbHealth = await checkDatabaseHealth();
      checks.push({
        name: 'database',
        status: dbHealth.healthy ? 'pass' : 'fail',
        message: dbHealth.error || 'Connection OK',
        latencyMs: Date.now() - dbStart,
        critical: true,
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - dbStart,
        critical: true,
      });
    }

    // AI providers
    try {
      const ai = getAIService();
      const aiStart = Date.now();
      const aiHealth = await ai.healthCheck();

      for (const [providerName, info] of Object.entries(aiHealth.providers)) {
        checks.push({
          name: `ai_${providerName}`,
          status: info.healthy ? 'pass' : 'fail',
          message: info.healthy
            ? `Healthy (circuit: ${info.circuit})`
            : `Unhealthy (circuit: ${info.circuit})`,
          latencyMs: info.latencyMs,
          critical: false,
        });
      }

      if (Object.keys(aiHealth.providers).length === 0) {
        checks.push({
          name: 'ai_providers',
          status: 'warn',
          message: 'No AI providers configured',
          critical: false,
        });
      }
    } catch (error) {
      checks.push({
        name: 'ai_providers',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Unknown error',
        critical: false,
      });
    }

    // Determine overall status
    const criticalFailing = checks.filter((c) => c.critical && c.status === 'fail');
    const nonCriticalFailing = checks.filter((c) => !c.critical && c.status === 'fail');

    let status: HealthReport['status'] = 'healthy';
    if (criticalFailing.length > 0) {
      status = 'unhealthy';
    } else if (nonCriticalFailing.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks,
    };
  }

  /**
   * Liveness check (is the process alive?)
   */
  static liveness(): { alive: boolean; uptime: number } {
    return {
      alive: true,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
  }

  /**
   * Readiness check (can it accept traffic?)
   */
  static async readiness(): Promise<{ ready: boolean; reason?: string }> {
    // Check database only — if DB is down, we're not ready
    try {
      const dbHealth = await checkDatabaseHealth();
      if (!dbHealth.healthy) {
        return { ready: false, reason: 'Database unavailable' };
      }
      return { ready: true };
    } catch (error) {
      return {
        ready: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  }
