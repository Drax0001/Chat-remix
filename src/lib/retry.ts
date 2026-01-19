/**
 * Retry and Circuit Breaker utilities
 * Provides resilient execution of external service calls
 * Requirements: 14.1, 14.4, 14.5
 */

import { ValidationError, NotFoundError } from "./errors";

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, reject calls
  HALF_OPEN = "half_open", // Testing if service recovered
}

/**
 * Configuration for circuit breaker behavior
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Milliseconds before trying half-open
  monitoringPeriod: number; // Milliseconds to track failures
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringPeriod: 60000, // 1 minute
};

/**
 * Circuit breaker statistics
 */
interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
}

/**
 * Circuit Breaker class for external service resilience
 * Implements circuit breaker pattern to prevent cascading failures
 * Requirements: 14.4, 14.5
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private stats: CircuitStats = {
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    lastSuccessTime: Date.now(),
  };
  private nextAttemptTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error("Circuit breaker is OPEN - service unavailable");
      }
      // Try half-open
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.stats.successes++;
    this.stats.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Service recovered, close circuit
      this.state = CircuitState.CLOSED;
      this.stats.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.stats.failures++;
    this.stats.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Still failing, go back to open
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    } else if (
      this.state === CircuitState.CLOSED &&
      this.stats.failures >= this.config.failureThreshold
    ) {
      // Too many failures, open circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitStats {
    return { ...this.stats };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.stats = {
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastSuccessTime: Date.now(),
    };
    this.nextAttemptTime = 0;
  }
}

/**
 * Check if an error should trigger a retry
 * Don't retry validation errors or not found errors
 * Requirements: 14.1
 */
function shouldRetry(error: unknown): boolean {
  // Don't retry validation errors or not found errors
  if (error instanceof ValidationError || error instanceof NotFoundError) {
    return false;
  }

  // Retry other errors (network issues, service unavailable, etc.)
  return true;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Execute a function with retry logic using exponential backoff
 * Requirements: 14.1
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: unknown;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry certain error types
      if (!shouldRetry(error)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === retryConfig.maxAttempts) {
        throw error;
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, retryConfig);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError;
}

/**
 * Execute a function with both retry logic and circuit breaker protection
 */
export async function withRetryAndCircuitBreaker<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  return circuitBreaker.execute(() =>
    withRetry(fn, retryConfig)
  );
}