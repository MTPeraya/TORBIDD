/**
 * @jest-environment node
 */
// =============================================================================
// __tests__/auth-middleware.integration.test.ts
// Integration tests for Auth Middleware with real signed tokens and session cookies
// =============================================================================

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import {
  signSession,
  AUTH_COOKIE_NAME,
  AuthSessionUser,
} from '@/lib/auth';
import { SESSION_COOKIE } from '@/lib/session';

describe('Auth Middleware Integration', () => {
  const originalEnv = process.env;

  const adminUser: AuthSessionUser = {
    id: 'admin_001',
    email: 'admin@bma.go.th',
    name: 'Somchai Admin',
    picture: 'https://lh3.googleusercontent.com/admin.jpg',
    role: 'admin',
    org: 'Bangkok Metropolitan Administration',
  };

  const standardUser: AuthSessionUser = {
    id: 'user_002',
    email: 'vendor@techfirm.co.th',
    name: 'Wichai Bidder',
    picture: 'https://lh3.googleusercontent.com/user.jpg',
    role: 'user',
    org: 'Tech Firm Ltd.',
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SESSION_SECRET: 'test_session_secret_key_at_least_32_characters_long!',
      ADMIN_EMAILS: 'admin@bma.go.th,superuser@torbidd.org',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createExpiredToken(user: AuthSessionUser): string {
    const secret = process.env.SESSION_SECRET || 'test_session_secret_key_at_least_32_characters_long!';
    const payload = {
      user,
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
    };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    return `${payloadStr}.${signature}`;
  }

  // ─── 1. Admin API Route Protection (/api/admin/*) ──────────────────────────
  describe('/api/admin/* API Route Protection', () => {
    it('returns 401 Unauthorized when no auth cookie is present', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/stats');
      const res = middleware(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: 'Unauthorized' });
    });

    it('returns 403 Forbidden when token payload is corrupted or malformed', async () => {
      const malformedToken = 'invalid-base64-payload.fake-signature';

      const req = new NextRequest('http://localhost:3000/api/admin/stats', {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${malformedToken}` },
      });
      const res = middleware(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden.*Admin access required/i);
    });

    it('returns 403 Forbidden when session token has expired', async () => {
      const expiredToken = createExpiredToken(adminUser);

      const req = new NextRequest('http://localhost:3000/api/admin/dlq', {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${expiredToken}` },
      });
      const res = middleware(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden.*Admin access required/i);
    });

    it('returns 403 Forbidden when authenticated as standard non-admin user', async () => {
      const userToken = signSession(standardUser);

      const req = new NextRequest('http://localhost:3000/api/admin/sync', {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${userToken}` },
      });
      const res = middleware(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden.*Admin access required/i);
    });

    it('allows access with real admin session token (role: admin)', () => {
      const adminToken = signSession(adminUser);

      const req = new NextRequest('http://localhost:3000/api/admin/stats', {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${adminToken}` },
      });
      const res = middleware(req);

      // Successfully passed middleware -> Next response (200 / not 401 / not 403)
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows access when user email matches ADMIN_EMAILS environment list', () => {
      const emailAdmin: AuthSessionUser = {
        ...standardUser,
        email: 'superuser@torbidd.org',
        role: 'user', // role is user, but email is in ADMIN_EMAILS list
      };
      const emailAdminToken = signSession(emailAdmin);

      const req = new NextRequest('http://localhost:3000/api/admin/classification-queue', {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${emailAdminToken}` },
      });
      const res = middleware(req);

      expect(res.status).toBe(200);
    });
  });

  // ─── 2. Protected Frontend Routes (/saved, /historical, /notifications) ────
  describe('Protected Page Routes', () => {
    it.each(['/saved', '/historical', '/notifications'])(
      'redirects unauthenticated %s request to /login with `from` parameter',
      (path) => {
        const req = new NextRequest(`http://localhost:3000${path}`);
        const res = middleware(req);

        expect(res.status).toBe(307); // NextResponse.redirect default status
        const location = res.headers.get('location');
        expect(location).toContain('/login?from=');
        expect(location).toContain(encodeURIComponent(path));
      },
    );

    it('allows authenticated users to access protected pages', () => {
      const userToken = signSession(standardUser);
      const req = new NextRequest('http://localhost:3000/saved', {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${userToken}` },
      });
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });
  });

  // ─── 3. Admin Page Route (/admin) ──────────────────────────────────────────
  describe('/admin Page Protection', () => {
    it('redirects unauthenticated user to /login?from=/admin', () => {
      const req = new NextRequest('http://localhost:3000/admin');
      const res = middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?from=%2Fadmin');
    });

    it('redirects authenticated non-admin user to /?auth_error=admin_required', () => {
      const userToken = signSession(standardUser);
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${userToken}` },
      });
      const res = middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/?auth_error=admin_required');
    });

    it('allows authenticated admin user into /admin', () => {
      const adminToken = signSession(adminUser);
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${adminToken}` },
      });
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });
  });

  // ─── 4. Anonymous Session Cookie Lifecycle ─────────────────────────────────
  describe('Anonymous Session Cookie Handling', () => {
    it('injects new torbidd_session cookie when none exists', () => {
      const req = new NextRequest('http://localhost:3000/opportunities');
      const res = middleware(req);

      expect(res.status).toBe(200);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain(SESSION_COOKIE);
      expect(setCookie).toContain('Max-Age=31536000'); // 1 year
    });

    it('preserves existing torbidd_session cookie without overwriting', () => {
      const existingSessionId = 'existing-uuid-1234-5678';
      const req = new NextRequest('http://localhost:3000/opportunities', {
        headers: { Cookie: `${SESSION_COOKIE}=${existingSessionId}` },
      });
      const res = middleware(req);

      expect(res.status).toBe(200);
      // When session cookie already exists, middleware does not set a new one
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeNull();
    });
  });
});
