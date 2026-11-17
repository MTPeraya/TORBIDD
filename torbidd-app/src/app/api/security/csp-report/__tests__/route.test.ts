/**
 * @jest-environment node
 */
// =============================================================================
// Tests for POST /api/security/csp-report
// ASVS req_id 3.4.7 — CSP Violation Report Endpoint
// =============================================================================

import { NextRequest } from 'next/server';
import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
  body: unknown,
  contentType: string,
  headers: Record<string, string> = {},
): NextRequest {
  const bodyStr = JSON.stringify(body);
  return new NextRequest('http://localhost/api/security/csp-report', {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'content-length': String(Buffer.byteLength(bodyStr)),
      'x-forwarded-for': '1.2.3.4',
      ...headers,
    },
    body: bodyStr,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/security/csp-report (ASVS 3.4.7)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Reporting API v1 format (application/reports+json)', () => {
    it('should accept a valid CSP violation report array and return 204', async () => {
      const payload: unknown[] = [
        {
          type: 'csp-violation',
          url: 'https://example.com/page',
          age: 0,
          body: {
            'blocked-uri': 'https://evil.example.com/script.js',
            'document-uri': 'https://example.com/page',
            'violated-directive': 'script-src',
            'effective-directive': 'script-src',
            'disposition': 'enforce',
          },
        },
      ];

      const req = makeRequest(payload, 'application/reports+json');
      const res = await POST(req);

      expect(res.status).toBe(204);
    });

    it('should log violation details server-side', async () => {
      const payload = [
        {
          type: 'csp-violation',
          url: 'https://example.com/',
          body: {
            'blocked-uri': 'https://attacker.example/x.js',
            'violated-directive': 'script-src',
          },
        },
      ];

      const req = makeRequest(payload, 'application/reports+json');
      await POST(req);

      expect(console.warn).toHaveBeenCalledWith(
        '[CSP] Violation report (v1):',
        expect.objectContaining({ blockedUri: 'https://attacker.example/x.js' }),
      );
    });

    it('should silently ignore non-csp-violation report types in the array', async () => {
      const payload = [{ type: 'deprecation', url: 'https://example.com/', body: {} }];
      const req = makeRequest(payload, 'application/reports+json');
      const res = await POST(req);

      expect(res.status).toBe(204);
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('Legacy report-uri format (application/csp-report)', () => {
    it('should accept a legacy CSP violation report and return 204', async () => {
      const payload = {
        'csp-report': {
          'blocked-uri': 'inline',
          'document-uri': 'https://example.com/',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
        },
      };

      const req = makeRequest(payload, 'application/csp-report');
      const res = await POST(req);

      expect(res.status).toBe(204);
    });

    it('should log legacy violation report fields', async () => {
      const payload = {
        'csp-report': {
          'blocked-uri': 'eval',
          'document-uri': 'https://example.com/page',
          'violated-directive': 'script-src',
        },
      };

      const req = makeRequest(payload, 'application/csp-report');
      await POST(req);

      expect(console.warn).toHaveBeenCalledWith(
        '[CSP] Violation report (legacy):',
        expect.objectContaining({ blockedUri: 'eval' }),
      );
    });
  });

  describe('Security hardening', () => {
    it('should reject payloads larger than 64 KB with 413', async () => {
      const largeBody = JSON.stringify([{ type: 'csp-violation', body: { data: 'x'.repeat(70_000) } }]);
      const req = new NextRequest('http://localhost/api/security/csp-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/reports+json',
          'content-length': String(largeBody.length),
          'x-forwarded-for': '9.9.9.9',
        },
        body: largeBody,
      });

      const res = await POST(req);
      expect(res.status).toBe(413);
    });

    it('should return 204 without echoing any body', async () => {
      const req = makeRequest(
        [{ type: 'csp-violation', body: { 'blocked-uri': 'https://evil.com/x.js' } }],
        'application/reports+json',
      );
      const res = await POST(req);

      expect(res.status).toBe(204);
      const text = await res.text();
      expect(text).toBe('');
    });

    it('should return 204 for malformed JSON without throwing', async () => {
      const req = new NextRequest('http://localhost/api/security/csp-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/csp-report',
          'content-length': '10',
          'x-forwarded-for': '1.1.1.1',
        },
        body: 'NOT_JSON!!',
      });

      const res = await POST(req);
      expect(res.status).toBe(204);
    });

    it('should return 204 for unknown content types without crashing', async () => {
      const req = makeRequest({ data: 'unknown' }, 'text/plain');
      const res = await POST(req);
      expect(res.status).toBe(204);
    });

    it('should not echo any user-supplied data in the response body', async () => {
      const maliciousPayload = [
        {
          type: 'csp-violation',
          body: { 'blocked-uri': '<script>alert(1)</script>' },
        },
      ];

      const req = makeRequest(maliciousPayload, 'application/reports+json');
      const res = await POST(req);
      const responseText = await res.text();

      expect(responseText).not.toContain('<script>');
      expect(responseText).toBe('');
    });
  });
});
