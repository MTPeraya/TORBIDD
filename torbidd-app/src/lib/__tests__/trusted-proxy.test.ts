/**
 * @jest-environment node
 */
import {
  isValidIp,
  getTrustedClientIp,
  sanitizeIntermediaryHeaders,
  SENSITIVE_INTERMEDIARY_HEADERS,
} from '../trusted-proxy';

describe('Intermediary Header Security (ASVS 4.1.3)', () => {
  describe('isValidIp', () => {
    it('validates standard IPv4 addresses', () => {
      expect(isValidIp('192.168.1.1')).toBe(true);
      expect(isValidIp('8.8.8.8')).toBe(true);
      expect(isValidIp('203.0.113.195')).toBe(true);
    });

    it('validates standard IPv6 addresses', () => {
      expect(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect(isValidIp('::1')).toBe(true);
      expect(isValidIp('fe80::1')).toBe(true);
    });

    it('rejects invalid or malformed IP strings', () => {
      expect(isValidIp('')).toBe(false);
      expect(isValidIp('999.999.999.999')).toBe(false);
      expect(isValidIp('not-an-ip')).toBe(false);
      expect(isValidIp('1.2.3.4<script>')).toBe(false);
      expect(isValidIp('1.2.3.4/24')).toBe(false);
    });
  });

  describe('getTrustedClientIp (Anti-Spoofing Defense)', () => {
    it('prioritizes CF-Connecting-IP if valid', () => {
      const req = {
        headers: new Headers({
          'cf-connecting-ip': '198.51.100.42',
          'x-forwarded-for': '1.1.1.1, 2.2.2.2',
        }),
      };
      expect(getTrustedClientIp(req)).toBe('198.51.100.42');
    });

    it('uses X-Real-IP if valid and CF-Connecting-IP is absent', () => {
      const req = {
        headers: new Headers({
          'x-real-ip': '198.51.100.99',
          'x-forwarded-for': '1.1.1.1',
        }),
      };
      expect(getTrustedClientIp(req)).toBe('198.51.100.99');
    });

    it('prevents attacker spoofing of X-Forwarded-For leftmost IP', () => {
      // Attacker injects: X-Forwarded-For: 1.1.1.1 (spoofed)
      // Reverse proxy appends the real TCP source: 203.0.113.50
      // Header received: '1.1.1.1, 203.0.113.50'
      const req = {
        headers: new Headers({
          'x-forwarded-for': '1.1.1.1, 203.0.113.50',
        }),
      };

      // The trusted implementation must extract the verified rightmost proxy hop, NOT the spoofed 1.1.1.1
      expect(getTrustedClientIp(req)).toBe('203.0.113.50');
    });

    it('ignores invalid IPs injected into X-Forwarded-For', () => {
      const req = {
        headers: new Headers({
          'x-forwarded-for': 'fake_ip, 10.0.0.1, <evil>',
        }),
      };
      expect(getTrustedClientIp(req)).toBe('10.0.0.1');
    });

    it('returns unknown if no valid IP headers are present', () => {
      const req = {
        headers: new Headers({}),
      };
      expect(getTrustedClientIp(req)).toBe('unknown');
    });
  });

  describe('sanitizeIntermediaryHeaders', () => {
    it('strips all sensitive internal intermediary headers sent by clients', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'x-user-id': 'spoofed_admin_id',
        'x-user-role': 'admin',
        'x-user-email': 'admin@example.com',
        'x-authenticated-user': 'true',
        'x-torbidd-admin': 'true',
        'x-torbidd-internal': 'secret',
      });

      sanitizeIntermediaryHeaders(headers);

      for (const h of SENSITIVE_INTERMEDIARY_HEADERS) {
        expect(headers.get(h)).toBeNull();
      }
      expect(headers.get('content-type')).toBe('application/json');
    });
  });
});
