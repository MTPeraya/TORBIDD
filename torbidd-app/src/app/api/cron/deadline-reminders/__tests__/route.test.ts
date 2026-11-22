/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

jest.mock('@/services/notifications/deadline-scanner', () => ({
  scanAndSendDeadlineReminders: jest.fn().mockResolvedValue({
    qualifyingProjects: 2,
    emailsDispatched: 2,
  }),
}));

describe('GET /api/cron/deadline-reminders - Fail-Secure & Rate Limiting (T-03)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('1. fail-secure: returns HTTP 503 in production if CRON_SECRET is not configured', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.CRON_SECRET;

    const req = new NextRequest('http://localhost:3000/api/cron/deadline-reminders');
    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('Service Unavailable: Cron secret not configured');
  });

  it('2. returns HTTP 401 when CRON_SECRET is configured but Bearer token is missing or invalid', async () => {
    process.env.CRON_SECRET = 'valid-super-secure-token-12345';

    const reqWithoutAuth = new NextRequest('http://localhost:3000/api/cron/deadline-reminders');
    const resWithout = await GET(reqWithoutAuth);
    expect(resWithout.status).toBe(401);

    const reqWithBadAuth = new NextRequest('http://localhost:3000/api/cron/deadline-reminders', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const resBad = await GET(reqWithBadAuth);
    expect(resBad.status).toBe(401);
  });

  it('3. returns HTTP 200 when valid Bearer token matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'valid-super-secure-token-12345';

    const req = new NextRequest('http://localhost:3000/api/cron/deadline-reminders', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-super-secure-token-12345' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
