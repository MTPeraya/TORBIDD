/**
 * @jest-environment node
 */
// =============================================================================
// services/resilience/__tests__/retry-policy.test.ts
// Unit tests for Generic Exponential Backoff and Retry Policy
// =============================================================================

import { withRetry, isRetryableError } from '../retry-policy';

describe('Retry Policy (Exponential Backoff & Throttling)', () => {
  describe('isRetryableError', () => {
    it('should identify transient network and HTTP 429/5xx errors as retryable', () => {
      expect(isRetryableError(new Error('GovSpending API rate limit exceeded (HTTP 429)'))).toBe(true);
      expect(isRetryableError(new Error('GovSpending request failed with status 500'))).toBe(true);
      expect(isRetryableError(new Error('GovSpending request failed with status 503'))).toBe(true);
      expect(isRetryableError(new Error('connect ETIMEDOUT'))).toBe(true);
      expect(isRetryableError(new Error('Network error: connection reset'))).toBe(true);
    });

    it('should identify 401, 403, and invalid config as non-retryable (fail-fast)', () => {
      expect(isRetryableError(new Error('GovSpending authentication failed: Invalid or expired API key'))).toBe(false);
      expect(isRetryableError(new Error('GOVSPENDING_API_KEY is not configured'))).toBe(false);
      expect(isRetryableError(new Error('Request failed with status 401'))).toBe(false);
      expect(isRetryableError(new Error('Request failed with status 403'))).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('1. should succeed immediately on first attempt without retrying', async () => {
      const op = jest.fn().mockResolvedValue('success-data');
      const result = await withRetry(op, { maxAttempts: 3 });

      expect(result).toBe('success-data');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('2. should retry transient failure and succeed on second attempt', async () => {
      const op = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary network timeout'))
        .mockResolvedValueOnce('recovered-data');

      const onRetryMock = jest.fn();

      const result = await withRetry(op, {
        maxAttempts: 3,
        initialDelayMs: 1, // fast delay for unit test
        onRetry: onRetryMock,
      });

      expect(result).toBe('recovered-data');
      expect(op).toHaveBeenCalledTimes(2);
      expect(onRetryMock).toHaveBeenCalledTimes(1);
      expect(onRetryMock).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('3. should fail-fast on non-retryable error without retrying', async () => {
      const op = jest.fn().mockRejectedValue(new Error('401 Unauthorized'));

      await expect(
        withRetry(op, { maxAttempts: 3, initialDelayMs: 1 }),
      ).rejects.toThrow('401 Unauthorized');

      expect(op).toHaveBeenCalledTimes(1); // Did NOT retry
    });

    it('4. should exhaust maxAttempts and throw last error', async () => {
      const op = jest.fn().mockRejectedValue(new Error('Persistent 503 Service Unavailable'));

      await expect(
        withRetry(op, { maxAttempts: 3, initialDelayMs: 1 }),
      ).rejects.toThrow('Persistent 503 Service Unavailable');

      expect(op).toHaveBeenCalledTimes(3);
    });
  });
});
