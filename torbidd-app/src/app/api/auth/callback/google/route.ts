// =============================================================================
// app/api/auth/callback/google/route.ts - Google OAuth Callback Handler
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, OAUTH_STATE_COOKIE, signSession, AuthSessionUser } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const isMock = searchParams.get('mock') === 'true';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  // Validate state cookie to prevent CSRF attacks
  const stateCookieRaw = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  let returnUrl = '/';

  if (!stateCookieRaw) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
  }

  try {
    const parsedState = JSON.parse(stateCookieRaw);
    if (parsedState.state !== state) {
      return NextResponse.redirect(`${appUrl}/login?error=state_mismatch`);
    }
    if (parsedState.returnUrl && parsedState.returnUrl.startsWith('/')) {
      returnUrl = parsedState.returnUrl;
    }
  } catch {
    return NextResponse.redirect(`${appUrl}/login?error=state_parse_failed`);
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
    // Local developer fallback mode
    sessionUser = {
      id: 'mock_user_bma_123',
      email: 'officer.bma@bangkok.go.th',
      name: 'BMA Procurement Officer',
      picture: '',
      role: 'BMA Procurement Officer',
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
      let userRole = 'BMA Officer';
      let userOrg = 'กรุงเทพมหานคร';

      if (process.env.MONGODB_URI) {
        try {
          await connectToDatabase();
          const dbUser = await User.findOneAndUpdate(
            { googleId: profile.sub },
            {
              $set: {
                email: profile.email,
                name: profile.name || '',
                picture: profile.picture || '',
                lastLoginAt: new Date(),
              },
              $setOnInsert: {
                role: 'BMA Officer',
                org: 'กรุงเทพมหานคร',
              },
            },
            { new: true, upsert: true },
          );

          if (dbUser?._id) {
            userId = dbUser._id.toString();
            userRole = dbUser.role || 'BMA Officer';
            userOrg = dbUser.org || 'กรุงเทพมหานคร';
          }
        } catch (dbErr) {
          console.warn('[Google Auth Callback] MongoDB sync failed, falling back to Google profile session:', dbErr);
        }
      }

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

  const response = NextResponse.redirect(`${appUrl}${returnUrl}`);

  // Set auth session cookie (7 days)
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  // Clear OAuth state cookie
  response.cookies.delete(OAUTH_STATE_COOKIE);

  return response;
}
