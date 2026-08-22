/**
 * VYENFITA Step Executor
 * Executes individual workflow steps
 */

import axios from 'axios';
import { Logger } from 'winston';

export interface StepContext {
  variables: Record<string, any>;
  stepId: string;
  workflowId: string;
  executionId: string;
  tenantId: string;
}

export interface StepResult {
  success: boolean;
  output?: any;
  error?: string;
  nextStepId?: string;
}

export class StepExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute a single workflow step
   */
  async execute(step: any, context: StepContext): Promise<StepResult> {
    this.logger.info(`Executing step: ${step.id} (${step.type})`, {
      workflowId: context.workflowId,
      stepId: step.id,
    });

    try {
      switch (step.type) {
        case 'action':
          return await this.executeAction(step, context);
        case 'condition':
          return this.executeCondition(step, context);
        case 'loop':
          return await this.executeLoop(step, context);
        case 'wait':
          return await this.executeWait(step, context);
        case 'parallel':
          return await this.executeParallel(step, context);
        case 'notification':
          return await this.executeNotification(step, context);
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } catch (error) {
      this.logger.error(`Step execution failed: ${step.id}`, {
        stepId: step.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute an action step
   */
  private async executeAction(step: any, context: StepContext): Promise<StepResult> {
    const action = step.action;
    const config = this.interpolateVariables(step.config, context.variables);

    this.logger.debug(`Executing action: ${action}`, { stepId: step.id });

    let output: any = null;

    switch (action) {
      case 'send_email':
        output = await this.sendEmail(config);
        break;
      case 'update_database':
        output = await this.updateDatabase(config);
        break;
      case 'call_api':
        output = await this.callAPI(config);
        break;
      case 'notify':
        output = await this.notify(config);
        break;
      case 'transform':
        output = this.transformData(config);
        break;
      case 'filter':
        output = this.filterData(config);
        break;
      case 'aggregate':
        output = this.aggregateData(config);
        break;
      case 'approval':
        output = await this.requestApproval(config);
        break;
      case 'webhook':
        output = await this.sendWebhook(config);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return {
      success: true,
      output,
    };
  }

  /**
   * Execute a condition step
   */
  private executeCondition(step: any, context: StepContext): StepResult {
    const conditions = step.conditions || [];
    const variables = context.variables;

    for (const condition of conditions) {
      const value = this.getNestedValue(variables, condition.field);
      let passed = false;

      switch (condition.operator) {
        case 'equals':
          passed = value === condition.value;
          break;
        case 'not_equals':
          passed = value !== condition.value;
          break;
        case 'greater_than':
          passed = value > condition.value;
          break;
        case 'less_than':
          passed = value < condition.value;
          break;
        case 'contains':
          passed = String(value).includes(String(condition.value));
          break;
        case 'starts_with':
          passed = String(value).startsWith(String(condition.value));
          break;
        case 'ends_with':
          passed = String(value).endsWith(String(condition.value));
          break;
        case 'is_true':
          passed = Boolean(value) === true;
          break;
        case 'is_false':
          passed = Boolean(value) === false;
          break;
        case 'is_null':
          passed = value === null || value === undefined;
          break;
        default:
          throw new Error(`Unknown operator: ${condition.operator}`);
      }

      if (!passed) {
        return {
          success: true,
          output: { passed: false, failedCondition: condition.field },
          nextStepId: step.onFalse || undefined,
        };
      }
    }

    return {
      success: true,
      output: { passed: true },
      nextStepId: step.onTrue || undefined,
    };
  }

  /**
   * Execute a loop step
   */
  private async executeLoop(step: any, context: StepContext): Promise<StepResult> {
    const items = this.getNestedValue(context.variables, step.config.items || 'items');
    
    if (!Array.isArray(items)) {
      throw new Error('Loop items must be an array');
    }

    const results = [];
    for (let i = 0; i < items.length && i < (step.config.maxIterations || 100); i++) {
      const loopContext = {
        ...context,
        variables: {
          ...context.variables,
          index: i,
          item: items[i],
        },
      };
      // Note: Step execution inside loop would be handled by the workflow engine
      results.push({ index: i, item: items[i] });
    }

    return {
      success: true,
      output: { results },
    };
  }

  /**
   * Execute a wait step
   */
  private async executeWait(step: any, context: StepContext): Promise<StepResult> {
    const duration = step.config.duration || 5000;
    this.logger.debug(`Waiting for ${duration}ms`, { stepId: step.id });
    await this.sleep(duration);
    return { success: true, output: { waited: duration } };
  }

  /**
   * Execute parallel steps
   */
  private async executeParallel(step: any, context: StepContext): Promise<StepResult> {
    const branches = step.config.branches || [];
    const results = await Promise.all(
      branches.map(async (branch: any) => {
        // Note: This would recursively execute steps
        // Simplified for now
        return { branch: branch.id, status: 'pending' };
      })
    );

    return {
      success: true,
      output: { branches: results },
    };
  }

  /**
   * Execute a notification step
   */
  private async executeNotification(step: any, context: StepContext): Promise<StepResult> {
    const config = this.interpolateVariables(step.config, context.variables);
    
    // Send notification (simplified)
    this.logger.info(`Notification: ${config.message || 'No message'}`, {
      to: config.to || 'unknown',
      type: config.type || 'info',
      stepId: step.id,
    });

    return {
      success: true,
      output: { sent: true, to: config.to },
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private interpolateVariables(config: any, variables: Record<string, any>): any {
    if (typeof config === 'string') {
      return config.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        return this.getNestedValue(variables, trimmedKey) ?? match;
      });
    }
    if (Array.isArray(config)) {
      return config.map(item => this.interpolateVariables(item, variables));
    }
    if (typeof config === 'object' && config !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(config)) {
        result[key] = this.interpolateVariables(value, variables);
      }
      return result;
    }
    return config;
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================
  // ACTION IMPLEMENTATIONS
  // ============================================================

  private async sendEmail(config: any): Promise<any> {
    // TODO: Integrate with email provider (SendGrid, SES, etc.)
    this.logger.info(`Email sent: ${config.subject || 'No subject'}`, {
      to: config.to,
      from: config.from,
    });
    return { sent: true, to: config.to };
  }

  private async updateDatabase(config: any): Promise<any> {
    // TODO: Integrate with database
    this.logger.info(`Database update: ${config.collection || 'unknown'}`, {
      query: config.query,
    });
    return { updated: true };
  }

  private async callAPI(config: any): Promise<any> {
    const response = await axios({
      method: config.method || 'GET',
      url: config.url,
      data: config.body || {},
      headers: config.headers || {},
      timeout: config.timeout || 30000,
    });
    return response.data;
  }

  private async notify(config: any): Promise<any> {
    // TODO: Integrate with notification providers (Slack, etc.)
    this.logger.info(`Notification: ${config.message || 'No message'}`, {
      to: config.to,
    });
    return { sent: true };
  }

  private transformData(config: any): any {
    const data = config.data || [];
    const transformation = config.transformation || {};
    // Simplified transformation
    return data.map((item: any) => {
      const result: any = {};
      for (const [key, value] of Object.entries(transformation)) {
        result[key] = this.getNestedValue(item, String(value));
      }
      return result;
    });
  }

  private filterData(config: any): any {
    const data = config.data || [];
    const filter = config.filter || {};
    return data.filter((item: any) => {
      const fieldValue = this.getNestedValue(item, filter.field);
      return fieldValue === filter.value;
    });
  }

  private aggregateData(config: any): any {
    const data = config.data || [];
    const groupBy = config.groupBy || [];
    // Simplified aggregation
    return data.reduce((acc: any, item: any) => {
      const key = groupBy.map((field: string) => this.getNestedValue(item, field)).join('|');
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  private async requestApproval(config: any): Promise<any> {
    // TODO: Implement approval workflow
    this.logger.info(`Approval requested: ${config.message || 'No message'}`, {
      approvers: config.approvers,
    });
    return { requested: true, pending: true };
  }

  private async sendWebhook(config: any): Promise<any> {
    const response = await axios({
      method: 'POST',
      url: config.url,
      data: config.payload || {},
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  }
      }
