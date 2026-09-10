/**
 * VYENFITA Circuit Breaker
 * 
 * Prevents cascading failures when a provider is down
 * 
 * States:
 * - CLOSED: normal, requests pass through
 * - OPEN: circuit tripped, requests fail immediately
 * - HALF_OPEN: testing if provider recovered
 * 
 * @version 1.0.0
 */

export interface CircuitBreakerConfig {
  failureThreshold: number; // How many failures before opening
  successThreshold: number; // How many successes in HALF_OPEN to close
  timeoutMs: number;        // How long to stay OPEN before testing
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptAt: number = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  /**
   * Check if circuit allows a request
   */
  canAttempt(): boolean {
    if (this.state === 'CLOSED') return true;

    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttemptAt) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN
    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    if (this.state === 'HALF_OPEN') {
      this.trip();
      return;
    }

    this.failureCount++;
    if (this.failureCount >= this.config.failureThreshold) {
      this.trip();
    }
  }

  /**
   * Get current state (for metrics)
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset (for tests / admin)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptAt = 0;
  }

  private trip(): void {
    this.state = 'OPEN';
    this.nextAttemptAt = Date.now() + this.config.timeoutMs;
    this.failureCount = 0;
    this.successCount = 0;
  }
  }
