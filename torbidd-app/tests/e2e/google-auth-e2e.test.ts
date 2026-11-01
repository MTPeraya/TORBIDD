/**
 * @jest-environment node
 */
// =============================================================================
// tests/e2e/google-auth-e2e.test.ts
// Comprehensive End-to-End Tests for Google OAuth Authentication Flow (UC-01)
//
// Covers:
// 1. Google OAuth Initiation (/api/auth/google)
// 2. State & CSRF Protection (HMAC signature & cookies)
// 3. Callback Handler (/api/auth/callback/google)
// 4. Automatic TORBIDD Account Creation for New Users
// 5. Returning User Sign-in & Custom Role Preservation
// 6. Session Verification & Profile Management (/api/auth/me)
// 7. Logout & Cookie Revocation (/api/auth/logout)
// 8. Route Protection via Middleware (Public, Protected, Admin)
// 9. Full End-to-End Lifecycle Chaining
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-v4-123',
}));

import { GET as initiateGoogleAuth } from '@/app/api/auth/google/route';
import { GET as handleGoogleCallback } from '@/app/api/auth/callback/google/route';
import { GET as getMe, PUT as updateMe } from '@/app/api/auth/me/route';
import { POST as handleLogout } from '@/app/api/auth/logout/route';
import { middleware } from '@/middleware';
import {
  AUTH_COOKIE_NAME,
  OAUTH_STATE_COOKIE,
  signSession,
  verifySession,
  signOAuthState,
  verifyOAuthState,
  isAdminUser,
  AuthSessionUser,
} from '@/lib/auth';
import { SESSION_COOKIE } from '@/lib/session';
import User from '@/models/User';

// Mock MongoDB connection
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/User');

describe('End-to-End Google OAuth Authentication Flow', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  // In-memory mock database store for Users
  let mockUserDatabase: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'mock-google-client-id-12345.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'mock-google-client-secret-xyz987',
      SESSION_SECRET: 'test-session-secret-key-at-least-32-chars-long!',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      MONGODB_URI: 'mongodb://mock-cluster/torbidd',
      ADMIN_EMAILS: 'admin.director@bangkok.go.th, system.admin@bangkok.go.th',
    };

    mockUserDatabase = new Map();

    // Mock User.findOneAndUpdate to mimic MongoDB Atlas upsert and update semantics
    (User.findOneAndUpdate as jest.Mock).mockImplementation(
      async (filter: { googleId?: string; $or?: any[] }, update: any, options?: { upsert?: boolean; new?: boolean }) => {
        let existing: any = null;

        if (filter.googleId) {
          existing = mockUserDatabase.get(filter.googleId);
        }

        if (!existing && filter.$or) {
          for (const user of mockUserDatabase.values()) {
            for (const cond of filter.$or) {
              if (cond.googleId && user.googleId === cond.googleId) {
                existing = user;
                break;
              }
              if (cond._id && user._id === cond._id) {
                existing = user;
                break;
              }
              if (cond.email && user.email === cond.email) {
                existing = user;
                break;
              }
            }
            if (existing) break;
          }
        }

        const googleId = filter.googleId || existing?.googleId;

        if (!existing && options?.upsert && googleId) {
          // Brand New User Creation
          existing = {
            _id: `mongo_id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            googleId,
            ...(update.$setOnInsert || {}),
            ...(update.$set || {}),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockUserDatabase.set(googleId, existing);
          return existing;
        }

        if (existing) {
          // Returning User Update
          Object.assign(existing, update.$set || {});
          existing.updatedAt = new Date();
          return existing;
        }

        return null;
      },
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // 1. Google OAuth Flow Initiation (GET /api/auth/google)
  // ===========================================================================
  describe('Step 1: OAuth Initiation (/api/auth/google)', () => {
    it('redirects to Google OAuth with required scopes, client_id, and signed state', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/google?returnUrl=/opportunities/67119538991');
      const res = await initiateGoogleAuth(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toBeDefined();

      const targetUrl = new URL(location!);
      expect(targetUrl.origin).toBe('https://accounts.google.com');
      expect(targetUrl.pathname).toBe('/o/oauth2/v2/auth');
      expect(targetUrl.searchParams.get('client_id')).toBe('mock-google-client-id-12345.apps.googleusercontent.com');
      expect(targetUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/google');
      expect(targetUrl.searchParams.get('response_type')).toBe('code');
      expect(targetUrl.searchParams.get('scope')).toBe('openid email profile');
      expect(targetUrl.searchParams.get('access_type')).toBe('offline');
      expect(targetUrl.searchParams.get('prompt')).toBe('select_account');

      // State parameter verification
      const stateParam = targetUrl.searchParams.get('state');
      expect(stateParam).not.toBeNull();
      const verifiedState = verifyOAuthState(stateParam!);
      expect(verifiedState).not.toBeNull();
      expect(verifiedState?.returnUrl).toBe('/opportunities/67119538991');

      // OAuth State Cookie verification
      const stateCookie = res.cookies.get(OAUTH_STATE_COOKIE);
      expect(stateCookie).toBeDefined();
      expect(stateCookie?.httpOnly).toBe(true);
      expect(stateCookie?.sameSite).toBe('lax');
      const cookieData = JSON.parse(stateCookie!.value);
      expect(cookieData.state).toBe(stateParam);
      expect(cookieData.returnUrl).toBe('/opportunities/67119538991');
    });

    it('falls back to mock OAuth flow in non-production when credentials are missing or mock=true', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      const req = new NextRequest('http://localhost:3000/api/auth/google?returnUrl=/saved');
      const res = await initiateGoogleAuth(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/api/auth/callback/google?code=mock_dev_code');
      expect(location).toContain('mock=true');

      const stateCookie = res.cookies.get(OAUTH_STATE_COOKIE);
      expect(stateCookie).toBeDefined();
    });

    it('returns 500 error in production if Google credentials are missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const req = new NextRequest('http://localhost:3000/api/auth/google');
      const res = await initiateGoogleAuth(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toContain('credentials not configured');
    });
  });

  // ===========================================================================
  // 2. OAuth Callback & State / CSRF Validation (/api/auth/callback/google)
  // ===========================================================================
  describe('Step 2: OAuth State & Error Validation (/api/auth/callback/google)', () => {
    it('redirects to /login?error=invalid_state when state cookie and state token are missing or forged', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/callback/google?code=valid_code&state=tampered_state_token');
      const res = await handleGoogleCallback(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=invalid_state');
    });

    it('redirects to /login?error=access_denied when user cancels Google authorization prompt', async () => {
      const nonce = 'test_nonce_cancel';
      const signedState = signOAuthState(nonce, '/historical');

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?error=access_denied&state=${signedState}`,
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(
              JSON.stringify({ state: signedState, nonce, returnUrl: '/historical' }),
            )}`,
          },
        },
      );

      const res = await handleGoogleCallback(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=access_denied');
    });

    it('redirects to /login?error=missing_code when code parameter is missing', async () => {
      const nonce = 'test_nonce_no_code';
      const signedState = signOAuthState(nonce, '/historical');

      const req = new NextRequest(`http://localhost:3000/api/auth/callback/google?state=${signedState}`, {
        headers: {
          cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(
            JSON.stringify({ state: signedState, nonce, returnUrl: '/historical' }),
          )}`,
        },
      });

      const res = await handleGoogleCallback(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=missing_code');
    });

    it('redirects to /login?error=token_exchange_failed when Google rejects the authorization code', async () => {
      const nonce = 'test_nonce_token_fail';
      const signedState = signOAuthState(nonce, '/');

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(JSON.stringify({ error: 'invalid_grant' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not Found', { status: 404 });
      });

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=expired_or_invalid_code&state=${signedState}`,
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(
              JSON.stringify({ state: signedState, nonce, returnUrl: '/' }),
            )}`,
          },
        },
      );

      const res = await handleGoogleCallback(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=token_exchange_failed');
    });
  });

  // ===========================================================================
  // 3. New User Account Creation & Returning User Sign-in
  // ===========================================================================
  describe('Step 3: New User Auto-Creation vs. Returning User Sign-in', () => {
    it('automatically creates a new TORBIDD account with default BMA role when a new user signs in', async () => {
      const newGoogleUser = {
        sub: 'google_sub_new_user_1001',
        email: 'chavalit.bma@bangkok.go.th',
        name: 'Chavalit Wongsuwan',
        picture: 'https://lh3.googleusercontent.com/avatar_new.jpg',
      };

      // Ensure user does NOT exist prior to test
      expect(mockUserDatabase.has(newGoogleUser.sub)).toBe(false);

      // Mock Google Token & Userinfo endpoints
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'google_mock_access_token_new_user',
              expires_in: 3600,
              token_type: 'Bearer',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('googleapis.com/oauth2/v3/userinfo')) {
          return new Response(JSON.stringify(newGoogleUser), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not Found', { status: 404 });
      });

      const nonce = 'nonce_new_user';
      const signedState = signOAuthState(nonce, '/opportunities/67119538991');

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=valid_google_code_1&state=${signedState}`,
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(
              JSON.stringify({ state: signedState, nonce, returnUrl: '/opportunities/67119538991' }),
            )}`,
          },
        },
      );

      const res = await handleGoogleCallback(req);

      // 1. Should redirect to target returnUrl
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/opportunities/67119538991');

      // 2. Verified that a new account was created in TORBIDD DB
      expect(mockUserDatabase.has(newGoogleUser.sub)).toBe(true);
      const createdUser = mockUserDatabase.get(newGoogleUser.sub);
      expect(createdUser.email).toBe(newGoogleUser.email);
      expect(createdUser.name).toBe(newGoogleUser.name);
      expect(createdUser.picture).toBe(newGoogleUser.picture);
      expect(createdUser.role).toBe('BMA Officer'); // Default role
      expect(createdUser.org).toBe('กรุงเทพมหานคร'); // Default organization
      expect(createdUser.lastLoginAt).toBeInstanceOf(Date);
      expect(createdUser._id).toBeDefined();

      // 3. User received valid signed session cookie
      const authCookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(authCookie).toBeDefined();
      expect(authCookie?.httpOnly).toBe(true);
      expect(authCookie?.sameSite).toBe('lax');

      const payload = verifySession(authCookie!.value);
      expect(payload).not.toBeNull();
      expect(payload?.user.id).toBe(createdUser._id);
      expect(payload?.user.email).toBe(newGoogleUser.email);
      expect(payload?.user.role).toBe('BMA Officer');
      expect(payload?.user.org).toBe('กรุงเทพมหานคร');

      // 4. State cookie was cleared
      expect(res.cookies.get(OAUTH_STATE_COOKIE)?.value).toBe('');
    });

    it('automatically grants admin role to a new user if their email is in ADMIN_EMAILS', async () => {
      const adminGoogleUser = {
        sub: 'google_sub_admin_2002',
        email: 'admin.director@bangkok.go.th',
        name: 'Director Admin',
        picture: 'https://lh3.googleusercontent.com/director.jpg',
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(JSON.stringify({ access_token: 'token_admin' }), { status: 200 });
        }
        if (url.includes('googleapis.com/oauth2/v3/userinfo')) {
          return new Response(JSON.stringify(adminGoogleUser), { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      });

      const nonce = 'nonce_admin';
      const signedState = signOAuthState(nonce, '/admin');

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=admin_code&state=${signedState}`,
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(
              JSON.stringify({ state: signedState, nonce, returnUrl: '/admin' }),
            )}`,
          },
        },
      );

      const res = await handleGoogleCallback(req);
      expect(res.headers.get('location')).toBe('http://localhost:3000/admin');

      const createdAdmin = mockUserDatabase.get(adminGoogleUser.sub);
      expect(createdAdmin.role).toBe('admin');

      const authCookie = res.cookies.get(AUTH_COOKIE_NAME);
      const session = verifySession(authCookie!.value);
      expect(session?.user.role).toBe('admin');
      expect(isAdminUser(session?.user)).toBe(true);
    });

    it('signs in a returning user, updating lastLoginAt and preserving customized role & organization', async () => {
      // Pre-seed an existing user in TORBIDD with customized role and organization
      const existingDbRecord = {
        _id: 'existing_db_user_8888',
        googleId: 'google_sub_returning_3003',
        email: 'pranee.k@bangkok.go.th',
        name: 'Pranee Kittisak (Previous Name)',
        picture: 'https://lh3.googleusercontent.com/old_pic.jpg',
        role: 'Chief Procurement Specialist', // Customized non-default role
        org: 'สำนักการโยธา (Department of Public Works)', // Customized non-default org
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      };
      mockUserDatabase.set(existingDbRecord.googleId, { ...existingDbRecord });

      // Google returns updated profile information (e.g. updated display name & avatar)
      const updatedGoogleProfile = {
        sub: existingDbRecord.googleId,
        email: existingDbRecord.email,
        name: 'Pranee Kittisak (Updated Display Name)',
        picture: 'https://lh3.googleusercontent.com/new_highres_pic.jpg',
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(JSON.stringify({ access_token: 'token_returning' }), { status: 200 });
        }
        if (url.includes('googleapis.com/oauth2/v3/userinfo')) {
          return new Response(JSON.stringify(updatedGoogleProfile), { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      });

      const nonce = 'nonce_returning';
      const signedState = signOAuthState(nonce, '/historical');

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=returning_code&state=${signedState}`,
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(
              JSON.stringify({ state: signedState, nonce, returnUrl: '/historical' }),
            )}`,
          },
        },
      );

      const res = await handleGoogleCallback(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/historical');

      // Check database state for returning user
      const recordInDb = mockUserDatabase.get(existingDbRecord.googleId);
      expect(recordInDb._id).toBe(existingDbRecord._id); // Retains persistent ID
      expect(recordInDb.name).toBe(updatedGoogleProfile.name); // Updated from Google
      expect(recordInDb.picture).toBe(updatedGoogleProfile.picture); // Updated avatar
      expect(recordInDb.lastLoginAt.getTime()).toBeGreaterThan(existingDbRecord.lastLoginAt.getTime());

      // CRITICAL: Custom role and org must NOT be overwritten by defaults!
      expect(recordInDb.role).toBe('Chief Procurement Specialist');
      expect(recordInDb.org).toBe('สำนักการโยธา (Department of Public Works)');

      // Session verification
      const authCookie = res.cookies.get(AUTH_COOKIE_NAME);
      const session = verifySession(authCookie!.value);
      expect(session?.user.id).toBe(existingDbRecord._id);
      expect(session?.user.role).toBe('Chief Procurement Specialist');
      expect(session?.user.org).toBe('สำนักการโยธา (Department of Public Works)');
      expect(session?.user.name).toBe(updatedGoogleProfile.name);
    });

    it('works seamlessly in developer mock mode without external network requests', async () => {
      const nonce = 'mock_nonce_dev';
      const signedState = signOAuthState(nonce, '/saved');

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=mock_dev_code&state=${signedState}&mock=true`,
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(
              JSON.stringify({ state: signedState, nonce, returnUrl: '/saved' }),
            )}`,
          },
        },
      );

      const res = await handleGoogleCallback(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/saved');

      const authCookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(authCookie).toBeDefined();
      const session = verifySession(authCookie!.value);
      expect(session?.user.email).toBe('officer.bma@bangkok.go.th');
      expect(session?.user.role).toBe('BMA Procurement Officer');
    });
  });

  // ===========================================================================
  // 4. Session Verification & Profile API (/api/auth/me)
  // ===========================================================================
  describe('Step 4: Session Verification & Profile API (/api/auth/me)', () => {
    it('returns authenticated: false when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/me');
      const res = await getMe(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.authenticated).toBe(false);
      expect(json.user).toBeNull();
      expect(json.isAdmin).toBe(false);
    });

    it('returns authenticated: false for tampered session tokens', async () => {
      const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.tampered_payload.invalid_signature';
      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${fakeToken}` },
      });
      const res = await getMe(req);
      const json = await res.json();

      expect(json.authenticated).toBe(false);
      expect(json.user).toBeNull();
    });

    it('returns authenticated user profile and admin status for valid session', async () => {
      const testUser: AuthSessionUser = {
        id: 'usr_verified_777',
        email: 'officer@bangkok.go.th',
        name: 'Verified Officer',
        picture: 'https://example.com/pic.png',
        role: 'BMA Officer',
        org: 'สำนักยุทธศาสตร์และประเมินผล',
      };

      const token = signSession(testUser);
      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });

      const res = await getMe(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.authenticated).toBe(true);
      expect(json.user.id).toBe(testUser.id);
      expect(json.user.email).toBe(testUser.email);
      expect(json.user.name).toBe(testUser.name);
      expect(json.isAdmin).toBe(false);
    });

    it('allows an authenticated user to update their profile and updates DB and cookie', async () => {
      const existingUser: AuthSessionUser = {
        id: 'usr_update_555',
        email: 'editor@bangkok.go.th',
        name: 'Old Name',
        picture: 'https://example.com/old.png',
        role: 'BMA Officer',
        org: 'กรุงเทพมหานคร',
      };
      mockUserDatabase.set(existingUser.id, { googleId: existingUser.id, ...existingUser });

      const token = signSession(existingUser);
      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          name: 'New Officer Name',
          org: 'สำนักการระบายน้ำ',
          role: 'Data Analyst',
        }),
      });

      const res = await updateMe(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.name).toBe('New Officer Name');
      expect(json.user.org).toBe('สำนักการระบายน้ำ');
      expect(json.user.role).toBe('Data Analyst');

      // Updated session cookie set
      const newAuthCookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(newAuthCookie).toBeDefined();
      const updatedSession = verifySession(newAuthCookie!.value);
      expect(updatedSession?.user.name).toBe('New Officer Name');
    });

    it('prevents a non-admin user from escalating themselves to admin role', async () => {
      const regularUser: AuthSessionUser = {
        id: 'usr_non_admin_444',
        email: 'regular@bangkok.go.th',
        name: 'Regular User',
        picture: '',
        role: 'BMA Officer',
        org: 'กรุงเทพมหานคร',
      };

      const token = signSession(regularUser);
      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          role: 'admin', // Privilege escalation attempt
        }),
      });

      const res = await updateMe(req);
      const json = await res.json();
      expect(json.success).toBe(true);
      // Role remains unchanged because non-admin cannot self-promote to admin
      expect(json.user.role).toBe('BMA Officer');
    });
  });

  // ===========================================================================
  // 5. Logout & Session Termination (/api/auth/logout)
  // ===========================================================================
  describe('Step 5: Logout Flow (/api/auth/logout)', () => {
    it('clears the auth session cookie upon logout', async () => {
      const res = await handleLogout();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      const cookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe('');
      expect(cookie?.maxAge).toBe(0);
    });
  });

  // ===========================================================================
  // 6. Middleware Protection for Public, Protected, and Admin Routes
  // ===========================================================================
  describe('Step 6: Middleware Access Control', () => {
    it('permits unauthenticated requests to public routes and attaches anonymous session cookie', () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.cookies.get(SESSION_COOKIE)).toBeDefined();
    });

    it('redirects unauthenticated requests from protected routes to /login?from=<route>', () => {
      const req = new NextRequest('http://localhost:3000/saved');
      const res = middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fsaved');
    });

    it('allows access to protected routes when user has valid auth session cookie', () => {
      const regularUser: AuthSessionUser = {
        id: 'usr_valid_321',
        email: 'officer@bangkok.go.th',
        name: 'Somchai',
        picture: '',
        role: 'BMA Officer',
        org: 'กรุงเทพมหานคร',
      };
      const token = signSession(regularUser);

      const req = new NextRequest('http://localhost:3000/saved', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });

      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it('redirects non-admin authenticated users attempting to access /admin to /?auth_error=admin_required', () => {
      const regularUser: AuthSessionUser = {
        id: 'usr_regular_888',
        email: 'officer@bangkok.go.th',
        name: 'Regular Officer',
        picture: '',
        role: 'BMA Officer',
        org: 'กรุงเทพมหานคร',
      };
      const token = signSession(regularUser);

      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });

      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/?auth_error=admin_required');
    });

    it('allows admin users access to /admin', () => {
      const adminUser: AuthSessionUser = {
        id: 'usr_admin_999',
        email: 'admin.director@bangkok.go.th',
        name: 'System Admin',
        picture: '',
        role: 'admin',
        org: 'กรุงเทพมหานคร',
      };
      const token = signSession(adminUser);

      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });

      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it('returns 401 for unauthenticated calls to /api/admin/*', () => {
      const req = new NextRequest('http://localhost:3000/api/admin/stats');
      const res = middleware(req);

      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden for non-admin authenticated calls to /api/admin/*', () => {
      const regularUser: AuthSessionUser = {
        id: 'usr_reg_222',
        email: 'regular@bangkok.go.th',
        name: 'Regular',
        picture: '',
        role: 'BMA Officer',
        org: 'กรุงเทพมหานคร',
      };
      const token = signSession(regularUser);

      const req = new NextRequest('http://localhost:3000/api/admin/stats', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });

      const res = middleware(req);
      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 7. Full Chained End-to-End Authentication Lifecycle
  // ===========================================================================
  describe('Step 7: Full Chained End-to-End Scenario', () => {
    it('executes full sequence: protected route redirection -> Google login -> new user account creation -> authenticated API access -> returning user login -> logout', async () => {
      // 1. Unauthenticated user attempts to access /saved
      const visitProtectedReq = new NextRequest('http://localhost:3000/saved');
      const guardRes = middleware(visitProtectedReq);
      expect(guardRes.status).toBe(307);
      expect(guardRes.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fsaved');

      // 2. User initiates Google OAuth login with returnUrl=/saved
      const initReq = new NextRequest('http://localhost:3000/api/auth/google?returnUrl=/saved');
      const initRes = await initiateGoogleAuth(initReq);
      expect(initRes.status).toBe(307);

      const googleRedirect = new URL(initRes.headers.get('location')!);
      const state = googleRedirect.searchParams.get('state')!;
      const stateCookie = initRes.cookies.get(OAUTH_STATE_COOKIE)!.value;

      // 3. User authenticates with Google as a FIRST-TIME USER
      const newGoogleUser = {
        sub: 'google_lifecycle_user_777',
        email: 'lifecycle.tester@bangkok.go.th',
        name: 'Lifecycle Tester',
        picture: 'https://example.com/lifecycle.png',
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(JSON.stringify({ access_token: 'lifecycle_access_token' }), { status: 200 });
        }
        if (url.includes('googleapis.com/oauth2/v3/userinfo')) {
          return new Response(JSON.stringify(newGoogleUser), { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      });

      const callbackReq = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=lifecycle_code_1&state=${state}`,
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(stateCookie)}`,
          },
        },
      );

      const callbackRes = await handleGoogleCallback(callbackReq);

      // Verify callback completed and redirected to /saved
      expect(callbackRes.status).toBe(307);
      expect(callbackRes.headers.get('location')).toBe('http://localhost:3000/saved');

      // Verify TORBIDD account created in database
      expect(mockUserDatabase.has(newGoogleUser.sub)).toBe(true);
      const dbAccount = mockUserDatabase.get(newGoogleUser.sub);
      expect(dbAccount.role).toBe('BMA Officer');
      expect(dbAccount.org).toBe('กรุงเทพมหานคร');

      // 4. Client receives session cookie and accesses /api/auth/me
      const sessionCookie = callbackRes.cookies.get(AUTH_COOKIE_NAME)!.value;
      const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}` },
      });
      const meRes = await getMe(meReq);
      const meData = await meRes.json();
      expect(meData.authenticated).toBe(true);
      expect(meData.user.email).toBe(newGoogleUser.email);
      expect(meData.user.role).toBe('BMA Officer');

      // 5. Middleware now permits access to /saved
      const authorizedReq = new NextRequest('http://localhost:3000/saved', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}` },
      });
      const authorizedRes = middleware(authorizedReq);
      expect(authorizedRes.status).toBe(200);

      // 6. User updates their role to 'Senior Procurement Specialist'
      const updateReq = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}`,
        },
        body: JSON.stringify({
          role: 'Senior Procurement Specialist',
          org: 'สำนักการคลัง (Finance Department)',
        }),
      });
      const updateRes = await updateMe(updateReq);
      expect(updateRes.status).toBe(200);
      const updatedCookie = updateRes.cookies.get(AUTH_COOKIE_NAME)!.value;

      // 7. RETURNING USER FLOW: User logs in again via Google OAuth in a new session
      const returningInitReq = new NextRequest('http://localhost:3000/api/auth/google?returnUrl=/historical');
      const returningInitRes = await initiateGoogleAuth(returningInitReq);
      const returningState = new URL(returningInitRes.headers.get('location')!).searchParams.get('state')!;
      const returningStateCookie = returningInitRes.cookies.get(OAUTH_STATE_COOKIE)!.value;

      const returningCallbackReq = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=returning_flow_code&state=${returningState}`,
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(returningStateCookie)}`,
          },
        },
      );
      const returningCallbackRes = await handleGoogleCallback(returningCallbackReq);
      expect(returningCallbackRes.status).toBe(307);
      expect(returningCallbackRes.headers.get('location')).toBe('http://localhost:3000/historical');

      // Verify that returning user signed in with preserved custom role & org
      const returningSessionCookie = returningCallbackRes.cookies.get(AUTH_COOKIE_NAME)!.value;
      const returningSession = verifySession(returningSessionCookie);
      expect(returningSession?.user.role).toBe('Senior Procurement Specialist');
      expect(returningSession?.user.org).toBe('สำนักการคลัง (Finance Department)');

      // 8. User logs out
      const logoutRes = await handleLogout();
      expect(logoutRes.status).toBe(200);
      const clearedCookie = logoutRes.cookies.get(AUTH_COOKIE_NAME)!.value;

      // 9. Subsequent request with cleared cookie is rejected by middleware
      const loggedOutReq = new NextRequest('http://localhost:3000/saved', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${clearedCookie}` },
      });
      const postLogoutRes = middleware(loggedOutReq);
      expect(postLogoutRes.status).toBe(307);
      expect(postLogoutRes.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fsaved');
    });
  });
});

