/**
 * VYENFITA Metrics Service
 * 
 * Prometheus-compatible metrics registry
 * - Counters (monotonic increase)
 * - Gauges (current value)
 * - Histograms (distribution)
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';

export type MetricLabels = Record<string, string | number>;

interface CounterMetric {
  type: 'counter';
  help: string;
  values: Map<string, { labels: MetricLabels; value: number }>;
}

interface GaugeMetric {
  type: 'gauge';
  help: string;
  values: Map<string, { labels: MetricLabels; value: number }>;
}

interface HistogramMetric {
  type: 'histogram';
  help: string;
  buckets: number[];
  values: Map<string, { labels: MetricLabels; buckets: number[]; sum: number; count: number }>;
}

type Metric = CounterMetric | GaugeMetric | HistogramMetric;

export class MetricsService {
  private metrics: Map<string, Metric> = new Map();

  // ============================================================
  // COUNTER
  // ============================================================

  registerCounter(name: string, help: string): void {
    if (this.metrics.has(name)) return;
    this.metrics.set(name, {
      type: 'counter',
      help,
      values: new Map(),
    });
  }

  incrementCounter(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      // Auto-register
      this.registerCounter(name, name);
      return this.incrementCounter(name, labels, value);
    }

    const key = this.labelKey(labels);
    const existing = metric.values.get(key);
    if (existing) {
      existing.value += value;
    } else {
      metric.values.set(key, { labels, value });
    }
  }

  // ============================================================
  // GAUGE
  // ============================================================

  registerGauge(name: string, help: string): void {
    if (this.metrics.has(name)) return;
    this.metrics.set(name, {
      type: 'gauge',
      help,
      values: new Map(),
    });
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      this.registerGauge(name, name);
      return this.setGauge(name, value, labels);
    }

    const key = this.labelKey(labels);
    metric.values.set(key, { labels, value });
  }

  // ============================================================
  // HISTOGRAM
  // ============================================================

  registerHistogram(name: string, help: string, buckets: number[] = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]): void {
    if (this.metrics.has(name)) return;
    this.metrics.set(name, {
      type: 'histogram',
      help,
      buckets,
      values: new Map(),
    });
  }

  observeHistogram(name: string, value: number, labels: MetricLabels = {}): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      this.registerHistogram(name, name);
      return this.observeHistogram(name, value, labels);
    }

    const key = this.labelKey(labels);
    let entry = metric.values.get(key);
    if (!entry) {
      entry = {
        labels,
        buckets: new Array(metric.buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      metric.values.set(key, entry);
    }

    entry.sum += value;
    entry.count++;

    for (let i = 0; i < metric.buckets.length; i++) {
      if (value <= metric.buckets[i]) {
        entry.buckets[i]++;
      }
    }
  }

  // ============================================================
  // EXPOSITION (Prometheus format)
  // ============================================================

  expose(): string {
    const lines: string[] = [];

    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      if (metric.type === 'counter' || metric.type === 'gauge') {
        for (const entry of metric.values.values()) {
          const labels = this.formatLabels(entry.labels);
          lines.push(`${name}${labels} ${entry.value}`);
        }
      } else if (metric.type === 'histogram') {
        for (const entry of metric.values.values()) {
          const baseLabels = entry.labels;

          for (let i = 0; i < metric.buckets.length; i++) {
            const labels = this.formatLabels({
              ...baseLabels,
              le: String(metric.buckets[i]),
            });
            lines.push(`${name}_bucket${labels} ${entry.buckets[i]}`);
          }

          const infLabels = this.formatLabels({ ...baseLabels, le: '+Inf' });
          lines.push(`${name}_bucket${infLabels} ${entry.count}`);
          lines.push(`${name}_sum${this.formatLabels(baseLabels)} ${entry.sum}`);
          lines.push(`${name}_count${this.formatLabels(baseLabels)} ${entry.count}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private labelKey(labels: MetricLabels): string {
    const sorted = Object.keys(labels).sort();
    return sorted.map((k) => `${k}="${labels[k]}"`).join(',');
  }

  private formatLabels(labels: MetricLabels): string {
    const keys = Object.keys(labels);
    if (keys.length === 0) return '';

    const parts = keys.map((k) => `${k}="${this.escapeLabel(labels[k])}"`);
    return `{${parts.join(',')}}`;
  }

  private escapeLabel(value: string | number): string {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }
}

// ============================================================
// SINGLETON + DOMAIN METRICS
// ============================================================

let instance: MetricsService | undefined;

export function getMetrics(): MetricsService {
  if (!instance) {
    instance = new MetricsService();
    registerDomainMetrics(instance);
  }
  return instance;
}

function registerDomainMetrics(m: MetricsService): void {
  // HTTP
  m.registerCounter('vyenfita_http_requests_total', 'Total HTTP requests');
  m.registerCounter('vyenfita_http_errors_total', 'Total HTTP errors');
  m.registerHistogram('vyenfita_http_request_duration_ms', 'HTTP request duration in ms');

  // Auth
  m.registerCounter('vyenfita_auth_attempts_total', 'Authentication attempts');
  m.registerCounter('vyenfita_auth_failures_total', 'Authentication failures');

  // AI
  m.registerCounter('vyenfita_ai_requests_total', 'Total AI requests');
  m.registerCounter('vyenfita_ai_errors_total', 'AI request errors');
  m.registerCounter('vyenfita_ai_tokens_total', 'Total AI tokens used');
  m.registerHistogram('vyenfita_ai_latency_ms', 'AI request latency');

  // Workflow
  m.registerCounter('vyenfita_workflow_executions_total', 'Total workflow executions');
  m.registerCounter('vyenfita_workflow_failures_total', 'Workflow execution failures');
  m.registerHistogram('vyenfita_workflow_duration_ms', 'Workflow execution duration');

  // Deployments
  m.registerCounter('vyenfita_deployments_total', 'Total deployments');
  m.registerCounter('vyenfita_deployment_failures_total', 'Deployment failures');
  m.registerHistogram('vyenfita_deployment_duration_ms', 'Deployment duration');

  // Tenant
  m.registerCounter('vyenfita_tenant_created_total', 'Tenants created');
  m.registerGauge('vyenfita_active_tenants', 'Active tenants');
  m.registerGauge('vyenfita_active_users', 'Active users');

  // Database
  m.registerHistogram('vyenfita_db_query_duration_ms', 'Database query duration');
  }
