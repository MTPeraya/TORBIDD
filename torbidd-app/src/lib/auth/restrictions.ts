// =============================================================================
// lib/auth/restrictions.ts - Authentication Method Restrictions (SEC-03)
// =============================================================================
// Enforces ASVS V6.3.6:
// "Email must not be used as a single-factor or multi-factor authentication mechanism."
//
// Architectural Principles:
// 1. Google OAuth 2.0 / OIDC is the ONLY permitted authentication mechanism.
// 2. Email addresses are used strictly as identity labels/identifiers and for
//    asynchronous notifications, NEVER as an independent authentication factor.
// 3. Email-only authentication, magic links, passwords, and email-based OTPs
//    are explicitly forbidden and blocked.
// 4. User profile modification must never allow mutating the account email,
//    preventing account takeover without re-authenticating through Google.
// =============================================================================

export const ALLOWED_AUTH_METHODS = ['google_oauth'] as const;
export type AllowedAuthMethod = (typeof ALLOWED_AUTH_METHODS)[number];

export const PROHIBITED_AUTH_METHODS = [
  'email_password',
  'email_otp',
  'magic_link',
  'sms_otp',
  'anonymous_password',
] as const;
export type ProhibitedAuthMethod = (typeof PROHIBITED_AUTH_METHODS)[number];

export const ASVS_V6_3_6_MESSAGE =
  'Email-only authentication, password login, and email-based OTPs are prohibited ' +
  'per security policy ASVS V6.3.6. Authentication is strictly delegated to Google OAuth 2.0.';

/**
 * Returns true if the requested authentication method is approved for TORBIDD.
 */
export function isAuthMethodAllowed(method: string): boolean {
  if (!method) return false;
  const normalized = method.toLowerCase().trim();
  return (ALLOWED_AUTH_METHODS as readonly string[]).includes(normalized);
}

/**
 * Asserts that the specified authentication method is allowed.
 * Throws an Error with ASVS V6.3.6 reference if prohibited.
 */
export function assertAllowedAuthMethod(method: string): void {
  if (!isAuthMethodAllowed(method)) {
    throw new Error(
      `Authentication method '${method}' is not permitted. ${ASVS_V6_3_6_MESSAGE}`,
    );
  }
}

/**
 * Validates whether an email update operation in user profile management
 * is permitted (UC-8).
 *
 * In accordance with ASVS V6.3.6 and account takeover prevention:
 * - A user cannot change their session email via normal profile updates.
 * - Email addresses are strictly bound to Google OAuth tokens.
 * - Changing the account email requires re-authenticating with the target Google account.
 */
export function validateEmailMutation(
  currentEmail: string,
  attemptedEmail?: string | null,
): { allowed: boolean; reason?: string } {
  if (attemptedEmail === undefined || attemptedEmail === null) {
    return { allowed: true };
  }

  const normalizedCurrent = currentEmail.toLowerCase().trim();
  const normalizedAttempted = attemptedEmail.toLowerCase().trim();

  if (normalizedAttempted === normalizedCurrent) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      'Direct email modification is prohibited. User identity and email are bound ' +
      'to Google OAuth assertions (ASVS V6.3.6). To change email, authenticate with the new Google account.',
  };
}
