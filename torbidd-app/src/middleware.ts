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
const uuidv4 = () => globalThis.crypto.randomUUID();
import { decodeSessionPayload, isAdminUser } from '@/lib/auth-constants';
import { applySecurityHeaders, applyAntiCacheHeaders } from '@/lib/security-headers';
import { sanitizeIntermediaryHeaders } from '@/lib/trusted-proxy';
import { logAuthzFailure, logSecurityEvent } from '@/lib/audit-logger';
import {
  LOCALE_COOKIE,
  LEGACY_LOCALE_COOKIE,
  SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
  AUTH_COOKIE_NAME,
  LEGACY_AUTH_COOKIE_NAME,
  buildSecureCookieOptions,
  readCookieWithFallback,
} from '@/lib/cookie-security';

/** Supported locale prefixes */
type Locale = 'th' | 'en';

/** Routes that require a signed-in user (without locale prefix) */
const PROTECTED_ROUTES = ['/historical', '/saved', '/notifications'];

/** Routes that strictly require administrator privileges */
const ADMIN_ROUTES = ['/admin'];

function handleMiddleware(req: NextRequest) {
  // ── HTTP Method Restriction: Disable TRACE (ASVS V13.4.4 & V16.3.3) ─────
  if (req.method === 'TRACE') {
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
    logSecurityEvent('HTTP_TRACE_METHOD_REJECTED', clientIp, { pathname: req.nextUrl.pathname, method: req.method }, 'BLOCKED');
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      {
        status: 405,
        headers: {
          Allow: 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        },
      },
    );
  }

  const { pathname } = req.nextUrl;

  // ── Intermediary Header Sanitization (ASVS req_id 4.1.3) ──────────────────
  // Prevent end-users from spoofing internal/intermediary headers (e.g. X-User-ID)
  sanitizeIntermediaryHeaders(req.headers);

  // ── 0. Protocol Security & HTTPS Enforcement (ASVS req_id 4.1.2) ──────────
  // User-facing endpoints redirect from HTTP to HTTPS; machine/API endpoints
  // MUST NOT transparently redirect (which leaks unencrypted credentials/payloads)
  // and instead reject cleartext calls with 426 Upgrade Required.
  // NOTE: In development mode (NODE_ENV=development), HTTP is permitted.
  const isDev = process.env.NODE_ENV === 'development';
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isCleartextHttp = forwardedProto === 'http';

  if (!isDev && isCleartextHttp) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'HTTPS Required',
          message: 'Cleartext HTTP is not permitted for API endpoints. Please use HTTPS (ASVS 4.1.2).',
        },
        {
          status: 426,
          headers: {
            Upgrade: 'TLS/1.3, HTTP/2',
            Connection: 'Upgrade',
          },
        },
      );
    }

    // User-facing browser route: transparently redirect to HTTPS
    const httpsUrl = req.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 308);
  }

  // ── 1. Locale-Prefixed Routes (/th/... and /en/...) ───────────────────────
  const localeMatch = pathname.match(/^\/(th|en)(\/.*)?$/);
  if (localeMatch) {
    const locale = localeMatch[1] as Locale;
    // The rest of the path after the locale prefix (e.g. "/historical")
    const rest = localeMatch[2] || '/';

    // ── Auth checks on the canonical path ─────────────────────────────────
    const isAdminRoute = ADMIN_ROUTES.some(
      (route) => rest === route || rest.startsWith(`${route}/`),
    );

    if (isAdminRoute) {
      const authCookie = readCookieWithFallback(req.cookies, AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME);
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
      const authCookie = readCookieWithFallback(req.cookies, AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME);
      if (!authCookie) {
        const loginUrl = new URL(`/${locale}/login`, req.url);
        loginUrl.searchParams.set('from', `/${locale}${rest}`);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Build the internal rewrite URL (strip locale prefix, keep the rest)
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = rest;

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-torbidd-internal-rewrite', '1');

    // Rewrite to the canonical page
    const rewriteResponse = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });

    // Set locale cookie (readable by client for LanguageContext)
    rewriteResponse.cookies.set(
      LOCALE_COOKIE,
      locale,
      buildSecureCookieOptions({ httpOnly: false, maxAge: 60 * 60 * 24 * 365 }),
    );

    // Ensure session cookie is set
    if (!readCookieWithFallback(req.cookies, SESSION_COOKIE, LEGACY_SESSION_COOKIE)) {
      rewriteResponse.cookies.set(
        SESSION_COOKIE,
        uuidv4(),
        buildSecureCookieOptions({ maxAge: 60 * 60 * 24 * 365 }),
      );
    }

    return rewriteResponse;
  }

  // Helper to ensure secure session cookie is set (ASVS 3.3.1 & 3.3.3)
  const ensureSessionCookie = (res: NextResponse) => {
    if (!readCookieWithFallback(req.cookies, SESSION_COOKIE, LEGACY_SESSION_COOKIE)) {
      res.cookies.set(
        SESSION_COOKIE,
        uuidv4(),
        buildSecureCookieOptions({ maxAge: 60 * 60 * 24 * 365 }),
      );
    }
  };

  // ── 2. Admin API Protection (/api/admin/*) (ASVS V16.3.2) ───────────────
  if (pathname.startsWith('/api/admin/')) {
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const authCookie = readCookieWithFallback(req.cookies, AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME);
    if (!authCookie) {
      logAuthzFailure(null, clientIp, pathname, 'Unauthenticated admin API access', { status: 401 });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = decodeSessionPayload(authCookie);
    if (!session || !isAdminUser(session.user)) {
      logAuthzFailure(session?.user?.id || session?.user?.email || null, clientIp, pathname, 'Forbidden: Admin access required', { status: 403 });
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
  }

  // ── 3. Bare Admin Page Protection (/admin) (ASVS V16.3.2) ─────────────────
  const isAdminRoute = ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isAdminRoute) {
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const authCookie = readCookieWithFallback(req.cookies, AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME);
    if (!authCookie) {
      logAuthzFailure(null, clientIp, pathname, 'Unauthenticated admin page access', { status: 401 });
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const session = decodeSessionPayload(authCookie);
    if (!session || !isAdminUser(session.user)) {
      logAuthzFailure(session?.user?.id || session?.user?.email || null, clientIp, pathname, 'Forbidden: Admin role required for /admin', { status: 403 });
      const homeUrl = new URL('/', req.url);
      homeUrl.searchParams.set('auth_error', 'admin_required');
      return NextResponse.redirect(homeUrl);
    }

    const response = NextResponse.next();
    ensureSessionCookie(response);
    return response;
  }

  // ── 4. Bare Protected Routes (/historical, /saved, /notifications) ────────
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtected) {
    const authCookie = readCookieWithFallback(req.cookies, AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME);
    if (!authCookie) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const response = NextResponse.next();
    ensureSessionCookie(response);
    return response;
  }

  // ── 5. Bypass API, docs, static assets, and Next.js router data requests ──
  const isApiOrStatic =
    pathname.startsWith('/api/') ||
    pathname.startsWith('/docs/') ||
    pathname.includes('.') ||
    pathname.startsWith('/_next/') ||
    req.headers.has('rsc') ||
    req.headers.has('next-router-prefetch') ||
    req.headers.has('next-router-state-tree') ||
    req.nextUrl.searchParams.has('_rsc');

  if (isApiOrStatic) {
    const response = NextResponse.next();
    ensureSessionCookie(response);
    return response;
  }

  // ── 6. Redirect bare page routes to locale-prefixed routes when host header present ──
  // e.g. /opportunities -> /th/opportunities or /en/opportunities
  if (!req.headers.has('x-torbidd-internal-rewrite') && pathname !== '/' && req.headers.has('host')) {
    const savedLocale = readCookieWithFallback(req.cookies, LOCALE_COOKIE, LEGACY_LOCALE_COOKIE);
    const preferredLocale: Locale =
      savedLocale === 'en' || savedLocale === 'th' ? (savedLocale as Locale) : 'th';

    const targetUrl = new URL(
      `/${preferredLocale}${pathname}`,
      req.url,
    );
    targetUrl.search = req.nextUrl.search;
    return NextResponse.redirect(targetUrl);
  }

  // ── 7. Session Cookie Initialization for public routes ────────────────────
  const response = NextResponse.next();
  ensureSessionCookie(response);
  return response;
}

export function middleware(req: NextRequest) {
  const response = handleMiddleware(req);
  applySecurityHeaders(response);

  // ── ASVS V14.3.2 & V14.2.2: Anti-caching headers for sensitive/dynamic routes ─
  const { pathname } = req.nextUrl;
  const isSensitiveRoute =
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin') ||
    pathname.includes('/historical') ||
    pathname.includes('/saved') ||
    pathname.includes('/notifications') ||
    pathname.includes('/settings');

  if (isSensitiveRoute) {
    applyAntiCacheHeaders(response);
  }

  return response;
}

export const proxy = middleware;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
