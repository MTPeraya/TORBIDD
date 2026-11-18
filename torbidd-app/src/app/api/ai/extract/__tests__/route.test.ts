/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { extractTorFromBase64 } from '@/services/ai/tor-extractor';
import { MAX_PDF_BASE64_LENGTH, PdfSecurityError } from '@/lib/secure-pdf';

jest.mock('@/services/ai/tor-extractor', () => ({
  extractTorFromBase64: jest.fn(),
  extractTorFromUrl: jest.fn(),
}));

const mockExtractBase64 = extractTorFromBase64 as jest.MockedFunction<typeof extractTorFromBase64>;

function request(body: unknown, ip: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/ai/extract', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai/extract merged security controls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('includes rate-limit headers on validation errors', async () => {
    const response = await POST(request({}, '203.0.113.11'));

    expect(response.status).toBe(400);
    expect(response.headers.get('x-ratelimit-limit')).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request body' });
  });

  it('rejects declared payloads over the SEC-17 limit with rate-limit headers', async () => {
    const response = await POST(
      request({}, '203.0.113.12', {
        'content-length': String(MAX_PDF_BASE64_LENGTH + 4097),
      }),
    );

    expect(response.status).toBe(413);
    expect(response.headers.get('x-ratelimit-limit')).toBeTruthy();
  });

  it('preserves typed PDF security errors and rate-limit headers', async () => {
    mockExtractBase64.mockRejectedValueOnce(
      new PdfSecurityError('PDF magic bytes are invalid', 'INVALID_MAGIC'),
    );

    const response = await POST(
      request({ documentBase64: 'JVBERi0xLjQ=' }, '203.0.113.13'),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-ratelimit-limit')).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ error: 'PDF magic bytes are invalid' });
  });
});

