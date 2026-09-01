/**
 * VYENFITA Workflow Analytics Service
 * 
 * Tracks and analyzes workflow performance
 * - Execution metrics
 * - Step performance
 * - Error rates
 * - SLA compliance
 * - Trend analysis
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface WorkflowExecutionMetric {
  id: string;
  workflowId: string;
  workflowName: string;
  tenantId: string;
  executionId: string;
  status: 'success' | 'failed' | 'pending' | 'running';
  startTime: Date;
  endTime?: Date;
  duration: number;
  stepsTotal: number;
  stepsCompleted: number;
  stepsFailed: number;
  errorMessage?: string;
  cost?: number;
  metadata: Record<string, any>;
}

export interface WorkflowAnalytics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  errorRate: number;
  executionsByStatus: Record<string, number>;
  executionsByHour: Record<number, number>;
  executionsByDay: Record<string, number>;
  topErrors: { message: string; count: number }[];
  averageStepsPerExecution: number;
  costSummary: {
    total: number;
    average: number;
    byWorkflow: Record<string, number>;
  };
  slaCompliance: {
    met: number;
    missed: number;
    rate: number;
  };
}

export interface SLAConfig {
  workflowId: string;
  maxDuration: number;
  criticalSteps: string[];
  notificationEnabled: boolean;
  notificationChannels: string[];
}

export class WorkflowAnalyticsService {
  private metrics: Map<string, WorkflowExecutionMetric>;
  private slaConfigs: Map<string, SLAConfig>;

  constructor() {
    this.metrics = new Map();
    this.slaConfigs = new Map();
  }

  /**
   * Record a workflow execution
   */
  recordExecution(metric: Omit<WorkflowExecutionMetric, 'id'>): WorkflowExecutionMetric {
    const record: WorkflowExecutionMetric = {
      id: uuidv4(),
      ...metric,
    };
    this.metrics.set(record.id, record);
    return record;
  }

  /**
   * Get workflow analytics
   */
  getAnalytics(workflowId: string, timeRange?: { start: Date; end: Date }): WorkflowAnalytics {
    const executions = this.getExecutions(workflowId, timeRange);
    const total = executions.length;

    if (total === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        errorRate: 0,
        executionsByStatus: {},
        executionsByHour: {},
        executionsByDay: {},
        topErrors: [],
        averageStepsPerExecution: 0,
        costSummary: {
          total: 0,
          average: 0,
          byWorkflow: {},
        },
        slaCompliance: {
          met: 0,
          missed: 0,
          rate: 0,
        },
      };
    }

    const success = executions.filter(e => e.status === 'success');
    const failed = executions.filter(e => e.status === 'failed');
    const totalDuration = executions.reduce((sum, e) => sum + (e.duration || 0), 0);

    // Status breakdown
    const executionsByStatus: Record<string, number> = {};
    for (const exec of executions) {
      executionsByStatus[exec.status] = (executionsByStatus[exec.status] || 0) + 1;
    }

    // Hourly breakdown
    const executionsByHour: Record<number, number> = {};
    for (const exec of executions) {
      const hour = exec.startTime.getHours();
      executionsByHour[hour] = (executionsByHour[hour] || 0) + 1;
    }

    // Daily breakdown
    const executionsByDay: Record<string, number> = {};
    for (const exec of executions) {
      const day = exec.startTime.toDateString();
      executionsByDay[day] = (executionsByDay[day] || 0) + 1;
    }

    // Top errors
    const errorMap: Record<string, number> = {};
    for (const exec of failed) {
      if (exec.errorMessage) {
        errorMap[exec.errorMessage] = (errorMap[exec.errorMessage] || 0) + 1;
      }
    }
    const topErrors = Object.entries(errorMap)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cost summary
    const totalCost = executions.reduce((sum, e) => sum + (e.cost || 0), 0);
    const costByWorkflow: Record<string, number> = {};
    for (const exec of executions) {
      if (exec.cost) {
        costByWorkflow[exec.workflowId] = (costByWorkflow[exec.workflowId] || 0) + exec.cost;
      }
    }

    // SLA compliance
    const slaConfig = this.slaConfigs.get(workflowId);
    let slaMet = 0;
    let slaMissed = 0;
    if (slaConfig) {
      for (const exec of executions) {
        if (exec.duration <= slaConfig.maxDuration) {
          slaMet++;
        } else {
          slaMissed++;
        }
      }
    }

    return {
      totalExecutions: total,
      successRate: (success.length / total) * 100,
      averageDuration: totalDuration / total,
      errorRate: (failed.length / total) * 100,
      executionsByStatus,
      executionsByHour,
      executionsByDay,
      topErrors,
      averageStepsPerExecution: executions.reduce((sum, e) => sum + e.stepsTotal, 0) / total,
      costSummary: {
        total: totalCost,
        average: totalCost / total,
        byWorkflow: costByWorkflow,
      },
      slaCompliance: {
        met: slaMet,
        missed: slaMissed,
        rate: slaMet + slaMissed > 0 ? (slaMet / (slaMet + slaMissed)) * 100 : 100,
      },
    };
  }

  /**
   * Get executions for a workflow
   */
  getExecutions(workflowId: string, timeRange?: { start: Date; end: Date }): WorkflowExecutionMetric[] {
    const result: WorkflowExecutionMetric[] = [];
    for (const metric of this.metrics.values()) {
      if (metric.workflowId === workflowId) {
        if (timeRange) {
          if (metric.startTime >= timeRange.start && metric.startTime <= timeRange.end) {
            result.push(metric);
          }
        } else {
          result.push(metric);
        }
      }
    }
    return result.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get all executions for a tenant
   */
  getExecutionsByTenant(tenantId: string, limit?: number): WorkflowExecutionMetric[] {
    const result: WorkflowExecutionMetric[] = [];
    for (const metric of this.metrics.values()) {
      if (metric.tenantId === tenantId) {
        result.push(metric);
      }
    }
    const sorted = result.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Set SLA configuration
   */
  setSLAConfig(config: SLAConfig): void {
    this.slaConfigs.set(config.workflowId, config);
  }

  /**
   * Get SLA configuration
   */
  getSLAConfig(workflowId: string): SLAConfig | undefined {
    return this.slaConfigs.get(workflowId);
  }

  /**
   * Check SLA compliance for an execution
   */
  checkSLACompliance(executionId: string): { compliant: boolean; message?: string } {
    const metric = this.metrics.get(executionId);
    if (!metric) {
      return { compliant: false, message: 'Execution not found' };
    }

    const config = this.slaConfigs.get(metric.workflowId);
    if (!config) {
      return { compliant: true, message: 'No SLA configured' };
    }

    if (metric.duration > config.maxDuration) {
      return {
        compliant: false,
        message: `Execution exceeded SLA limit of ${config.maxDuration}ms (took ${metric.duration}ms)`,
      };
    }

    return { compliant: true };
  }

  /**
   * Get performance trends
   */
  getTrends(workflowId: string, period: 'hour' | 'day' | 'week' | 'month'): {
    timestamps: Date[];
    successRates: number[];
    durations: number[];
    errors: number[];
  } {
    const executions = this.getExecutions(workflowId);
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'hour':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const filtered = executions.filter(e => e.startTime >= start);
    const sorted = filtered.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return {
      timestamps: sorted.map(e => e.startTime),
      successRates: sorted.map(e => e.status === 'success' ? 1 : 0),
      durations: sorted.map(e => e.duration),
      errors: sorted.map(e => e.status === 'failed' ? 1 : 0),
    };
  }
}
