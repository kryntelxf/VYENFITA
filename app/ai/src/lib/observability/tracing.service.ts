/**
 * VYENFITA Tracing Service
 * 
 * Lightweight distributed tracing:
 * - Request ID propagation
 * - Span tracking (nested operations)
 * - Context storage per async context
 * 
 * @version 1.0.0
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface Span {
  id: string;
  parentId?: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  tags: Record<string, any>;
  error?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  tenantId?: string;
  userId?: string;
  spans: Span[];
}

const storage = new AsyncLocalStorage<TraceContext>();

export class TracingService {
  /**
   * Run a function within a new trace
   */
  static runWithTrace<T>(
    fn: () => Promise<T> | T,
    context: Partial<Omit<TraceContext, 'spans'>> = {}
  ): Promise<T> | T {
    const traceContext: TraceContext = {
      traceId: context.traceId || randomUUID(),
      spanId: context.spanId || randomUUID(),
      tenantId: context.tenantId,
      userId: context.userId,
      spans: [],
    };

    return storage.run(traceContext, fn);
  }

  /**
   * Get current trace context
   */
  static getContext(): TraceContext | undefined {
    return storage.getStore();
  }

  /**
   * Get current trace ID
   */
  static getTraceId(): string | undefined {
    return storage.getStore()?.traceId;
  }

  /**
   * Get all spans for current trace
   */
  static getSpans(): Span[] {
    return storage.getStore()?.spans || [];
  }

  /**
   * Add a tag to current context
   */
  static setTag(key: string, value: any): void {
    const ctx = storage.getStore();
    if (!ctx) return;
    ctx[key as 'tenantId' | 'userId'] = value;
  }

  /**
   * Create and track a span
   */
  static async span<T>(
    name: string,
    fn: () => Promise<T>,
    tags: Record<string, any> = {}
  ): Promise<T> {
    const ctx = storage.getStore();
    if (!ctx) {
      // No active trace — run without tracing
      return fn();
    }

    const span: Span = {
      id: randomUUID(),
      parentId: ctx.spanId,
      name,
      startedAt: Date.now(),
      tags,
    };

    ctx.spans.push(span);

    const previousSpanId = ctx.spanId;
    ctx.spanId = span.id;

    try {
      const result = await fn();
      span.endedAt = Date.now();
      span.durationMs = span.endedAt - span.startedAt;
      return result;
    } catch (error) {
      span.endedAt = Date.now();
      span.durationMs = span.endedAt - span.startedAt;
      span.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      ctx.spanId = previousSpanId;
    }
  }

  /**
   * Synchronous span
   */
  static spanSync<T>(name: string, fn: () => T, tags: Record<string, any> = {}): T {
    const ctx = storage.getStore();
    if (!ctx) return fn();

    const span: Span = {
      id: randomUUID(),
      parentId: ctx.spanId,
      name,
      startedAt: Date.now(),
      tags,
    };

    ctx.spans.push(span);

    try {
      const result = fn();
      span.endedAt = Date.now();
      span.durationMs = span.endedAt - span.startedAt;
      return result;
    } catch (error) {
      span.endedAt = Date.now();
      span.durationMs = span.endedAt - span.startedAt;
      span.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }
        }
