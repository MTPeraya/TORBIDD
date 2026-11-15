// =============================================================================
// app/api/auth/callback/google/route.ts - Google OAuth Callback Handler
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, OAUTH_STATE_COOKIE, signSession, verifyOAuthState, AuthSessionUser } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
  rateLimitHeaders,
  AUTH_CALLBACK_LIMITER,
} from '@/lib/rate-limiter';
import { resolveInitialRole } from '@/lib/authorization';

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

const LIMITER_ID = 'auth-callback-google';

export async function GET(req: NextRequest) {
  // ── SEC-01: Rate limiting on the callback endpoint ────────────────────────
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(LIMITER_ID, clientIp, AUTH_CALLBACK_LIMITER);
  const rlHeaders = rateLimitHeaders(rl, AUTH_CALLBACK_LIMITER.max);

  if (!rl.allowed) {
    console.warn(
      `[Auth Rate Limit] Callback blocked for IP ${clientIp} – retryAfter=${rl.retryAfter}s`,
    );
    // Redirect to login with a throttle error rather than exposing a JSON 429
    // so the user sees a friendly error message in the UI.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const loginUrl = new URL(`${appUrl}/login`);
    loginUrl.searchParams.set('error', 'rate_limited');
    loginUrl.searchParams.set('retryAfter', String(rl.retryAfter));
    const redirectRes = NextResponse.redirect(loginUrl.toString());
    Object.entries(rlHeaders).forEach(([k, v]) => redirectRes.headers.set(k, v));
    return redirectRes;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const isMock = searchParams.get('mock') === 'true';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const isHttps = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';

  // Validate state to prevent CSRF attacks
  // Priority 1: State cookie check
  // Priority 2: Cryptographically verified HMAC state token (fallback if browser stripped cookie over HTTP/localhost)
  const stateCookieRaw = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  let returnUrl = '/';
  let stateIsValid = false;

  if (stateCookieRaw) {
    try {
      const parsedState = JSON.parse(stateCookieRaw);
      if (parsedState.state === state) {
        stateIsValid = true;
        if (parsedState.returnUrl && parsedState.returnUrl.startsWith('/')) {
          returnUrl = parsedState.returnUrl;
        }
      }
    } catch {}
  }

  if (!stateIsValid && state) {
    const verifiedState = verifyOAuthState(state);
    if (verifiedState) {
      stateIsValid = true;
      returnUrl = verifiedState.returnUrl;
    }
  }

  if (!stateIsValid) {
    console.warn('[Google Auth Callback] State validation failed. Cookie present:', Boolean(stateCookieRaw));
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
  }

  const googleError = searchParams.get('error');
  if (googleError) {
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(googleError)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_code`);
  }

  let sessionUser: AuthSessionUser;

  if (isMock || code === 'mock_dev_code') {
    // ── SEC-02: Mock developer session ───────────────────────────────────────
    // The mock account uses a real non-reserved email and receives BMA Officer
    // role by default. It can only be promoted to admin if its email appears in
    // ADMIN_EMAILS (same policy as real accounts – no special mock bypass).
    const mockEmail = 'officer.bma@bangkok.go.th';
    const mockRole = resolveInitialRole(mockEmail); // 'admin' only if in ADMIN_EMAILS
    // ────────────────────────────────────────────────────────────────────────

    // Local developer fallback mode
    sessionUser = {
      id: 'mock_user_bma_123',
      email: mockEmail,
      name: 'BMA Procurement Officer',
      picture: '',
      role: mockRole,
      org: 'สำนักยุทธศาสตร์และประเมินผล',
    };

    // Try saving to DB if MONGODB_URI exists
    if (process.env.MONGODB_URI) {
      try {
        await connectToDatabase();
        const dbUser = await User.findOneAndUpdate(
          { googleId: 'mock_google_id_123' },
          {
            $set: {
              email: sessionUser.email,
              name: sessionUser.name,
              picture: sessionUser.picture,
              role: sessionUser.role,
              org: sessionUser.org,
              lastLoginAt: new Date(),
            },
          },
          { new: true, upsert: true },
        );
        if (dbUser?._id) {
          sessionUser.id = dbUser._id.toString();
        }
      } catch (dbErr) {
        console.warn('[Google Auth Callback] MongoDB warning in mock mode:', dbErr);
      }
    }
  } else {
    // Real Google OAuth 2.0 exchange
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/callback/google`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/login?error=unconfigured_credentials`);
    }

    try {
      // 1. Exchange authorization code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error('[Google Auth Callback] Token exchange failed:', errorText);
        return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`);
      }

      const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

      // 2. Fetch user profile with access token
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userRes.ok) {
        console.error('[Google Auth Callback] Userinfo fetch failed');
        return NextResponse.redirect(`${appUrl}/login?error=userinfo_failed`);
      }

      const profile = (await userRes.json()) as GoogleUserInfo;

      // 3. Connect to MongoDB and upsert User
      let userId = profile.sub;
      // ── SEC-02: Use centralised role resolution (ASVS V6.3.2) ──────────────
      // Admin role is ONLY assigned when email is in ADMIN_EMAILS env var.
      // resolveInitialRole encapsulates this logic so it cannot be bypassed.
      const isConfiguredAdmin = resolveInitialRole(profile.email) === 'admin';

      let userRole = isConfiguredAdmin ? 'admin' : 'BMA Officer';
      let userOrg = 'กรุงเทพมหานคร';

      if (process.env.MONGODB_URI) {
        try {
          await connectToDatabase();
          const updateFields: Record<string, unknown> = {
            email: profile.email,
            name: profile.name || '',
            picture: profile.picture || '',
            lastLoginAt: new Date(),
          };
          if (isConfiguredAdmin) {
            // Only set admin role in DB when operator explicitly configured it
            updateFields.role = 'admin';
          }

          const dbUser = await User.findOneAndUpdate(
            { googleId: profile.sub },
            {
              $set: updateFields,
              $setOnInsert: {
                // SEC-02: Default role for new users is always BMA Officer.
                // Admin is set above via $set only for configured emails.
                role: isConfiguredAdmin ? 'admin' : 'BMA Officer',
                org: 'กรุงเทพมหานคร',
              },
            },
            { new: true, returnDocument: 'after', upsert: true },
          );

          if (dbUser?._id) {
            userId = dbUser._id.toString();
            userRole = isConfiguredAdmin ? 'admin' : (dbUser.role || 'BMA Officer');
            userOrg = dbUser.org || 'กรุงเทพมหานคร';
          }
        } catch (dbErr) {
          console.warn('[Google Auth Callback] MongoDB sync failed, falling back to Google profile session:', dbErr);
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      sessionUser = {
        id: userId,
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        picture: profile.picture || '',
        role: userRole,
        org: userOrg,
      };
    } catch (err) {
      console.error('[Google Auth Callback] Exception during OAuth flow:', err);
      return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
    }
  }

  // 4. Create signed session token and set secure HTTP-only cookie
  const sessionToken = signSession(sessionUser);

  // ── SEC-01: Successful auth – reset the callback rate-limit counter ──────
  resetRateLimit(LIMITER_ID, clientIp);
  // ─────────────────────────────────────────────────────────────────────────

  const response = NextResponse.redirect(`${appUrl}${returnUrl}`);

  // Set auth session cookie (7 days)
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  // Clear OAuth state cookie
  response.cookies.delete(OAUTH_STATE_COOKIE);

  return response;
}
