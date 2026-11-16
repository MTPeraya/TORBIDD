// =============================================================================
// lib/__tests__/ssrf.test.ts - Unit Tests for Server-Side Request Forgery Defense
// ASVS V1.3.6: Server-side Request Forgery (SSRF) Protection
// =============================================================================

import {
  validateSafeUrl,
  assertSafeUrl,
  isPrivateOrReservedIp,
} from '../ssrf';
import { AiExtractSchema } from '../validation';

describe('ASVS V1.3.6: SSRF Protection', () => {
  describe('isPrivateOrReservedIp', () => {
    it('detects loopback addresses (127.0.0.1, 127.0.0.2, etc.)', () => {
      expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('127.0.1.1')).toBe(true);
    });

    it('detects cloud metadata IP (169.254.169.254)', () => {
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIp('169.254.1.1')).toBe(true);
    });

    it('detects RFC 1918 private IPv4 addresses (10.x, 172.16-31.x, 192.168.x)', () => {
      expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.31.255.255')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.0.254')).toBe(true);
    });

    it('detects IPv6 loopback and private/link-local ranges', () => {
      expect(isPrivateOrReservedIp('::1')).toBe(true);
      expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIp('fd12:3456:789a::1')).toBe(true);
    });

    it('allows public IP addresses', () => {
      expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    });
  });

  describe('validateSafeUrl', () => {
    it('allows trusted official government domains and cloud storage', () => {
      const allowedUrls = [
        'https://process5.gprocurement.go.th/egp-upload-service/v1/downloadFileTest',
        'https://www.gprocurement.go.th/announcement.pdf',
        'https://data.bangkok.go.th/dataset/tor-sample.pdf',
        'https://data.go.th/dataset/procurement.json',
        'https://storage.googleapis.com/bma-tor-bucket/spec.pdf',
      ];

      for (const url of allowedUrls) {
        const result = validateSafeUrl(url);
        expect(result.valid).toBe(true);
        expect(result.url).toBeInstanceOf(URL);
      }
    });

    it('blocks dangerous URL protocols (file:, gopher:, javascript:, data:)', () => {
      expect(validateSafeUrl('file:///etc/passwd').valid).toBe(false);
      expect(validateSafeUrl('gopher://127.0.0.1:70/').valid).toBe(false);
      expect(validateSafeUrl('javascript:alert(1)').valid).toBe(false);
      expect(validateSafeUrl('data:text/html,<script>').valid).toBe(false);
    });

    it('blocks internal ports (e.g. MongoDB 27017, Redis 6379, SSH 22)', () => {
      expect(validateSafeUrl('http://process5.gprocurement.go.th:27017/db').valid).toBe(false);
      expect(validateSafeUrl('http://www.gprocurement.go.th:6379/data').valid).toBe(false);
      expect(validateSafeUrl('http://www.gprocurement.go.th:22/ssh').valid).toBe(false);
    });

    it('blocks loopback and local hostnames', () => {
      expect(validateSafeUrl('http://localhost:3000/api/admin').valid).toBe(false);
      expect(validateSafeUrl('http://127.0.0.1:3000/secret').valid).toBe(false);
      expect(validateSafeUrl('http://server.local/internal').valid).toBe(false);
      expect(validateSafeUrl('http://db.internal/config').valid).toBe(false);
    });

    it('blocks AWS/GCP cloud metadata IP SSRF attempts', () => {
      expect(validateSafeUrl('http://169.254.169.254/computeMetadata/v1/').valid).toBe(false);
      expect(validateSafeUrl('http://169.254.169.254/latest/meta-data/').valid).toBe(false);
    });

    it('blocks arbitrary untrusted external domains (attacker servers)', () => {
      expect(validateSafeUrl('https://evil-hacker.com/malicious.pdf').valid).toBe(false);
      expect(validateSafeUrl('https://webhook.site/abc-123').valid).toBe(false);
    });

    it('blocks decimal-encoded IPv4 representations', () => {
      // 2130706433 is 127.0.0.1
      expect(validateSafeUrl('http://2130706433/').valid).toBe(false);
    });
  });

  describe('assertSafeUrl', () => {
    it('throws descriptive error on SSRF attempts', () => {
      expect(() => {
        assertSafeUrl('http://169.254.169.254/latest/meta-data/');
      }).toThrow(/SSRF Blocked/);
    });

    it('returns parsed URL on valid inputs', () => {
      const url = assertSafeUrl('https://www.gprocurement.go.th/docs/tor.pdf');
      expect(url.hostname).toBe('www.gprocurement.go.th');
    });
  });

  describe('AiExtractSchema Integration', () => {
    it('accepts valid government document URLs', () => {
      const valid = AiExtractSchema.safeParse({
        documentUrl: 'https://process5.gprocurement.go.th/upload/tor.pdf',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects SSRF attempts in documentUrl via Zod schema validation', () => {
      const invalid = AiExtractSchema.safeParse({
        documentUrl: 'http://169.254.169.254/metadata',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.flatten().fieldErrors.documentUrl?.[0]).toMatch(
          /SSRF/i,
        );
      }
    });

    it('rejects untrusted domains in documentUrl via Zod schema validation', () => {
      const invalid = AiExtractSchema.safeParse({
        documentUrl: 'https://attacker.com/evil.pdf',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.flatten().fieldErrors.documentUrl?.[0]).toMatch(
          /trusted domain allowlist/i,
        );
      }
    });
  });
});
