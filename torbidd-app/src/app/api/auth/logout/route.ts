// =============================================================================
// app/api/auth/logout/route.ts - Clear Authentication Session
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import {
  LEGACY_AUTH_COOKIE_NAME,
  buildSecureCookieOptions,
} from '@/lib/cookie-security';
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  AUTH_LOGOUT_LIMITER,
} from '@/lib/rate-limiter';

const LIMITER_ID = 'auth-logout';

export async function POST(req?: NextRequest) {
  // ── SEC-01: Rate limiting ─────────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(LIMITER_ID, clientIp, AUTH_LOGOUT_LIMITER);
  const rlHeaders = rateLimitHeaders(rl, AUTH_LOGOUT_LIMITER.max);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.', retryAfter: rl.retryAfter },
      { status: 429, headers: rlHeaders },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const res = NextResponse.json({ success: true, message: 'Logged out successfully' }, { headers: rlHeaders });

  // Clear both __Host- prefixed and legacy auth session cookies (ASVS 3.3.1 & 3.3.3)
  const clearOptions = buildSecureCookieOptions({ maxAge: 0 });
  res.cookies.set(AUTH_COOKIE_NAME, '', clearOptions);
  res.cookies.set(LEGACY_AUTH_COOKIE_NAME, '', clearOptions);

  return res;
}
