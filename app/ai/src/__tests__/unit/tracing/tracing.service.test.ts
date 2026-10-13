/**
 * VYENFITA Tracing Service Unit Tests
 * 
 * @version 1.0.0
 */

import {
  withSpan,
  getCurrentTraceId,
  getCurrentSpanId,
  isTracingEnabled,
  setSpanAttribute,
  setSpanAttributes,
  recordException,
} from '../../../lib/tracing/tracing.service';

describe('TracingService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OTEL_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isTracingEnabled()', () => {
    it('should return false when OTEL_ENABLED is not set', () => {
      expect(isTracingEnabled()).toBe(false);
    });

    it('should return true when OTEL_ENABLED=true', () => {
      process.env.OTEL_ENABLED = 'true';
      expect(isTracingEnabled()).toBe(true);
    });

    it('should return false when OTEL_ENABLED=false', () => {
      process.env.OTEL_ENABLED = 'false';
      expect(isTracingEnabled()).toBe(false);
    });
  });

  describe('withSpan()', () => {
    it('should run callback and return its result', async () => {
      const result = await withSpan('test.span', () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it('should run async callback', async () => {
      const result = await withSpan('test.span', async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { success: true };
      });

      expect(result).toEqual({ success: true });
    });

    it('should pass span to callback', async () => {
      let spanReceived = false;
      await withSpan('test.span', (span) => {
        spanReceived = span !== undefined && span !== null;
      });
      expect(spanReceived).toBe(true);
    });

    it('should re-throw errors from callback', async () => {
      await expect(
        withSpan('test.span', () => {
          throw new Error('Something went wrong');
        })
      ).rejects.toThrow('Something went wrong');
    });

    it('should re-throw errors from async callback', async () => {
      await expect(
        withSpan('test.span', async () => {
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');
    });

    it('should accept attributes', async () => {
      const result = await withSpan(
        'test.span',
        () => 'ok',
        { attributes: { 'custom.key': 'custom-value' } }
      );
      expect(result).toBe('ok');
    });
  });

  describe('getCurrentTraceId() / getCurrentSpanId()', () => {
    it('should return undefined or all-zero when no active span', () => {
      const traceId = getCurrentTraceId();
      const spanId = getCurrentSpanId();
      if (traceId !== undefined) {
        expect(traceId).toMatch(/^0+$/);
      } else {
        expect(traceId).toBeUndefined();
      }
      if (spanId !== undefined) {
        expect(spanId).toMatch(/^0+$/);
      } else {
        expect(spanId).toBeUndefined();
      }
    });

    it('should return a trace ID inside withSpan', async () => {
      await withSpan('test.span', () => {
        const traceId = getCurrentTraceId();
        expect(traceId).toBeDefined();
      });
    });
  });

  describe('attribute helpers', () => {
    it('should not throw when called outside a span', () => {
      expect(() => setSpanAttribute('key', 'value')).not.toThrow();
      expect(() => setSpanAttributes({ a: 1, b: 'two' })).not.toThrow();
      expect(() => recordException(new Error('test'))).not.toThrow();
    });

    it('should work inside a span', async () => {
      await withSpan('test.span', () => {
        expect(() => setSpanAttribute('key', 'value')).not.toThrow();
        expect(() => setSpanAttributes({ a: 1, b: 'two' })).not.toThrow();
        expect(() => recordException(new Error('test'))).not.toThrow();
      });
    });
  });
});
