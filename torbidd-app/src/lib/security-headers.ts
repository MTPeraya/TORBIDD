/**
 * Security Headers Configuration
 *
 * Implements:
 * - ASVS req_id 3.4.1: Strict-Transport-Security (HSTS) with max-age >= 1 year (31536000), includeSubDomains, preload.
 * - ASVS req_id 3.4.3: Content-Security-Policy (CSP) restricting resource origins and iframe framing.
 * - ASVS req_id 3.4.4: X-Content-Type-Options: nosniff — prevents MIME-sniffing attacks.
 * - ASVS req_id 3.4.5: Referrer-Policy — prevents sensitive URL data leakage to third parties via Referer header.
 * - ASVS req_id 3.4.6: CSP frame-ancestors directive — prevents clickjacking / UI-redress attacks.
 * - ASVS req_id 3.4.7: CSP report-to directive + Reporting-Endpoints header — enables violation telemetry.
 * - ASVS req_id 3.4.8: Cross-Origin-Opener-Policy — isolates browsing context, prevents tabnabbing & window attacks.
 * - ASVS req_id 3.5.8: Cross-Origin-Resource-Policy — prevents cross-site embedding of authenticated resources.
 */

export const HSTS_HEADER_VALUE = 'max-age=31536000; includeSubDomains; preload';

/**
 * ASVS req_id 3.4.7 — The path to which CSP violation reports are POSTed.
 * This must match the route created at src/app/api/security/csp-report/route.ts.
 */
export const CSP_REPORT_PATH = '/api/security/csp-report';

/**
 * ASVS req_id 3.4.7 — Reporting-Endpoints group name referenced by the CSP report-to directive.
 */
export const CSP_REPORT_GROUP = 'csp-violations';

export const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
  'img-src': ["'self'", 'data:', 'blob:', 'https://lh3.googleusercontent.com'],
  'connect-src': [
    "'self'",
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
    'https://generativelanguage.googleapis.com',
  ],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  // ASVS req_id 3.4.6 — frame-ancestors: explicitly deny all framing (clickjacking prevention)
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'", 'https://accounts.google.com'],
  // ASVS req_id 3.4.7 — report-to: violations are sent to the named Reporting-Endpoints group
  'report-to': [CSP_REPORT_GROUP],
  // Legacy fallback for older browsers that do not support Reporting API v1
  'report-uri': [CSP_REPORT_PATH],
};

/**
 * Builds the Content-Security-Policy string from directive map.
 */
export function buildCspHeader(directives = CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

export const CSP_HEADER_VALUE = buildCspHeader();

/**
 * All security headers as an array of { key, value } objects for Next.js next.config.ts headers().
 *
 * - Strict-Transport-Security  → ASVS req_id 3.4.1
 * - Content-Security-Policy    → ASVS req_id 3.4.3 (frame-ancestors → 3.4.6; report-to → 3.4.7)
 * - X-Content-Type-Options     → ASVS req_id 3.4.4
 * - Referrer-Policy            → ASVS req_id 3.4.5
 * - Reporting-Endpoints        → ASVS req_id 3.4.7 (Reporting API v1 group declaration)
 * - Cross-Origin-Opener-Policy → ASVS req_id 3.4.8
 * - Cross-Origin-Resource-Policy → ASVS req_id 3.5.8 (global default; tightened per-route in middleware)
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  {
    // ASVS req_id 3.4.1 — HSTS: enforce HTTPS for 1 year across all subdomains
    key: 'Strict-Transport-Security',
    value: HSTS_HEADER_VALUE,
  },
  {
    // ASVS req_id 3.4.3 — CSP: restrict resource origins, block plugins, prevent framing
    // ASVS req_id 3.4.6 — CSP frame-ancestors 'none': deny all iframe embedding
    // ASVS req_id 3.4.7 — CSP report-to: send violations to Reporting-Endpoints group
    key: 'Content-Security-Policy',
    value: CSP_HEADER_VALUE,
  },
  {
    // ASVS req_id 3.4.4 — Prevent MIME-type sniffing; browser must respect declared Content-Type
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // ASVS req_id 3.4.5 — Limit Referer header to prevent leaking internal paths/params to third parties
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // ASVS req_id 3.4.7 — Reporting API v1: declares the named endpoint group referenced by CSP report-to
    key: 'Reporting-Endpoints',
    value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`,
  },
  {
    // ASVS req_id 3.4.8 — Isolate browsing context to same-origin; prevents tabnabbing and
    // cross-window attacks where a malicious page gains access to window.opener.
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    // ASVS req_id 3.5.8 — Prevent browsers from loading this app's responses as cross-origin
    // sub-resources (images, scripts, etc.) embedded by untrusted third-party pages.
    // Individual authenticated API routes additionally apply Sec-Fetch-* validation via
    // src/lib/fetch-metadata.ts for defence-in-depth.
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
  {
    // Defense in depth: redundant framing protection alongside CSP frame-ancestors
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Defense in depth: disable camera, microphone, geolocation access
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

/**
 * Helper to apply security headers to a Response or Headers object (e.g. in middleware).
 */
export function applySecurityHeaders<T extends { headers: Headers }>(response: T): T {
  for (const { key, value } of SECURITY_HEADERS) {
    response.headers.set(key, value);
  }
  return response;
}
