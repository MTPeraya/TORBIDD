/**
 * @jest-environment node
 *
 * E2E: Auth Gating — Middleware Redirect Tests
 * Tests that the Next.js middleware correctly allows or blocks routes based on
 * authentication state. Runs in Node environment (requires Request global).
 */

import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { AUTH_COOKIE_NAME, signSession, AuthSessionUser } from '@/lib/auth';

// uuid is required by middleware; mock it so ESM import doesn't fail
jest.mock('uuid', () => ({
  v4: () => 'mock-session-uuid-123',
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function req(path: string, cookies: Record<string, string> = {}): NextRequest {
  const url = `http://localhost:3000${path}`;
  const r = new NextRequest(url);
  for (const [name, value] of Object.entries(cookies)) {
    r.cookies.set(name, value);
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Public Routes — no redirect for unauthenticated visitors
// ─────────────────────────────────────────────────────────────────────────────
describe('1. Public Feature Access (Unauthenticated) — Middleware', () => {
  it('1.1 allows unauthenticated access to / (home dashboard)', () => {
    const res = middleware(req('/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('1.2 allows unauthenticated access to /opportunities (search listings)', () => {
    const res = middleware(req('/opportunities'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('1.3 allows unauthenticated access to /opportunities/:id (listing detail)', () => {
    const res = middleware(req('/opportunities/67119538991'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Protected Routes — redirect to /login with `from` param
// ─────────────────────────────────────────────────────────────────────────────
describe('2. Protected Route Redirects', () => {
  it('2.1 redirects /saved to /login?from=%2Fsaved for unauthenticated visitor', () => {
    const res = middleware(req('/saved'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fsaved');
  });

  it('2.2 redirects /historical to /login?from=%2Fhistorical for unauthenticated visitor', () => {
    const res = middleware(req('/historical'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fhistorical');
  });

  it('2.3 redirects /notifications to /login?from=%2Fnotifications for unauthenticated visitor', () => {
    const res = middleware(req('/notifications'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fnotifications');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Admin API Protection
// ─────────────────────────────────────────────────────────────────────────────
describe('3. Admin API Protection', () => {
  it('3.1 returns 401 Unauthorized for /api/admin/* requests without auth cookie', () => {
    const res = middleware(req('/api/admin/stats'));
    expect(res.status).toBe(401);
  });

  it('3.2 returns 403 Forbidden for /api/admin/* with a non-admin auth cookie', () => {
    const regularUser: AuthSessionUser = {
      id: 'usr_reg_111',
      email: 'user@example.com',
      name: 'Regular User',
      picture: '',
      role: 'user',
      org: 'กรุงเทพมหานคร',
    };
    const token = signSession(regularUser);

    const res = middleware(req('/api/admin/stats', { [AUTH_COOKIE_NAME]: token }));
    expect(res.status).toBe(403);
  });
});

