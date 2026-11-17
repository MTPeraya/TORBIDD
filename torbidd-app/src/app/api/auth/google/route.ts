// =============================================================================
// app/api/auth/google/route.ts - Initiate Google OAuth Flow (SEC-01, SEC-04)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  OAUTH_STATE_COOKIE,
  signOAuthState,
  generateOidcNonce,
  generatePkcePair,
  REQUIRED_OIDC_SCOPES,
} from '@/lib/auth';
import { buildSecureCookieOptions } from '@/lib/cookie-security';
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  AUTH_INITIATE_LIMITER,
} from '@/lib/rate-limiter';

const LIMITER_ID = 'auth-google-initiate';

export async function GET(req: NextRequest) {
  // ── SEC-01: Rate limiting ─────────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(LIMITER_ID, clientIp, AUTH_INITIATE_LIMITER);
  const rlHeaders = rateLimitHeaders(rl, AUTH_INITIATE_LIMITER.max);

  if (!rl.allowed) {
    console.warn(
      `[Auth Rate Limit] Initiate blocked for IP ${clientIp} – retryAfter=${rl.retryAfter}s`,
    );
    return NextResponse.json(
      {
        error: 'Too many authentication requests. Please wait before trying again.',
        retryAfter: rl.retryAfter,
      },
      { status: 429, headers: rlHeaders },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { searchParams } = new URL(req.url);
  const returnUrl = searchParams.get('returnUrl') || '/';
  const isMock = searchParams.get('mock') === 'true';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const redirectUri = `${appUrl}/api/auth/callback/google`;

  // ── SEC-04: Generate cryptographic OIDC Nonce & PKCE Pair ──────────────────
  // Nonce has 256 bits of entropy (ASVS V6.7.2, V10.5.1)
  const nonce = generateOidcNonce();
  // PKCE verifier + challenge using SHA-256 (RFC 7636, ASVS V10.1.2)
  const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePkcePair();

  // If credentials are not set and developer mock mode is requested or in local dev fallback
  if (!clientId || !clientSecret || isMock) {
    if (process.env.NODE_ENV !== 'production') {
      const signedMockState = signOAuthState(nonce, returnUrl, codeVerifier);
      const res = NextResponse.redirect(
        `${appUrl}/api/auth/callback/google?code=mock_dev_code&state=${signedMockState}&mock=true`,
      );
      res.cookies.set(
        OAUTH_STATE_COOKIE,
        JSON.stringify({ state: signedMockState, nonce, returnUrl, codeVerifier }),
        buildSecureCookieOptions({ maxAge: 600 }),
      );
      return res;
    } else {
      return NextResponse.json(
        { error: 'Google OAuth credentials not configured on server' },
        { status: 500 },
      );
    }
  }

  // ── SEC-04: Bind transaction state with HMAC signature ────────────────────
  const signedState = signOAuthState(nonce, returnUrl, codeVerifier);
  const stateData = JSON.stringify({ state: signedState, nonce, returnUrl, codeVerifier });

  // ── SEC-04: Construct Google OIDC Authorization URL ───────────────────────
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  // Strictly necessary scopes only (ASVS V10.2.3)
  googleAuthUrl.searchParams.set('scope', REQUIRED_OIDC_SCOPES);
  // Transaction-bound state (ASVS V10.2.1)
  googleAuthUrl.searchParams.set('state', signedState);
  // OIDC nonce claim binding (ASVS V10.5.1)
  googleAuthUrl.searchParams.set('nonce', nonce);
  // PKCE code challenge and method (ASVS V10.1.2)
  googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
  googleAuthUrl.searchParams.set('code_challenge_method', codeChallengeMethod);

  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(googleAuthUrl.toString());
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    stateData,
    buildSecureCookieOptions({ maxAge: 600 }),
  );

  // Attach rate-limit informational headers
  Object.entries(rlHeaders).forEach(([k, v]) => response.headers.set(k, v));

  return response;
}
