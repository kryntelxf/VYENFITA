/**
 * VYENFITA AI Service Tests
 * 
 * Tests for circuit breaker, retry, and error handling
 * 
 * @version 1.0.0
 */

import '../setup';
import { CircuitBreaker } from '../../lib/ai/circuit-breaker';
import {
  AIProviderError,
  AIRateLimitError,
  AITimeoutError,
} from '../../lib/ai/provider.interface';

describe('Circuit Breaker', () => {
  it('should start in CLOSED state', () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
    });

    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canAttempt()).toBe(true);
  });

  it('should open after threshold failures', () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');

    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
    expect(cb.canAttempt()).toBe(false);
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      successThreshold: 2,
      timeoutMs: 100,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');

    await new Promise((r) => setTimeout(r, 150));

    expect(cb.canAttempt()).toBe(true);
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('should close after success threshold in HALF_OPEN', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      successThreshold: 2,
      timeoutMs: 50,
    });

    cb.recordFailure();
    cb.recordFailure();
    await new Promise((r) => setTimeout(r, 100));

    cb.canAttempt(); // trigger HALF_OPEN
    cb.recordSuccess();
    cb.recordSuccess();

    expect(cb.getState()).toBe('CLOSED');
  });

  it('should reset on manual reset', () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      successThreshold: 2,
      timeoutMs: 1000,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canAttempt()).toBe(true);
  });
});

describe('AI Provider Errors', () => {
  it('should classify rate limit errors as retryable', () => {
    const error = new AIRateLimitError('openai');
    expect(error.retryable).toBe(true);
    expect(error.code).toBe('RATE_LIMIT');
  });

  it('should classify timeout errors as retryable', () => {
    const error = new AITimeoutError('openai', 5000);
    expect(error.retryable).toBe(true);
    expect(error.code).toBe('TIMEOUT');
  });

  it('should classify auth errors as non-retryable', () => {
    const error = new AIProviderError('Invalid key', 'openai', 'AUTH_ERROR', false);
    expect(error.retryable).toBe(false);
  });
});
