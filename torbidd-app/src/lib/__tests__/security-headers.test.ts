import {
  SECURITY_HEADERS,
  HSTS_HEADER_VALUE,
  CSP_HEADER_VALUE,
  CSP_DIRECTIVES,
  buildCspHeader,
  applySecurityHeaders,
} from '../security-headers';
import nextConfig from '../../../next.config';

describe('Security Headers (ASVS 3.4.1 & 3.4.3)', () => {
  describe('req_id 3.4.1 - Strict-Transport-Security (HSTS)', () => {
    it('should include Strict-Transport-Security with max-age >= 31536000, includeSubDomains, and preload', () => {
      const hstsHeader = SECURITY_HEADERS.find(
        (h) => h.key.toLowerCase() === 'strict-transport-security'
      );
      expect(hstsHeader).toBeDefined();
      expect(hstsHeader?.value).toBe(HSTS_HEADER_VALUE);

      // Verify max-age >= 31536000 (1 year)
      const maxAgeMatch = hstsHeader?.value.match(/max-age=(\d+)/);
      expect(maxAgeMatch).not.toBeNull();
      const maxAge = parseInt(maxAgeMatch![1], 10);
      expect(maxAge).toBeGreaterThanOrEqual(31536000);

      // Verify includeSubDomains and preload
      expect(hstsHeader?.value).toContain('includeSubDomains');
      expect(hstsHeader?.value).toContain('preload');
    });
  });

  describe('req_id 3.4.3 - Content-Security-Policy (CSP)', () => {
    it('should include Content-Security-Policy header in SECURITY_HEADERS', () => {
      const cspHeader = SECURITY_HEADERS.find(
        (h) => h.key.toLowerCase() === 'content-security-policy'
      );
      expect(cspHeader).toBeDefined();
      expect(cspHeader?.value).toBe(CSP_HEADER_VALUE);
    });

    it('should strictly forbid plugins with object-src none', () => {
      expect(CSP_DIRECTIVES['object-src']).toEqual(["'none'"]);
      expect(CSP_HEADER_VALUE).toContain("object-src 'none'");
    });

    it('should prevent base tag hijacking with base-uri none', () => {
      expect(CSP_DIRECTIVES['base-uri']).toEqual(["'none'"]);
      expect(CSP_HEADER_VALUE).toContain("base-uri 'none'");
    });

    it('should prevent clickjacking with frame-ancestors none', () => {
      expect(CSP_DIRECTIVES['frame-ancestors']).toEqual(["'none'"]);
      expect(CSP_HEADER_VALUE).toContain("frame-ancestors 'none'");
    });

    it('should restrict scripts, styles, fonts, images, and API connections to allowlisted domains', () => {
      // Scripts restricted to self and hydration requirements
      expect(CSP_DIRECTIVES['script-src']).toContain("'self'");

      // Styles & Fonts
      expect(CSP_DIRECTIVES['style-src']).toContain('https://fonts.googleapis.com');
      expect(CSP_DIRECTIVES['font-src']).toContain('https://fonts.gstatic.com');

      // Images (Google OAuth profile pictures)
      expect(CSP_DIRECTIVES['img-src']).toContain('https://lh3.googleusercontent.com');

      // Connect sources (Google OAuth + Gemini API)
      expect(CSP_DIRECTIVES['connect-src']).toContain('https://accounts.google.com');
      expect(CSP_DIRECTIVES['connect-src']).toContain('https://oauth2.googleapis.com');
      expect(CSP_DIRECTIVES['connect-src']).toContain('https://generativelanguage.googleapis.com');
    });

    it('should build CSP header correctly from custom directives', () => {
      const custom = buildCspHeader({
        'default-src': ["'self'"],
        'object-src': ["'none'"],
      });
      expect(custom).toBe("default-src 'self'; object-src 'none'");
    });
  });

  describe('Companion Security Headers (Defense in Depth)', () => {
    it('should include X-Content-Type-Options: nosniff', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'X-Content-Type-Options');
      expect(header?.value).toBe('nosniff');
    });

    it('should include X-Frame-Options: DENY', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'X-Frame-Options');
      expect(header?.value).toBe('DENY');
    });

    it('should include Referrer-Policy: strict-origin-when-cross-origin', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Referrer-Policy');
      expect(header?.value).toBe('strict-origin-when-cross-origin');
    });

    it('should include Permissions-Policy restricting sensitive devices', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Permissions-Policy');
      expect(header?.value).toBe('camera=(), microphone=(), geolocation=()');
    });
  });

  describe('applySecurityHeaders helper', () => {
    it('should set all security headers on a response object', () => {
      const mockHeaders = new Map<string, string>();
      const mockResponse = {
        headers: {
          set: (key: string, value: string) => {
            mockHeaders.set(key, value);
          },
          get: (key: string) => mockHeaders.get(key),
        } as unknown as Headers,
      };

      applySecurityHeaders(mockResponse);

      for (const { key, value } of SECURITY_HEADERS) {
        expect(mockHeaders.get(key)).toBe(value);
      }
    });
  });

  describe('Next.js nextConfig integration', () => {
    it('should configure security headers for all routes in next.config.ts', async () => {
      expect(typeof nextConfig.headers).toBe('function');
      const configuredHeaders = await nextConfig.headers!();

      expect(configuredHeaders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: '/:path*',
            headers: SECURITY_HEADERS,
          }),
        ])
      );
    });
  });
});
