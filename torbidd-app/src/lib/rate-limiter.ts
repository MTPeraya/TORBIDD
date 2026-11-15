// =============================================================================
// lib/rate-limiter.ts – In-Memory Sliding-Window Rate Limiter
// =============================================================================
// A lightweight, zero-dependency rate limiter for Next.js API routes running
// in the Node.js runtime (not Edge). State lives in module-level memory, which
// means it resets on cold starts and is NOT shared across multiple server
// processes or pods.  For production multi-instance deployments, replace the
// in-memory store with a Redis-backed implementation (see docs/security).
//
// Design:
//  - Sliding-window counter per (key, windowMs) bucket.
//  - Automatic pruning of expired entries to prevent memory growth.
//  - TTL-aware: entries are auto-evicted after `windowMs` elapses.
//  - Returns 429 Too Many Requests with Retry-After header when limit exceeded.
// =============================================================================

export interface RateLimitConfig {
  /** Sliding window duration in milliseconds (e.g. 60_000 for 1 minute). */
  windowMs: number;
  /** Maximum number of requests allowed within windowMs. */
  max: number;
  /** Optional human-readable label used in log output. */
  label?: string;
}

interface WindowEntry {
  count: number;
  resetAt: number; // epoch ms when this window expires
}

// Module-level store: { limiterId → { key → WindowEntry } }
const store = new Map<string, Map<string, WindowEntry>>();

/** Returns the rate-limit store for a given limiter ID (lazy init). */
function getStore(id: string): Map<string, WindowEntry> {
  if (!store.has(id)) store.set(id, new Map());
  return store.get(id)!;
}

/** Removes expired entries from a limiter's store (housekeeping). */
function prune(id: string): void {
  const bucket = store.get(id);
  if (!bucket) return;
  const now = Date.now();
  for (const [k, entry] of bucket.entries()) {
    if (entry.resetAt <= now) bucket.delete(k);
  }
}

export interface RateLimitResult {
  /** True when the request is allowed; false when the limit is exceeded. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  /** Seconds until the window resets (useful for Retry-After header). */
  retryAfter: number;
}

/**
 * Checks whether `key` (e.g. client IP) is within the rate limit.
 *
 * @param id      Unique identifier for this limiter instance.
 * @param key     Client-specific identifier (IP address, session ID, …).
 * @param config  Window size and maximum request count.
 */
export function checkRateLimit(
  id: string,
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const { windowMs, max } = config;
  const bucket = getStore(id);
  const now = Date.now();

  // Prune stale entries periodically (1-in-50 requests)
  if (Math.random() < 0.02) prune(id);

  let entry = bucket.get(key);

  if (!entry || entry.resetAt <= now) {
    // Start a fresh window
    entry = { count: 1, resetAt: now + windowMs };
    bucket.set(key, entry);
  } else {
    entry.count += 1;
  }

  const remaining = Math.max(0, max - entry.count);
  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

  return {
    allowed: entry.count <= max,
    remaining,
    resetAt: entry.resetAt,
    retryAfter,
  };
}

/**
 * Convenience: resets the counter for a given key (e.g. after successful auth).
 */
export function resetRateLimit(id: string, key: string): void {
  store.get(id)?.delete(key);
}

// ---------------------------------------------------------------------------
// Pre-configured limiters for TORBIDD authentication endpoints
// ---------------------------------------------------------------------------

/**
 * AUTH_INITIATE_LIMITER – throttles the Google OAuth initiation endpoint
 * (GET /api/auth/google).  Generous enough for normal browser behaviour but
 * stops automated clients from hammering the redirect.
 *   · 20 requests per 10 minutes per IP
 */
export const AUTH_INITIATE_LIMITER: RateLimitConfig = {
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  label: 'auth-initiate',
};

/**
 * AUTH_CALLBACK_LIMITER – throttles the OAuth callback endpoint
 * (GET /api/auth/callback/google).  An attacker trying to brute-force state
 * tokens would hit this after a few attempts.
 *   · 10 requests per 5 minutes per IP
 */
export const AUTH_CALLBACK_LIMITER: RateLimitConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  label: 'auth-callback',
};

/**
 * AUTH_ME_WRITE_LIMITER – throttles profile update (PUT /api/auth/me).
 *   · 10 writes per minute per IP
 */
export const AUTH_ME_WRITE_LIMITER: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  label: 'auth-me-write',
};

/**
 * AUTH_LOGOUT_LIMITER – throttles logout (POST /api/auth/logout).
 * Prevents a scenario where an attacker floods logout to interfere with
 * sessions of other users sharing an IP (e.g. NAT / corporate proxy).
 *   · 30 requests per minute per IP
 */
export const AUTH_LOGOUT_LIMITER: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  label: 'auth-logout',
};

// ---------------------------------------------------------------------------
// Helper: extract best-effort client IP from a Next.js request
// ---------------------------------------------------------------------------

/**
 * Returns the client IP address suitable for use as a rate-limit key.
 * Respects common reverse-proxy headers; falls back to 'unknown'.
 */
export function getClientIp(req: { headers: { get: (name: string) => string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; take the first (leftmost) IP
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
}

/**
 * Builds standard rate-limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult, max: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfter) }),
  };
}
