// =============================================================================
// middleware.ts - Session Cookie Initialization
// =============================================================================
// Ensures every user has an anonymous session ID cookie set.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { SESSION_COOKIE } from '@/lib/session';

export function middleware(req: NextRequest) {
  const response = NextResponse.next();

  // Set session cookie if not present
  if (!req.cookies.get(SESSION_COOKIE)) {
    const sessionId = uuidv4();
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
