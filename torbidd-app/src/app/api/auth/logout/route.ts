// =============================================================================
// app/api/auth/logout/route.ts - Clear Authentication Session
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  AUTH_LOGOUT_LIMITER,
} from '@/lib/rate-limiter';

const LIMITER_ID = 'auth-logout';

export async function POST(req: NextRequest) {
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

  res.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return res;
}
