// =============================================================================
// middleware.ts - Locale URL Routing, Session Cookie Init & Route Protection
// =============================================================================
// 1. Handles /th/* and /en/* locale-prefixed URL routing:
//    - Rewrites /th/historical → /historical (internal), sets torbidd_locale=th
//    - Rewrites /en/historical → /historical (internal), sets torbidd_locale=en
//    - Bare /historical stays as-is; locale falls back to saved cookie or 'th'
// 2. Ensures every user has an anonymous session ID cookie set.
// 3. Protects authenticated-only routes (/historical, /saved) by redirecting
//    unauthenticated users to /login with a `from` param for post-login return.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { SESSION_COOKIE } from '@/lib/session';
import { AUTH_COOKIE_NAME, decodeSessionPayload, isAdminUser } from '@/lib/auth-constants';

/** Supported locale prefixes */
const SUPPORTED_LOCALES = ['th', 'en'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Locale cookie name — readable by client JS (not httpOnly) */
const LOCALE_COOKIE = 'torbidd_locale';

/** Routes that require a signed-in user (without locale prefix) */
const PROTECTED_ROUTES = ['/historical', '/saved', '/notifications'];

/** Routes that strictly require administrator privileges */
const ADMIN_ROUTES = ['/admin'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Locale Prefix Handling (/th/... and /en/...) ───────────────────────────
  // Match /th/<rest> or /en/<rest> (including bare /th and /en)
  const localeMatch = pathname.match(/^\/(th|en)(\/.*)?$/);
  if (localeMatch) {
    const locale = localeMatch[1] as Locale;
    // The rest of the path after the locale prefix (e.g. "/historical")
    const rest = localeMatch[2] || '/';

    // Build the internal rewrite URL (strip locale prefix, keep the rest)
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = rest;

    // ── Auth checks on the canonical path before rewriting ─────────────────
    const isAdminRoute = ADMIN_ROUTES.some(
      (route) => rest === route || rest.startsWith(`${route}/`),
    );

    if (isAdminRoute) {
      const authCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (!authCookie) {
        const loginUrl = new URL(`/${locale}/login`, req.url);
        loginUrl.searchParams.set('from', `/${locale}${rest}`);
        return NextResponse.redirect(loginUrl);
      }
      const session = decodeSessionPayload(authCookie);
      if (!session || !isAdminUser(session.user)) {
        const homeUrl = new URL(`/${locale}`, req.url);
        homeUrl.searchParams.set('auth_error', 'admin_required');
        return NextResponse.redirect(homeUrl);
      }
    }

    const isProtected = PROTECTED_ROUTES.some(
      (route) => rest === route || rest.startsWith(`${route}/`),
    );
    if (isProtected) {
      const authCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (!authCookie) {
        const loginUrl = new URL(`/${locale}/login`, req.url);
        loginUrl.searchParams.set('from', `/${locale}${rest}`);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Rewrite to the existing canonical page (no route restructuring needed)
    const rewriteResponse = NextResponse.rewrite(rewriteUrl);

    // Set locale cookie (readable by client for LanguageContext)
    rewriteResponse.cookies.set(LOCALE_COOKIE, locale, {
      httpOnly: false, // Must be client-readable for LanguageContext
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });

    // Ensure session cookie is set
    if (!req.cookies.get(SESSION_COOKIE)) {
      rewriteResponse.cookies.set(SESSION_COOKIE, uuidv4(), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    return rewriteResponse;
  }

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
