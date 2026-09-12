// =============================================================================
// app/api/auth/logout/route.ts - Clear Authentication Session
// =============================================================================

import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Logged out successfully' });

  res.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return res;
}
