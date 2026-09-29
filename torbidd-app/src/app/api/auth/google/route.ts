// =============================================================================
// app/api/auth/google/route.ts - Initiate Google OAuth Flow
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { OAUTH_STATE_COOKIE } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnUrl = searchParams.get('returnUrl') || '/';
  const isMock = searchParams.get('mock') === 'true';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const redirectUri = `${appUrl}/api/auth/callback/google`;

  // If credentials are not set and developer mock mode is requested or in local dev fallback
  if (!clientId || !clientSecret || isMock) {
    if (process.env.NODE_ENV !== 'production') {
      const mockState = crypto.randomBytes(16).toString('hex');
      const res = NextResponse.redirect(
        `${appUrl}/api/auth/callback/google?code=mock_dev_code&state=${mockState}&mock=true`,
      );
      res.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state: mockState, returnUrl }), {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      });
      return res;
    } else {
      return NextResponse.json(
        { error: 'Google OAuth credentials not configured on server' },
        { status: 500 },
      );
    }
  }

  // Generate secure random state and store with returnUrl
  const stateVal = crypto.randomBytes(16).toString('hex');
  const stateData = JSON.stringify({ state: stateVal, returnUrl });

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', stateVal);
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(googleAuthUrl.toString());
  response.cookies.set(OAUTH_STATE_COOKIE, stateData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
