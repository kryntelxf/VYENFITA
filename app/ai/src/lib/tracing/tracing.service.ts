/**
 * VYENFITA Tracing Service
 * 
 * Wrapper over OpenTelemetry API. Provides:
 * - `withSpan(name, fn)` — auto-managed span for a block of code
 * - `startSpan(name)` — manual span for complex flows
 * - `setSpanAttribute` / `recordException` — helpers
 * 
 * Zero-overhead when tracing is disabled: uses the NoopTracer from
 * OpenTelemetry API, which is a no-op implementation.
 * 
 * @version 1.0.0
 */

import {
  trace,
  Tracer,
  Span,
  SpanStatusCode,
  SpanOptions,
  Attributes,
  AttributeValue,
} from '@opentelemetry/api';

const TRACER_NAME = 'vyenfita';
const TRACER_VERSION = process.env.SERVICE_VERSION || '1.0.0';

let tracer: Tracer | undefined;

/**
 * Get the OTel tracer. Falls back to the API's noop tracer if the SDK
 * hasn't been initialized (e.g. when OTEL_ENABLED=false).
 */
export function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer(TRACER_NAME, TRACER_VERSION);
  }
  return tracer;
}

/**
 * Run `fn` inside a new span.
 * 
 * Errors are recorded on the span and re-thrown. The span is always
 * ended (success or failure) using `finally`.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  options?: {
    attributes?: Attributes;
    options?: SpanOptions;
  }
): Promise<T> {
  const t = getTracer();
  const spanOptions: SpanOptions = {
    ...options?.options,
    attributes: {
      ...(options?.attributes || {}),
    },
  };

  return t.startActiveSpan(name, spanOptions, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Start a span manually (caller must call `span.end()`).
 * Recommended only when the span lifecycle can't be wrapped in a function.
 */
export function startSpan(name: string, attributes?: Attributes): Span {
  return getTracer().startSpan(name, { attributes });
}

/**
 * Record an attribute on the currently-active span.
 * No-op if there is no active span.
 */
export function setSpanAttribute(
  key: string,
  value: AttributeValue
): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

/**
 * Record multiple attributes at once.
 */
export function setSpanAttributes(attributes: Attributes): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Record an exception on the currently-active span.
 */
export function recordException(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

/**
 * Get the current trace ID (hex string), or undefined if no active span.
 * Useful for correlating logs with traces.
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;
  const spanContext = span.spanContext();
  return spanContext.traceId || undefined;
}

/**
 * Get the current span ID, or undefined if no active span.
 */
export function getCurrentSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;
  const spanContext = span.spanContext();
  return spanContext.spanId || undefined;
}

/**
 * Whether tracing is enabled (SDK initialized).
 */
export function isTracingEnabled(): boolean {
  return process.env.OTEL_ENABLED === 'true';
        }
