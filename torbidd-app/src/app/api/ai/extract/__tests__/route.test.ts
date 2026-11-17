/**
 * @jest-environment node
 */
// =============================================================================
// app/api/ai/extract/__tests__/route.test.ts
// Unit tests for /api/ai/extract route handler (ASVS 2.4.1 Anti-Automation)
// =============================================================================

import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/rate-limiter', () => {
  const actual = jest.requireActual('@/lib/rate-limiter');
  return {
    ...actual,
    checkRateLimit: jest.fn((...args) => actual.checkRateLimit(...args)),
  };
});

jest.mock('@/services/ai/tor-extractor', () => ({
  extractTorFromUrl: jest.fn().mockResolvedValue({
    projectName: 'Mock TOR Project',
    budget: 1000000,
  }),
  extractTorFromBase64: jest.fn().mockResolvedValue({
    projectName: 'Mock Base64 TOR',
    budget: 500000,
  }),
}));

describe('/api/ai/extract Route Handler', () => {
  it('returns 400 when documentUrl and documentBase64 are missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid request body');
  });

  it('extracts TOR successfully from valid documentUrl and returns rate-limit headers (ASVS 2.4.1)', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentUrl: 'https://process5.gprocurement.go.th/tor.pdf',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-ratelimit-limit')).toBeDefined();
    expect(response.headers.get('x-ratelimit-remaining')).toBeDefined();

    const json = await response.json();
    expect(json.data.projectName).toBe('Mock TOR Project');
  });

  it('rejects with 429 when anti-automation rate limit is exceeded (ASVS 2.4.1)', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limiter');
    (checkRateLimit as jest.Mock).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      retryAfter: 60,
    });

    const req = new NextRequest('http://localhost:3000/api/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentUrl: 'https://process5.gprocurement.go.th/tor.pdf',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');

    const json = await response.json();
    expect(json.error).toContain('Too many extraction requests');
  });
});
