/**
 * VYENFITA HTTP Step Executor
 * 
 * Executes HTTP request steps
 * 
 * @version 1.0.0
 */

import axios, { AxiosRequestConfig } from 'axios';
import { StepExecutor, StepContext, StepResult, interpolateObject } from './executor.interface';

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

      const requestConfig: AxiosRequestConfig = {
        method: config.method || 'GET',
        url: config.url,
        headers: config.headers || {},
        params: config.params,
        data: config.body,
        timeout: config.timeout || 30000,
        validateStatus: () => true, // We handle status ourselves
      };

      if (!requestConfig.url) {
        return {
          success: false,
          error: 'URL is required',
          durationMs: Date.now() - startTime,
        };
      }

      const response = await axios(requestConfig);
      const durationMs = Date.now() - startTime;

      // Consider 2xx as success
      const success = response.status >= 200 && response.status < 300;

      return {
        success,
        output: {
          status: response.status,
          headers: response.headers,
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
