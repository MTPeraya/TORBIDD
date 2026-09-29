// =============================================================================
// services/resilience/retry-policy.ts
// Reusable Exponential Backoff & Retry Policy for Transient Network Timeouts & HTTP 429/5xx
// =============================================================================

import { setTimeout as delay } from 'node:timers/promises';

export interface RetryPolicyOptions {
  maxAttempts?: number; // Maximum attempts before failing (default: 3)
  initialDelayMs?: number; // Base initial delay in ms (default: 500)
  maxDelayMs?: number; // Upper limit for delay in ms (default: 10000)
  backoffMultiplier?: number; // Exponential multiplier (default: 2)
  rateLimitDelayMs?: number; // Delay applied for HTTP 429 rate limits (default: 2000)
  retryableErrorCodes?: Array<number | string>;
  signal?: AbortSignal;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryPolicyOptions, 'signal' | 'onRetry' | 'retryableErrorCodes'>> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  rateLimitDelayMs: 2000,
};

/**
 * Determine if an error is transient and eligible for automatic retry.
 * Matches: HTTP 429, HTTP 5xx (500, 502, 503, 504), network timeouts, and connection drops.
 * Non-retryable: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found.
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);

  // Non-retryable client errors
  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404') ||
    message.includes('authentication failed') ||
    message.includes('not configured') ||
    message.includes('Invalid project ID')
  ) {
    return false;
  }

  // Explicit retryable errors
  if (
    message.includes('429') || // Rate limit
    message.includes('500') || // Internal Server Error
    message.includes('502') || // Bad Gateway
    message.includes('503') || // Service Unavailable
    message.includes('504') || // Gateway Timeout
    message.includes('timeout') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNRESET') ||
    message.includes('network error') ||
    message.includes('fetch failed')
  ) {
    return true;
  }

  // Default to retrying other unexpected errors if transient
  return true;
}

/**
 * Execute an asynchronous operation with exponential backoff and retry strategy.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryPolicyOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts;
  const initialDelay = options.initialDelayMs ?? DEFAULT_OPTIONS.initialDelayMs;
  const maxDelay = options.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs;
  const multiplier = options.backoffMultiplier ?? DEFAULT_OPTIONS.backoffMultiplier;
  const rateLimitDelay = options.rateLimitDelayMs ?? DEFAULT_OPTIONS.rateLimitDelayMs;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (options.signal?.aborted) {
        throw new Error('Operation aborted');
      }
      return await operation(attempt);
    } catch (err: unknown) {
      lastError = err;

      if (options.signal?.aborted) {
        throw err;
      }

      // Check if error is retryable
      if (!isRetryableError(err)) {
        throw err; // Fail fast for non-transient errors (e.g. 401, 403)
      }

      // If we exhausted all retry attempts, break out to throw
      if (attempt >= maxAttempts) {
        break;
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      const is429 = errMsg.includes('429');

      // Calculate exponential backoff
      let nextDelayMs: number;
      if (is429) {
        // Linear-exponential hybrid for rate limits
        nextDelayMs = Math.min(rateLimitDelay * attempt, maxDelay);
      } else {
        nextDelayMs = Math.min(initialDelay * Math.pow(multiplier, attempt - 1), maxDelay);
      }

      if (options.onRetry && err instanceof Error) {
        options.onRetry(attempt, err, nextDelayMs);
      } else {
        console.warn(
          `[RetryPolicy] Attempt ${attempt}/${maxAttempts} failed: ${errMsg}. Retrying in ${nextDelayMs}ms...`,
        );
      }

      await delay(nextDelayMs, undefined, { signal: options.signal });
    }
  }

  throw lastError;
}
