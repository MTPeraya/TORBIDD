// =============================================================================
// middleware.ts - Session Cookie Initialization & Route Protection
// =============================================================================
// 1. Ensures every user has an anonymous session ID cookie set.
// 2. Protects authenticated-only routes (/historical, /saved) by redirecting
//    unauthenticated users to /login with a `from` param for post-login return.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { SESSION_COOKIE } from '@/lib/session';
import { AUTH_COOKIE_NAME, decodeSessionPayload, isAdminUser } from '@/lib/auth-constants';

/** Routes that require a signed-in user */
const PROTECTED_ROUTES = ['/historical', '/saved', '/notifications'];

/** Routes that strictly require administrator privileges */
const ADMIN_ROUTES = ['/admin'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin Page Protection (/admin) ─────────────────────────────────────────
  const isAdminRoute = ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isAdminRoute) {
    const authCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!authCookie) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const session = decodeSessionPayload(authCookie);
    if (!session || !isAdminUser(session.user)) {
      const homeUrl = new URL('/', req.url);
      homeUrl.searchParams.set('auth_error', 'admin_required');
      return NextResponse.redirect(homeUrl);
    }
  }

  // ── Admin API Protection (/api/admin/*) ────────────────────────────────────
  if (pathname.startsWith('/api/admin/')) {
    const authCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = decodeSessionPayload(authCookie);
    if (!session || !isAdminUser(session.user)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
  }

  // ── Standard Protected Routes ─────────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtected) {
    const authCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!authCookie) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Session Cookie Initialization ─────────────────────────────────────────
  const response = NextResponse.next();

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
