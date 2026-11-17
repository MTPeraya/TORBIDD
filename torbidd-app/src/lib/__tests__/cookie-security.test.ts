/**
 * @jest-environment node
 */
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

import {
  AUTH_COOKIE_NAME,
  SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  LOCALE_COOKIE,
  LEGACY_AUTH_COOKIE_NAME,
  LEGACY_SESSION_COOKIE,
  LEGACY_OAUTH_STATE_COOKIE,
  LEGACY_LOCALE_COOKIE,
  buildSecureCookieOptions,
  validateCookieSecurity,
  readCookieWithFallback,
} from '../cookie-security';
import { getSessionId } from '../session';
import { getAuthSessionFromRequest, signSession } from '../auth';
import { NextRequest } from 'next/server';

describe('Cookie Security Controls (ASVS 3.3.1 & 3.3.3)', () => {
  describe('req_id 3.3.1 - Cookie Secure Attribute', () => {
    it('buildSecureCookieOptions must always set secure: true by default', () => {
      const opts = buildSecureCookieOptions();
      expect(opts.secure).toBe(true);
    });

    it('buildSecureCookieOptions preserves secure: true even when not explicitly passed', () => {
      const opts = buildSecureCookieOptions({ httpOnly: true, maxAge: 3600 });
      expect(opts.secure).toBe(true);
      expect(opts.httpOnly).toBe(true);
      expect(opts.maxAge).toBe(3600);
    });

    it('validateCookieSecurity rejects cookies missing secure attribute', () => {
      const result = validateCookieSecurity('__Host-test', {
        secure: false,
        path: '/',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Secure'))).toBe(true);
    });

    it('validateCookieSecurity accepts cookies with secure: true and valid prefix', () => {
      const result = validateCookieSecurity('__Host-test', {
        secure: true,
        path: '/',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('req_id 3.3.3 - __Host- Cookie Prefix', () => {
    it('all application session and state cookies use __Host- prefix', () => {
      expect(AUTH_COOKIE_NAME).toMatch(/^__Host-/);
      expect(SESSION_COOKIE).toMatch(/^__Host-/);
      expect(OAUTH_STATE_COOKIE).toMatch(/^__Host-/);
      expect(LOCALE_COOKIE).toMatch(/^__Host-/);
    });

    it('buildSecureCookieOptions ensures path is / (required by __Host-)', () => {
      const opts = buildSecureCookieOptions();
      expect(opts.path).toBe('/');
    });

    it('buildSecureCookieOptions strips any domain attribute to enforce host-only scope', () => {
      const opts = buildSecureCookieOptions({
        domain: '.example.com',
      } as unknown as Record<string, unknown>);
      expect(opts.domain).toBeUndefined();
    });

    it('validateCookieSecurity rejects __Host- cookies if a Domain attribute is specified', () => {
      const result = validateCookieSecurity('__Host-session', {
        secure: true,
        path: '/',
        domain: 'example.com',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Domain attribute'))).toBe(true);
    });

    it('validateCookieSecurity rejects __Host- cookies if Path is not /', () => {
      const result = validateCookieSecurity('__Host-session', {
        secure: true,
        path: '/api',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Path set to '/'"))).toBe(true);
    });

    it('validateCookieSecurity rejects unprefixed cookies unless legacy is permitted', () => {
      const unPrefixed = validateCookieSecurity('unprefixed_cookie', {
        secure: true,
        path: '/',
      });
      expect(unPrefixed.valid).toBe(false);
      expect(unPrefixed.errors.some((e) => e.includes('__Host-'))).toBe(true);

      const legacyAllowed = validateCookieSecurity(
        'unprefixed_cookie',
        { secure: true, path: '/' },
        true,
      );
      expect(legacyAllowed.valid).toBe(true);
    });

    it('validateCookieSecurity allows __Secure- prefix when __Host- is not used', () => {
      const securePrefixed = validateCookieSecurity('__Secure-subdomain-cookie', {
        secure: true,
        path: '/admin',
      });
      expect(securePrefixed.valid).toBe(true);
    });
  });

  describe('readCookieWithFallback Helper (Backward Compatibility)', () => {
    it('prefers the primary __Host- cookie when both are present', () => {
      const mockStore = {
        get: (name: string) => {
          if (name === AUTH_COOKIE_NAME) return { value: 'primary_token' };
          if (name === LEGACY_AUTH_COOKIE_NAME) return { value: 'legacy_token' };
          return undefined;
        },
      };

      const val = readCookieWithFallback(mockStore, AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME);
      expect(val).toBe('primary_token');
    });

    it('falls back to legacy cookie name when primary __Host- cookie is absent', () => {
      const mockStore = {
        get: (name: string) => {
          if (name === LEGACY_AUTH_COOKIE_NAME) return { value: 'legacy_token' };
          return undefined;
        },
      };

      const val = readCookieWithFallback(mockStore, AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME);
      expect(val).toBe('legacy_token');
    });

    it('returns undefined if neither primary nor fallback exists', () => {
      const mockStore = {
        get: () => undefined,
      };

      const val = readCookieWithFallback(mockStore, AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME);
      expect(val).toBeUndefined();
    });

    it('handles null/undefined store safely', () => {
      expect(readCookieWithFallback(null, 'a', 'b')).toBeUndefined();
      expect(readCookieWithFallback(undefined, 'a', 'b')).toBeUndefined();
    });
  });

  describe('Integration with Session & Auth Resolution', () => {
    it('getSessionId reads __Host-torbidd_session if present', () => {
      const req = new NextRequest('http://localhost:3000', {
        headers: {
          cookie: `${SESSION_COOKIE}=sess_host_prefixed_123`,
        },
      });
      expect(getSessionId(req)).toBe('sess_host_prefixed_123');
    });

    it('getSessionId falls back to legacy torbidd_session if present', () => {
      const req = new NextRequest('http://localhost:3000', {
        headers: {
          cookie: `${LEGACY_SESSION_COOKIE}=sess_legacy_456`,
        },
      });
      expect(getSessionId(req)).toBe('sess_legacy_456');
    });

    it('getAuthSessionFromRequest resolves user from __Host-torbidd_auth_session', () => {
      const testUser = {
        id: 'u123',
        email: 'user@example.com',
        name: 'Test User',
        picture: '',
        role: 'user',
        org: 'Test Org',
      };
      const token = signSession(testUser);

      const req = {
        cookies: {
          get: (name: string) => (name === AUTH_COOKIE_NAME ? { value: token } : undefined),
        },
      };

      const resolved = getAuthSessionFromRequest(req);
      expect(resolved?.id).toBe('u123');
      expect(resolved?.email).toBe('user@example.com');
    });

    it('getAuthSessionFromRequest resolves user from legacy torbidd_auth_session fallback', () => {
      const testUser = {
        id: 'u456',
        email: 'legacy@example.com',
        name: 'Legacy User',
        picture: '',
        role: 'admin',
        org: 'Admin Org',
      };
      const token = signSession(testUser);

      const req = {
        cookies: {
          get: (name: string) =>
            name === LEGACY_AUTH_COOKIE_NAME ? { value: token } : undefined,
        },
      };

      const resolved = getAuthSessionFromRequest(req);
      expect(resolved?.id).toBe('u456');
      expect(resolved?.email).toBe('legacy@example.com');
    });
  });
});
