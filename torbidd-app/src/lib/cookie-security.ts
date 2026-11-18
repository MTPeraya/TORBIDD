// =============================================================================
// lib/cookie-security.ts — Secure Cookie Configuration & Helpers
// =============================================================================
// Implements:
// - ASVS req_id 3.3.1: Verify cookies have the 'Secure' attribute set, and if the
//   '__Host-' prefix is not used for the cookie name, the '__Secure-' prefix must be used.
// - ASVS req_id 3.3.3: Verify cookies have the '__Host-' prefix for the cookie name
//   unless they are explicitly designed to be shared with other hosts.
//
// RFC 6265bis __Host- prefix requirements:
//  1. Cookie name MUST start with '__Host-'.
//  2. Cookie MUST have the 'Secure' attribute.
//  3. Cookie MUST have 'Path=/'.
//  4. Cookie MUST NOT have a 'Domain' attribute.
// =============================================================================

export interface SecureCookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
  domain?: string;
}

/** Primary cookie names with __Host- prefix (ASVS 3.3.3) */
export const AUTH_COOKIE_NAME = '__Host-torbidd_auth_session';
export const SESSION_COOKIE = '__Host-torbidd_session';
export const OAUTH_STATE_COOKIE = '__Host-torbidd_oauth_state';
export const LOCALE_COOKIE = '__Host-torbidd_locale';

/** Legacy un-prefixed names preserved for backward-compatible reading during rollout */
export const LEGACY_AUTH_COOKIE_NAME = 'torbidd_auth_session';
export const LEGACY_SESSION_COOKIE = 'torbidd_session';
export const LEGACY_OAUTH_STATE_COOKIE = 'torbidd_oauth_state';
export const LEGACY_LOCALE_COOKIE = 'torbidd_locale';

/**
 * Builds cookie options compliant with ASVS 3.3.1 & 3.3.3.
 * Enforces secure: true, path: '/', and strips any domain attribute.
 */
export function buildSecureCookieOptions(
  overrides?: Partial<SecureCookieOptions>,
): SecureCookieOptions {
  const rest = { ...overrides };
  delete rest.domain;
  return {
    httpOnly: true,
    secure: true, // ASVS 3.3.1 mandate
    sameSite: 'lax',
    path: '/', // ASVS 3.3.3 __Host- prefix requirement
    ...rest,
  };
}

/**
 * Generic interface for objects that provide cookie reading capabilities
 * (such as NextRequest.cookies, ReadonlyRequestCookies, Headers, etc.)
 */
export interface CookieStoreReader {
  get(name: string): { value?: string } | undefined;
}

/**
 * Reads a cookie value by trying the primary (__Host- prefixed) name first,
 * and falling back to the legacy un-prefixed name if present.
 */
export function readCookieWithFallback(
  store: CookieStoreReader | undefined | null,
  primaryName: string,
  fallbackName?: string,
): string | undefined {
  if (!store?.get) return undefined;
  const primary = store.get(primaryName)?.value;
  if (primary && primary.length > 0) return primary;
  if (fallbackName) {
    const fallback = store.get(fallbackName)?.value;
    if (fallback && fallback.length > 0) return fallback;
  }
  return undefined;
}

/**
 * Validation result for ASVS 3.3.1 and 3.3.3 compliance.
 */
export interface CookieSecurityValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a cookie name and its options against ASVS 3.3.1 and 3.3.3 rules.
 */
export function validateCookieSecurity(
  cookieName: string,
  options: SecureCookieOptions,
  allowLegacy = false,
): CookieSecurityValidation {
  const errors: string[] = [];

  // ASVS 3.3.1: Verify cookie has 'Secure' attribute set
  if (options.secure !== true) {
    errors.push(`Cookie "${cookieName}" must have the "Secure" attribute set to true (ASVS 3.3.1).`);
  }

  // ASVS 3.3.3: Verify cookie has '__Host-' prefix unless explicitly designed otherwise
  const isHostPrefixed = cookieName.startsWith('__Host-');
  const isSecurePrefixed = cookieName.startsWith('__Secure-');

  if (!isHostPrefixed && !isSecurePrefixed && !allowLegacy) {
    errors.push(
      `Cookie "${cookieName}" must use '__Host-' (or '__Secure-') prefix (ASVS 3.3.1 & 3.3.3).`,
    );
  }

  // RFC 6265bis __Host- constraints:
  if (isHostPrefixed) {
    if (options.domain !== undefined && options.domain !== '') {
      errors.push(`Cookie "${cookieName}" uses '__Host-' and therefore MUST NOT have a Domain attribute.`);
    }
    if (options.path !== '/') {
      errors.push(`Cookie "${cookieName}" uses '__Host-' and therefore MUST have Path set to '/' (got "${options.path}").`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
