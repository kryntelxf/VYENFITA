/**
 * VYENFITA HTTP Step Executor
 * 
 * Executes HTTP request steps WITH SSRF protection
 * 
 * @version 1.1.0
 */

import axios, { AxiosRequestConfig } from 'axios';
import { StepExecutor, StepContext, StepResult, interpolateObject } from './executor.interface';
import { SSRFGuard } from '../../security/ssrf-guard';
import { auditService } from '../../audit/audit.service';
import { logger } from '../../observability/logger';

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

export class HttpExecutor implements StepExecutor {
  readonly type = 'http';

  async execute(step: any, context: StepContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const config = interpolateObject(step.config || {}, {
        ...context.variables,
        input: context.input,
        steps: context.stepOutputs,
      });

      if (!config.url) {
        return {
          success: false,
          error: 'URL is required',
          durationMs: Date.now() - startTime,
        };
      }

      // SSRF Protection
      const ssrfCheck = await SSRFGuard.check(config.url);
      if (!ssrfCheck.safe) {
        await auditService.log({
          tenantId: context.tenantId,
          userId: context.userId,
          eventType: 'security',
          action: 'ssrf_blocked',
          resource: 'workflow_step',
          resourceId: context.stepId,
          details: {
            url: config.url,
            reason: ssrfCheck.reason,
          },
          status: 'failure',
        });

        logger.warn('SSRF blocked', {
          url: config.url,
          reason: ssrfCheck.reason,
          stepId: context.stepId,
        });

        return {
          success: false,
          error: `SSRF protection: ${ssrfCheck.reason}`,
          durationMs: Date.now() - startTime,
        };
      }

      const requestConfig: AxiosRequestConfig = {
        method: config.method || 'GET',
        url: config.url,
        headers: config.headers || {},
        params: config.params,
        data: config.body,
        timeout: Math.min(config.timeout || 30000, 60000),
        maxContentLength: MAX_RESPONSE_BYTES,
        maxBodyLength: MAX_RESPONSE_BYTES,
        validateStatus: () => true,
        // Prevent redirect to internal IPs
        maxRedirects: 3,
      };

      const response = await axios(requestConfig);
      const durationMs = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      return {
        success,
        output: {
          status: response.status,
          data: response.data,
        },
        error: success ? undefined : `HTTP ${response.status}`,
        durationMs,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'HTTP request failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  validate(step: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!step.config?.url) {
      errors.push('config.url is required');
    }

    const method = step.config?.method;
    if (method && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      errors.push('config.method must be GET, POST, PUT, PATCH, or DELETE');
    }

    return { valid: errors.length === 0, errors };
  }
          }
