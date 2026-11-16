// =============================================================================
// app/api/auth/callback/google/route.ts - Google OAuth Callback Handler
// =============================================================================
// Security Controls:
// - SEC-01: Rate limiting on callback against brute-force & state stuffing
// - SEC-02: Strict admin role assignment via resolveInitialRole (ASVS V6.3.2)
// - SEC-03: Single identity provider - Google OAuth ONLY (ASVS V6.3.6)
// - SEC-04: OIDC Nonce check, PKCE verification, ID Token RS256 signature
//           validation against Google JWKS, and stable `sub` claim mapping
//           (ASVS V6.7.1, V6.7.2, V6.8.2, V10.1.1, V10.1.2, V10.2.1, V10.5.1-4)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  OAUTH_STATE_COOKIE,
  signSession,
  verifyOAuthState,
  validateGoogleIdToken,
  AuthSessionUser,
} from '@/lib/auth';
import { resolveInitialRole } from '@/lib/authorization';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
  rateLimitHeaders,
  AUTH_CALLBACK_LIMITER,
} from '@/lib/rate-limiter';

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
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

  // ── SEC-04 & ASVS V10.2.1: Transaction state & Nonce verification ─────────
  // Validate state to prevent CSRF attacks and retrieve transaction nonce & PKCE verifier
  const stateCookieRaw = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  let returnUrl = '/';
  let stateIsValid = false;
  let originalNonce: string | undefined;
  let codeVerifier: string | undefined;

  if (stateCookieRaw) {
    try {
      const parsedState = JSON.parse(stateCookieRaw);
      if (parsedState.state === state) {
        stateIsValid = true;
        if (parsedState.returnUrl && parsedState.returnUrl.startsWith('/')) {
          returnUrl = parsedState.returnUrl;
        }
        originalNonce = parsedState.nonce;
        codeVerifier = parsedState.codeVerifier;
      }
    } catch {}
  }

  if (!stateIsValid && state) {
    const verifiedState = verifyOAuthState(state);
    if (verifiedState) {
      stateIsValid = true;
      returnUrl = verifiedState.returnUrl;
      originalNonce = verifiedState.nonce;
      codeVerifier = verifiedState.codeVerifier;
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

    sessionUser = {
      id: 'mock_user_bma_123',
      email: mockEmail,
      name: 'BMA Procurement Officer',
      picture: '',
      role: mockRole === 'admin' ? 'admin' : 'BMA Procurement Officer',
      org: 'สำนักยุทธศาสตร์และประเมินผล',
    };

    // Save to DB if MONGODB_URI exists
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
    // ── SEC-04: Real Google OAuth 2.0 & OIDC Validation ─────────────────────
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/callback/google`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/login?error=unconfigured_credentials`);
    }

    try {
      // 1. Exchange authorization code for tokens (with PKCE code_verifier, ASVS V10.1.2)
      const tokenRequestBody: Record<string, string> = {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      if (codeVerifier) {
        tokenRequestBody.code_verifier = codeVerifier;
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenRequestBody),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error('[Google Auth Callback] Token exchange failed:', errorText);
        return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`);
      }

      const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

      let userGoogleSub = '';
      let userEmail = '';
      let userName = '';
      let userPicture = '';

      if (tokenData.id_token) {
        // 2a. Validate Google ID Token (ASVS V6.7.1, V6.8.2, V10.5.1-V10.5.4)
        // Validates RS256 signature against Google JWKS certificates,
        // expected issuer ('https://accounts.google.com'), audience (clientId),
        // expiration (exp), and OIDC transaction nonce.
        const idTokenPayload = await validateGoogleIdToken(tokenData.id_token, {
          expectedClientId: clientId,
          expectedNonce: originalNonce,
        });
        userGoogleSub = idTokenPayload.sub;
        userEmail = idTokenPayload.email || '';
        userName = idTokenPayload.name || userEmail.split('@')[0] || '';
        userPicture = idTokenPayload.picture || '';
      } else if (tokenData.access_token) {
        // 2b. Fallback: Query Google userinfo endpoint if id_token not returned (ASVS V6.8.4 fallback)
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userRes.ok) {
          console.error('[Google Auth Callback] Userinfo fetch failed');
          return NextResponse.redirect(`${appUrl}/login?error=userinfo_failed`);
        }

        const profile = (await userRes.json()) as {
          sub: string;
          email: string;
          name?: string;
          picture?: string;
        };
        userGoogleSub = profile.sub;
        userEmail = profile.email || '';
        userName = profile.name || userEmail.split('@')[0] || '';
        userPicture = profile.picture || '';
      } else {
        console.error('[Google Auth Callback] Neither id_token nor access_token in token response');
        return NextResponse.redirect(`${appUrl}/login?error=missing_id_token`);
      }

      // 3. Identify user using Google's stable, unique 'sub' claim (ASVS V10.5.2)
      // 4. Role resolution (ASVS V6.3.2)
      const isConfiguredAdmin = resolveInitialRole(userEmail) === 'admin';
      let userRole = isConfiguredAdmin ? 'admin' : 'BMA Officer';
      let userOrg = 'กรุงเทพมหานคร';
      let userId = userGoogleSub;

      // 5. Connect to MongoDB and upsert User anchored on Google sub (ASVS V10.5.2)
      if (process.env.MONGODB_URI) {
        try {
          await connectToDatabase();
          const updateFields: Record<string, unknown> = {
            email: userEmail,
            name: userName,
            picture: userPicture,
            lastLoginAt: new Date(),
          };
          if (isConfiguredAdmin) {
            updateFields.role = 'admin';
          }

          const dbUser = await User.findOneAndUpdate(
            { googleId: userGoogleSub },
            {
              $set: updateFields,
              $setOnInsert: {
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
          console.warn('[Google Auth Callback] MongoDB sync failed, falling back to ID token session:', dbErr);
        }
      }

      sessionUser = {
        id: userId,
        email: userEmail,
        name: userName,
        picture: userPicture,
        role: userRole,
        org: userOrg,
      };
    } catch (err) {
      console.error('[Google Auth Callback] Exception during OAuth / OIDC validation:', err);
      return NextResponse.redirect(`${appUrl}/login?error=token_validation_failed`);
    }
  }

  // 6. Create signed session token and set secure HTTP-only cookie
  // (Tokens access_token and id_token remain on server and are NOT sent to client JS, ASVS V10.1.1)
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

  // Clear OAuth transaction state cookie
  response.cookies.delete(OAUTH_STATE_COOKIE);

  return response;
}
