/**
 * @jest-environment node
 */
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

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
});
