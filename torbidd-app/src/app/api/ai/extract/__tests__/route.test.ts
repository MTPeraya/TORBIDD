/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { AUTH_COOKIE_NAME, signSession, AuthSessionUser } from '@/lib/auth';

jest.mock('@/services/ai/tor-extractor', () => ({
  extractTorFromUrl: jest.fn().mockResolvedValue({ title: 'Mock Result' }),
  extractTorFromBase64: jest.fn().mockResolvedValue({ title: 'Mock Result' }),
}));

describe('POST /api/ai/extract - Authentication & Abuse Defense (T-01, T-14)', () => {
  const testUser: AuthSessionUser = {
    id: 'user_123',
    email: 'user@example.com',
    role: 'officer',
    name: 'Test Officer',
    picture: 'https://example.com/pic.jpg',
    org: 'BMA',
  };

  it('1. rejects unauthenticated requests with HTTP 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/extract', {
      method: 'POST',
      body: JSON.stringify({ documentUrl: 'https://data.go.th/sample.pdf' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('2. accepts authenticated requests and proceeds with extraction', async () => {
    const token = signSession(testUser);
    const req = new NextRequest('http://localhost:3000/api/ai/extract', {
      method: 'POST',
      body: JSON.stringify({ documentUrl: 'https://data.go.th/sample.pdf' }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });
});
