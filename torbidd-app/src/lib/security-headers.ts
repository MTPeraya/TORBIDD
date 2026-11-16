/**
 * Security Headers Configuration
 *
 * Implements:
 * - ASVS req_id 3.4.1: Strict-Transport-Security (HSTS) with max-age >= 1 year (31536000), includeSubDomains, preload.
 * - ASVS req_id 3.4.3: Content-Security-Policy (CSP) restricting resource origins and iframe framing.
 * - ASVS req_id 3.4.4: X-Content-Type-Options: nosniff — prevents MIME-sniffing attacks.
 * - ASVS req_id 3.4.5: Referrer-Policy — prevents sensitive URL data leakage to third parties via Referer header.
 */

export const HSTS_HEADER_VALUE = 'max-age=31536000; includeSubDomains; preload';

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
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'", 'https://accounts.google.com'],
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
 * - Content-Security-Policy    → ASVS req_id 3.4.3
 * - X-Content-Type-Options     → ASVS req_id 3.4.4
 * - Referrer-Policy            → ASVS req_id 3.4.5
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  {
    // ASVS req_id 3.4.1 — HSTS: enforce HTTPS for 1 year across all subdomains
    key: 'Strict-Transport-Security',
    value: HSTS_HEADER_VALUE,
  },
  {
    // ASVS req_id 3.4.3 — CSP: restrict resource origins, block plugins, prevent framing
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
