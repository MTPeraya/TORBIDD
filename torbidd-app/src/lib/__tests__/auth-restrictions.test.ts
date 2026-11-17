// =============================================================================
// lib/__tests__/auth-restrictions.test.ts - Unit tests for SEC-03 controls
// =============================================================================

import {
  ALLOWED_AUTH_METHODS,
  PROHIBITED_AUTH_METHODS,
  isAuthMethodAllowed,
  assertAllowedAuthMethod,
  validateEmailMutation,
  ASVS_V6_3_6_MESSAGE,
} from '../auth/restrictions';

describe('Authentication Method Restrictions (SEC-03 / ASVS V6.3.6)', () => {
  describe('isAuthMethodAllowed', () => {
    it('allows google_oauth', () => {
      expect(isAuthMethodAllowed('google_oauth')).toBe(true);
      expect(isAuthMethodAllowed('GOOGLE_OAUTH')).toBe(true);
    });

    it('rejects email-password authentication', () => {
      expect(isAuthMethodAllowed('email_password')).toBe(false);
    });

    it('rejects email OTP authentication', () => {
      expect(isAuthMethodAllowed('email_otp')).toBe(false);
    });

    it('rejects magic link authentication', () => {
      expect(isAuthMethodAllowed('magic_link')).toBe(false);
    });

    it('rejects SMS OTP authentication', () => {
      expect(isAuthMethodAllowed('sms_otp')).toBe(false);
    });

    it('rejects empty or null method', () => {
      expect(isAuthMethodAllowed('')).toBe(false);
      // @ts-expect-error testing invalid type
      expect(isAuthMethodAllowed(null)).toBe(false);
    });
  });

  describe('assertAllowedAuthMethod', () => {
    it('succeeds without error for google_oauth', () => {
      expect(() => assertAllowedAuthMethod('google_oauth')).not.toThrow();
    });

    it('throws error citing ASVS V6.3.6 for prohibited methods', () => {
      for (const method of PROHIBITED_AUTH_METHODS) {
        expect(() => assertAllowedAuthMethod(method)).toThrow(/ASVS V6\.3\.6/);
      }
    });

    it('throws error for unknown authentication methods', () => {
      expect(() => assertAllowedAuthMethod('custom_token')).toThrow(/not permitted/);
    });
  });

  describe('validateEmailMutation (Profile Account Takeover Guard)', () => {
    const currentEmail = 'officer.somchai@bangkok.go.th';

    it('allows update when attemptedEmail is undefined or null', () => {
      expect(validateEmailMutation(currentEmail, undefined).allowed).toBe(true);
      expect(validateEmailMutation(currentEmail, null).allowed).toBe(true);
    });

    it('allows update when attemptedEmail matches currentEmail exactly', () => {
      expect(validateEmailMutation(currentEmail, currentEmail).allowed).toBe(true);
    });

    it('allows update when casing differs but email is identical', () => {
      expect(
        validateEmailMutation(currentEmail, 'Officer.Somchai@Bangkok.go.th').allowed,
      ).toBe(true);
    });

    it('blocks update when user attempts to change email address', () => {
      const result = validateEmailMutation(currentEmail, 'attacker@evil.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Direct email modification is prohibited/);
      expect(result.reason).toMatch(/ASVS V6\.3\.6/);
    });
  });

  describe('Policy Constants', () => {
    it('lists only google_oauth in ALLOWED_AUTH_METHODS', () => {
      expect(ALLOWED_AUTH_METHODS).toEqual(['google_oauth']);
    });

    it('contains clear ASVS V6.3.6 security notice in ASVS_V6_3_6_MESSAGE', () => {
      expect(ASVS_V6_3_6_MESSAGE).toContain('ASVS V6.3.6');
      expect(ASVS_V6_3_6_MESSAGE).toContain('Google OAuth 2.0');
    });
  });
});
