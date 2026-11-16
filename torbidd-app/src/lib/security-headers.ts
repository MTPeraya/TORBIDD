/**
 * Security Headers Configuration
 *
 * Implements:
 * - ASVS req_id 3.4.1: Strict-Transport-Security (HSTS) with max-age >= 1 year (31536000), includeSubDomains, preload.
 * - ASVS req_id 3.4.3: Content-Security-Policy (CSP) restricting resource origins and iframe framing.
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
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  {
    key: 'Strict-Transport-Security',
    value: HSTS_HEADER_VALUE,
  },
  {
    key: 'Content-Security-Policy',
    value: CSP_HEADER_VALUE,
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
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
