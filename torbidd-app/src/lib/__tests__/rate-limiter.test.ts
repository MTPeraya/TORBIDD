// =============================================================================
// lib/__tests__/rate-limiter.test.ts – Unit tests for in-memory rate limiter
// =============================================================================

import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
  rateLimitHeaders,
  RateLimitConfig,
} from '../rate-limiter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fresh limiter ID to avoid cross-test state leakage. */
let limiterCounter = 0;
function newId(): string {
  return `test-limiter-${++limiterCounter}`;
}

const SHORT_WINDOW: RateLimitConfig = { windowMs: 1000, max: 3, label: 'test' };

// ---------------------------------------------------------------------------
// Core sliding-window behaviour
// ---------------------------------------------------------------------------

describe('checkRateLimit – core behaviour', () => {
  it('allows requests under the limit', () => {
    const id = newId();
    for (let i = 0; i < 3; i++) {
      const result = checkRateLimit(id, '1.2.3.4', SHORT_WINDOW);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks the request that exceeds the limit', () => {
    const id = newId();
    for (let i = 0; i < 3; i++) checkRateLimit(id, '1.2.3.4', SHORT_WINDOW);
    const result = checkRateLimit(id, '1.2.3.4', SHORT_WINDOW);
    expect(result.allowed).toBe(false);
  });

  it('tracks remaining count correctly', () => {
    const id = newId();
    const r1 = checkRateLimit(id, '1.2.3.4', SHORT_WINDOW);
    expect(r1.remaining).toBe(2); // max=3, used=1

    const r2 = checkRateLimit(id, '1.2.3.4', SHORT_WINDOW);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(id, '1.2.3.4', SHORT_WINDOW);
    expect(r3.remaining).toBe(0);

    const r4 = checkRateLimit(id, '1.2.3.4', SHORT_WINDOW);
    expect(r4.remaining).toBe(0);
    expect(r4.allowed).toBe(false);
  });

  it('provides a positive retryAfter when blocked', () => {
    const id = newId();
    for (let i = 0; i < 4; i++) checkRateLimit(id, '5.5.5.5', SHORT_WINDOW);
    const result = checkRateLimit(id, '5.5.5.5', SHORT_WINDOW);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('isolates counters per key (different IPs)', () => {
    const id = newId();
    for (let i = 0; i < 4; i++) checkRateLimit(id, 'ip-A', SHORT_WINDOW);
    const resultB = checkRateLimit(id, 'ip-B', SHORT_WINDOW);
    expect(resultB.allowed).toBe(true); // ip-B has its own counter
  });

  it('isolates counters per limiter ID', () => {
    const idA = newId();
    const idB = newId();
    for (let i = 0; i < 4; i++) checkRateLimit(idA, '1.1.1.1', SHORT_WINDOW);
    const resultB = checkRateLimit(idB, '1.1.1.1', SHORT_WINDOW);
    expect(resultB.allowed).toBe(true);
  });

  it('resets the window after windowMs elapses', async () => {
    const id = newId();
    const tinyWindow: RateLimitConfig = { windowMs: 50, max: 2 };

    checkRateLimit(id, '9.9.9.9', tinyWindow);
    checkRateLimit(id, '9.9.9.9', tinyWindow);
    expect(checkRateLimit(id, '9.9.9.9', tinyWindow).allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));

    expect(checkRateLimit(id, '9.9.9.9', tinyWindow).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetRateLimit
// ---------------------------------------------------------------------------

describe('resetRateLimit', () => {
  it('clears the counter for a key so the next request is allowed', () => {
    const id = newId();
    for (let i = 0; i < 4; i++) checkRateLimit(id, 'victim', SHORT_WINDOW);
    expect(checkRateLimit(id, 'victim', SHORT_WINDOW).allowed).toBe(false);

    resetRateLimit(id, 'victim');
    expect(checkRateLimit(id, 'victim', SHORT_WINDOW).allowed).toBe(true);
  });

  it('is a no-op for an unknown limiter or key', () => {
    // Should not throw
    expect(() => resetRateLimit('nonexistent-id', 'some-key')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------

describe('getClientIp', () => {
  function makeReq(headers: Record<string, string>) {
    return { headers: { get: (name: string) => headers[name] ?? null } };
  }

  it('returns first IP from x-forwarded-for', () => {
    expect(getClientIp(makeReq({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(getClientIp(makeReq({ 'x-real-ip': '198.51.100.42' }))).toBe('198.51.100.42');
  });

  it('falls back to cf-connecting-ip (Cloudflare)', () => {
    expect(getClientIp(makeReq({ 'cf-connecting-ip': '104.21.0.1' }))).toBe('104.21.0.1');
  });

  it('returns "unknown" when no IP header is present', () => {
    expect(getClientIp(makeReq({}))).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// rateLimitHeaders
// ---------------------------------------------------------------------------

describe('rateLimitHeaders', () => {
  it('includes standard rate-limit headers when allowed', () => {
    const result = {
      allowed: true,
      remaining: 5,
      resetAt: Date.now() + 60_000,
      retryAfter: 60,
    };
    const headers = rateLimitHeaders(result, 10);
    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('5');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('includes Retry-After header when blocked', () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      retryAfter: 30,
    };
    const headers = rateLimitHeaders(result, 10);
    expect(headers['Retry-After']).toBe('30');
  });
});

// ---------------------------------------------------------------------------
// No permanent lockout guarantee
// ---------------------------------------------------------------------------

describe('No permanent lockout (ASVS V6.3.1)', () => {
  it('a blocked key becomes allowed again after the window expires', async () => {
    const id = newId();
    const shortWindow: RateLimitConfig = { windowMs: 80, max: 1 };

    // Block
    checkRateLimit(id, 'user', shortWindow);
    expect(checkRateLimit(id, 'user', shortWindow).allowed).toBe(false);

    // Wait for expiry
    await new Promise((r) => setTimeout(r, 100));

    // Should be unblocked
    expect(checkRateLimit(id, 'user', shortWindow).allowed).toBe(true);
  });
});
