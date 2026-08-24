/**
 * VYENFITA Webhook Manager
 * 
 * Manages webhooks for VYENFITA platform
 * - Register webhooks
 * - Trigger webhooks
 * - Retry failed webhooks
 * - Webhook history
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  headers: Record<string, string>;
  enabled: boolean;
  retryConfig: {
    maxAttempts: number;
    delayMs: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: 'application_generated' | 'workflow_executed' | 'version_created' | 'bi_query' | 'approval_pending' | 'approval_resolved';
  timestamp: Date;
  data: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  response?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class WebhookManager {
  private webhooks: Map<string, Webhook>;
  private deliveries: Map<string, WebhookDelivery>;

  constructor() {
    this.webhooks = new Map();
    this.deliveries = new Map();
  }

  /**
   * Register a webhook
   */
  registerWebhook(
    name: string,
    url: string,
    events: WebhookEvent['type'][],
    headers: Record<string, string> = {},
    retryConfig = { maxAttempts: 3, delayMs: 5000 }
  ): Webhook {
    const webhook: Webhook = {
      id: uuidv4(),
      name,
      url,
      events: events.map(event => ({
        id: uuidv4(),
        type: event,
        timestamp: new Date(),
        data: {},
      })),
      headers,
      enabled: true,
      retryConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(webhookId: string): boolean {
    return this.webhooks.delete(webhookId);
  }

  /**
   * Trigger webhooks for an event
   */
  async trigger(eventType: WebhookEvent['type'], data: Record<string, any>): Promise<WebhookDelivery[]> {
    const deliveries: WebhookDelivery[] = [];
    const event: WebhookEvent = {
      id: uuidv4(),
      type: eventType,
      timestamp: new Date(),
      data,
    };

    // Find matching webhooks
    for (const webhook of this.webhooks.values()) {
      if (!webhook.enabled) continue;
      if (!webhook.events.some(e => e.type === eventType)) continue;

      // Create delivery
      const delivery: WebhookDelivery = {
        id: uuidv4(),
        webhookId: webhook.id,
        event,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      };

      deliveries.push(delivery);
    }

    // Execute deliveries
    for (const delivery of deliveries) {
      await this.executeDelivery(delivery);
    }

    return deliveries;
  }

  /**
   * Execute a single delivery
   */
  private async executeDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook) {
      delivery.status = 'failed';
      delivery.error = 'Webhook not found';
      delivery.completedAt = new Date();
      return;
    }

    delivery.attempts++;
    this.deliveries.set(delivery.id, delivery);

    try {
      const response = await axios.post(webhook.url, delivery.event, {
        headers: {
          'Content-Type': 'application/json',
          ...webhook.headers,
        },
        timeout: 10000,
      });

      delivery.status = 'success';
      delivery.response = response.data;
      delivery.completedAt = new Date();
      this.deliveries.set(delivery.id, delivery);
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      delivery.completedAt = new Date();
      this.deliveries.set(delivery.id, delivery);

      // Retry if within limits
      if (delivery.attempts < webhook.retryConfig.maxAttempts) {
        const delay = webhook.retryConfig.delayMs * Math.pow(2, delivery.attempts - 1);
        setTimeout(() => {
          this.executeDelivery(delivery);
        }, delay);
      }
    }
  }

  /**
   * Get all webhooks
   */
  getWebhooks(): Webhook[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get a specific webhook
   */
  getWebhook(id: string): Webhook | undefined {
    return this.webhooks.get(id);
  }

  /**
   * Get delivery history
   */
  getDeliveries(webhookId?: string): WebhookDelivery[] {
    const allDeliveries = Array.from(this.deliveries.values());
    if (webhookId) {
      return allDeliveries.filter(d => d.webhookId === webhookId);
    }
    return allDeliveries;
  }

  /**
   * Enable a webhook
   */
  enableWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;
    webhook.enabled = true;
    webhook.updatedAt = new Date();
    return true;
  }

  /**
   * Disable a webhook
   */
  disableWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;
    webhook.enabled = false;
    webhook.updatedAt = new Date();
    return true;
  }

  /**
   * Update webhook configuration
   */
  updateWebhook(id: string, config: Partial<Webhook>): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;
    Object.assign(webhook, config);
    webhook.updatedAt = new Date();
    return true;
  }
  }
