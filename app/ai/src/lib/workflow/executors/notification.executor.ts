/**
 * VYENFITA Notification Step Executor
 * 
 * Sends notifications via email/Slack/webhook
 * 
 * @version 1.0.0
 */

import axios from 'axios';
import { StepExecutor, StepContext, StepResult, interpolateObject } from './executor.interface';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export class NotificationExecutor implements StepExecutor {
  readonly type = 'notification';

  async execute(step: any, context: StepContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const config = interpolateObject(step.config || {}, {
        ...context.variables,
        input: context.input,
        steps: context.stepOutputs,
      });

      const channel = config.channel || 'log';

      switch (channel) {
        case 'webhook':
          return await this.sendWebhook(config, startTime);
        case 'slack':
          return await this.sendSlack(config, startTime);
        case 'log':
        default:
          return this.logOnly(config, startTime);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Notification failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  validate(step: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const channel = step.config?.channel || 'log';

    if (channel === 'webhook' && !step.config?.url) {
      errors.push('config.url is required for webhook channel');
    }

    if (channel === 'slack' && !step.config?.webhookUrl) {
      errors.push('config.webhookUrl is required for slack channel');
    }

    return { valid: errors.length === 0, errors };
  }

  private async sendWebhook(config: any, startTime: number): Promise<StepResult> {
    const response = await axios.post(
      config.url,
      {
        message: config.message,
        title: config.title,
        data: config.data,
      },
      {
        timeout: config.timeout || 10000,
        headers: config.headers || {},
      }
    );

    return {
      success: response.status >= 200 && response.status < 300,
      output: { status: response.status, sent: true },
      durationMs: Date.now() - startTime,
    };
  }

  private async sendSlack(config: any, startTime: number): Promise<StepResult> {
    const response = await axios.post(
      config.webhookUrl,
      {
        text: config.message || 'VYENFITA Notification',
        blocks: config.blocks,
      },
      { timeout: 10000 }
    );

    return {
      success: response.status >= 200 && response.status < 300,
      output: { status: response.status, sent: true },
      durationMs: Date.now() - startTime,
    };
  }

  private logOnly(config: any, startTime: number): StepResult {
    logger.info('[Notification]', {
      title: config.title,
      message: config.message,
      data: config.data,
    });

    return {
      success: true,
      output: { logged: true, message: config.message },
      durationMs: Date.now() - startTime,
    };
  }
  }
