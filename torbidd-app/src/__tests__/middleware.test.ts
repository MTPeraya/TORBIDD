/**
 * @jest-environment node
 */
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

import { NextRequest } from 'next/server';
import { proxy as middleware } from '../proxy';

describe('Middleware Locale Routing and Route Protection', () => {
  it('rewrites /th/opportunities to /opportunities and sets torbidd_locale=th cookie', () => {
    const req = new NextRequest('http://localhost:3000/th/opportunities', {
      headers: { host: 'localhost:3000' },
    });

    const res = middleware(req);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/opportunities');
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('torbidd_locale=th');
  });

  it('sets cookies with __Host- prefix, Secure flag, Path=/, and no Domain (ASVS 3.3.1 & 3.3.3)', () => {
    const req = new NextRequest('http://localhost:3000/th/opportunities', {
      headers: { host: 'localhost:3000' },
    });

    const res = middleware(req);
    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain('__Host-torbidd_locale=th');
    expect(setCookie).toContain('__Host-torbidd_session=');
    expect(setCookie.toLowerCase()).toContain('secure');
    expect(setCookie.toLowerCase()).toContain('path=/');
    expect(setCookie.toLowerCase()).not.toContain('domain=');
  });

  it('rewrites /en/opportunities to /opportunities and sets torbidd_locale=en cookie', () => {
    const req = new NextRequest('http://localhost:3000/en/opportunities', {
      headers: { host: 'localhost:3000' },
    });

    const res = middleware(req);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/opportunities');
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('torbidd_locale=en');
  });

  it('redirects bare /opportunities to /th/opportunities when no locale cookie exists', () => {
    const req = new NextRequest('http://localhost:3000/opportunities', {
      headers: { host: 'localhost:3000' },
    });

    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/th/opportunities');
  });

  it('redirects bare /opportunities to /en/opportunities when torbidd_locale=en cookie is present', () => {
    const req = new NextRequest('http://localhost:3000/opportunities', {
      headers: {
        host: 'localhost:3000',
        cookie: 'torbidd_locale=en',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/en/opportunities');
  });

  it('redirects unauthenticated user visiting /th/historical to /th/login?from=/th/historical', () => {
    const req = new NextRequest('http://localhost:3000/th/historical', {
      headers: { host: 'localhost:3000' },
    });

    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/th/login?from=%2Fth%2Fhistorical',
    );
  });

  it('does not redirect API routes (/api/projects)', () => {
    const req = new NextRequest('http://localhost:3000/api/projects', {
      headers: { host: 'localhost:3000' },
    });

    const res = middleware(req);
    // Should proceed without redirecting (status 200, no location header)
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  describe('Protocol Security & HTTPS Enforcement (ASVS 4.1.2)', () => {
    it('permanently redirects cleartext HTTP API requests to HTTPS', () => {
      const req = new NextRequest('http://localhost:3000/api/projects', {
        headers: {
          host: 'localhost:3000',
          'x-forwarded-proto': 'http',
        },
      });

      const res = middleware(req);
      expect(res.status).toBe(308);
      expect(res.headers.get('location')).toBe('https://localhost:3000/api/projects');
      expect(res.headers.get('strict-transport-security')).toBe(
        'max-age=31536000; includeSubDomains; preload',
      );
    });

    it('transparently redirects cleartext HTTP requests on user-facing browser routes to HTTPS', () => {
      const req = new NextRequest('http://localhost:3000/opportunities', {
        headers: {
          host: 'localhost:3000',
          'x-forwarded-proto': 'http',
        },
      });

      const res = middleware(req);
      expect(res.status).toBe(308);
      expect(res.headers.get('location')).toBe('https://localhost:3000/opportunities');
    });

    it('allows HTTP only while running the local development server', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      try {
        const req = new NextRequest('http://192.168.1.50:3000/api/projects', {
          headers: {
            host: '192.168.1.50:3000',
            'x-forwarded-proto': 'http',
          },
        });

        const res = middleware(req);
        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('Intermediary Header Sanitization (ASVS 4.1.3)', () => {
    it('strips client-supplied internal intermediary headers in middleware', () => {
      const req = new NextRequest('http://localhost:3000/th/opportunities', {
        headers: {
          host: 'localhost:3000',
          'x-user-id': 'spoofed_admin',
          'x-user-role': 'admin',
        },
      });

      middleware(req);
      expect(req.headers.get('x-user-id')).toBeNull();
      expect(req.headers.get('x-user-role')).toBeNull();
    });
  });
});
