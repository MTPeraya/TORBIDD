import {
  SECURITY_HEADERS,
  HSTS_HEADER_VALUE,
  CSP_HEADER_VALUE,
  CSP_DIRECTIVES,
  CSP_REPORT_PATH,
  CSP_REPORT_GROUP,
  buildCspHeader,
  applySecurityHeaders,
} from '../security-headers';
import nextConfig from '../../../next.config';

describe('Security Headers (ASVS 3.4.1, 3.4.3, 3.4.4, 3.4.5, 3.4.6, 3.4.7, 3.4.8, 3.5.8)', () => {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // ASVS req_id 3.4.4 — X-Content-Type-Options
  // Verify that all HTTP responses contain X-Content-Type-Options: nosniff so
  // the browser cannot MIME-sniff a response away from the declared Content-Type.
  // ─────────────────────────────────────────────────────────────────────────────
  describe('req_id 3.4.4 - X-Content-Type-Options', () => {
    it('should include X-Content-Type-Options header in SECURITY_HEADERS', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'X-Content-Type-Options');
      expect(header).toBeDefined();
    });

    it('should set X-Content-Type-Options to nosniff', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'X-Content-Type-Options');
      expect(header?.value).toBe('nosniff');
    });

    it('should apply X-Content-Type-Options: nosniff via applySecurityHeaders helper', () => {
      const mockHeaders = new Map<string, string>();
      const mockResponse = {
        headers: {
          set: (key: string, value: string) => { mockHeaders.set(key, value); },
          get: (key: string) => mockHeaders.get(key),
        } as unknown as Headers,
      };

      applySecurityHeaders(mockResponse);

      expect(mockHeaders.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should include X-Content-Type-Options in next.config.ts headers for all routes', async () => {
      const configuredHeaders = await nextConfig.headers!();
      const routeHeaders = configuredHeaders.find((r) => r.source === '/:path*')?.headers ?? [];
      const header = routeHeaders.find((h) => h.key === 'X-Content-Type-Options');
      expect(header?.value).toBe('nosniff');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASVS req_id 3.4.5 — Referrer-Policy
  // Verify that the application sets a Referrer-Policy header to prevent leaking
  // sensitive URL paths and query parameters to third-party services.
  // ─────────────────────────────────────────────────────────────────────────────
  describe('req_id 3.4.5 - Referrer-Policy', () => {
    // Allowlisted values per MDN / ASVS guidance that do not leak full URLs to cross-origin
    const SAFE_REFERRER_POLICIES = new Set([
      'no-referrer',
      'no-referrer-when-downgrade',
      'same-origin',
      'origin',
      'strict-origin',
      'origin-when-cross-origin',
      'strict-origin-when-cross-origin',
    ]);

    it('should include Referrer-Policy header in SECURITY_HEADERS', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Referrer-Policy');
      expect(header).toBeDefined();
    });

    it('should use a privacy-preserving Referrer-Policy that does not expose full URLs to third parties', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Referrer-Policy');
      expect(header?.value).toBeTruthy();
      // The policy must be a known safe value (not 'unsafe-url' which leaks full URLs)
      expect(SAFE_REFERRER_POLICIES.has(header!.value)).toBe(true);
      expect(header?.value).not.toBe('unsafe-url');
    });

    it('should use strict-origin-when-cross-origin as the configured policy', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Referrer-Policy');
      // strict-origin-when-cross-origin: sends full Referer on same-origin, only
      // the origin (no path/query) on cross-origin HTTPS, and nothing on HTTP.
      expect(header?.value).toBe('strict-origin-when-cross-origin');
    });

    it('should apply Referrer-Policy via applySecurityHeaders helper', () => {
      const mockHeaders = new Map<string, string>();
      const mockResponse = {
        headers: {
          set: (key: string, value: string) => { mockHeaders.set(key, value); },
          get: (key: string) => mockHeaders.get(key),
        } as unknown as Headers,
      };

      applySecurityHeaders(mockResponse);

      expect(mockHeaders.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should include Referrer-Policy in next.config.ts headers for all routes', async () => {
      const configuredHeaders = await nextConfig.headers!();
      const routeHeaders = configuredHeaders.find((r) => r.source === '/:path*')?.headers ?? [];
      const header = routeHeaders.find((h) => h.key === 'Referrer-Policy');
      expect(header?.value).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Defense-in-Depth Companion Headers', () => {
    it('should include X-Frame-Options: DENY', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'X-Frame-Options');
      expect(header?.value).toBe('DENY');
    });

    it('should include Permissions-Policy restricting sensitive devices', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Permissions-Policy');
      expect(header?.value).toBe('camera=(), microphone=(), geolocation=()');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASVS req_id 3.4.6 — CSP frame-ancestors directive
  // Verify that the CSP header always carries a frame-ancestors directive so the
  // application cannot be embedded in a foreign frame (clickjacking / UI-redress).
  // ─────────────────────────────────────────────────────────────────────────────
  describe('req_id 3.4.6 - CSP frame-ancestors (clickjacking prevention)', () => {
    it('should include frame-ancestors directive in CSP_DIRECTIVES', () => {
      expect(CSP_DIRECTIVES['frame-ancestors']).toBeDefined();
    });

    it('should deny all framing with frame-ancestors none', () => {
      expect(CSP_DIRECTIVES['frame-ancestors']).toEqual(["'none'"]);
    });

    it('should include frame-ancestors none in the built CSP header string', () => {
      expect(CSP_HEADER_VALUE).toContain("frame-ancestors 'none'");
    });

    it('should carry frame-ancestors in the Content-Security-Policy header in SECURITY_HEADERS', () => {
      const cspHeader = SECURITY_HEADERS.find((h) => h.key === 'Content-Security-Policy');
      expect(cspHeader?.value).toContain("frame-ancestors 'none'");
    });

    it('should include frame-ancestors in next.config.ts headers for all routes', async () => {
      const configuredHeaders = await nextConfig.headers!();
      const routeHeaders = configuredHeaders.find((r) => r.source === '/:path*')?.headers ?? [];
      const cspHeader = routeHeaders.find((h) => h.key === 'Content-Security-Policy');
      expect(cspHeader?.value).toContain("frame-ancestors 'none'");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASVS req_id 3.4.7 — CSP violation reporting endpoint
  // Verify that the CSP header specifies a report-to directive pointing at a
  // named Reporting-Endpoints group, and that a Reporting-Endpoints header is
  // present declaring the actual collector URL.
  // ─────────────────────────────────────────────────────────────────────────────
  describe('req_id 3.4.7 - CSP violation reporting (report-to + Reporting-Endpoints)', () => {
    it('should include report-to directive in CSP_DIRECTIVES', () => {
      expect(CSP_DIRECTIVES['report-to']).toBeDefined();
      expect(CSP_DIRECTIVES['report-to']).toContain(CSP_REPORT_GROUP);
    });

    it('should include legacy report-uri directive in CSP_DIRECTIVES for older browsers', () => {
      expect(CSP_DIRECTIVES['report-uri']).toBeDefined();
      expect(CSP_DIRECTIVES['report-uri']).toContain(CSP_REPORT_PATH);
    });

    it('should include report-to in the built CSP header string', () => {
      expect(CSP_HEADER_VALUE).toContain(`report-to ${CSP_REPORT_GROUP}`);
    });

    it('should include report-uri in the built CSP header string', () => {
      expect(CSP_HEADER_VALUE).toContain(`report-uri ${CSP_REPORT_PATH}`);
    });

    it('should include a Reporting-Endpoints header in SECURITY_HEADERS', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Reporting-Endpoints');
      expect(header).toBeDefined();
    });

    it('should declare the correct group name and collector URL in Reporting-Endpoints', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Reporting-Endpoints');
      expect(header?.value).toContain(CSP_REPORT_GROUP);
      expect(header?.value).toContain(CSP_REPORT_PATH);
      expect(header?.value).toBe(`${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`);
    });

    it('should include Reporting-Endpoints in next.config.ts headers for all routes', async () => {
      const configuredHeaders = await nextConfig.headers!();
      const routeHeaders = configuredHeaders.find((r) => r.source === '/:path*')?.headers ?? [];
      const header = routeHeaders.find((h) => h.key === 'Reporting-Endpoints');
      expect(header?.value).toContain(CSP_REPORT_PATH);
    });

    it('CSP_REPORT_PATH should point to the actual collector API route', () => {
      expect(CSP_REPORT_PATH).toBe('/api/security/csp-report');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASVS req_id 3.4.8 — Cross-Origin-Opener-Policy (COOP)
  // Verify that HTTP responses include Cross-Origin-Opener-Policy: same-origin
  // to isolate browsing context groups and mitigate tabnabbing / Spectre side-channels.
  // ─────────────────────────────────────────────────────────────────────────────
  describe('req_id 3.4.8 - Cross-Origin-Opener-Policy (COOP)', () => {
    it('should include Cross-Origin-Opener-Policy in SECURITY_HEADERS', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Cross-Origin-Opener-Policy');
      expect(header).toBeDefined();
    });

    it('should set Cross-Origin-Opener-Policy to same-origin', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Cross-Origin-Opener-Policy');
      expect(header?.value).toBe('same-origin');
    });

    it('should apply Cross-Origin-Opener-Policy via applySecurityHeaders helper', () => {
      const mockHeaders = new Map<string, string>();
      const mockResponse = {
        headers: {
          set: (key: string, value: string) => { mockHeaders.set(key, value); },
          get: (key: string) => mockHeaders.get(key),
        } as unknown as Headers,
      };

      applySecurityHeaders(mockResponse);
      expect(mockHeaders.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });

    it('should include Cross-Origin-Opener-Policy in next.config.ts headers for all routes', async () => {
      const configuredHeaders = await nextConfig.headers!();
      const routeHeaders = configuredHeaders.find((r) => r.source === '/:path*')?.headers ?? [];
      const header = routeHeaders.find((h) => h.key === 'Cross-Origin-Opener-Policy');
      expect(header?.value).toBe('same-origin');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASVS req_id 3.5.8 — Cross-Origin-Resource-Policy (CORP)
  // Verify that HTTP responses include Cross-Origin-Resource-Policy: same-origin
  // to prevent untrusted cross-origin embedding of authenticated application resources.
  // ─────────────────────────────────────────────────────────────────────────────
  describe('req_id 3.5.8 - Cross-Origin-Resource-Policy (CORP)', () => {
    it('should include Cross-Origin-Resource-Policy in SECURITY_HEADERS', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Cross-Origin-Resource-Policy');
      expect(header).toBeDefined();
    });

    it('should set Cross-Origin-Resource-Policy to same-origin', () => {
      const header = SECURITY_HEADERS.find((h) => h.key === 'Cross-Origin-Resource-Policy');
      expect(header?.value).toBe('same-origin');
    });

    it('should apply Cross-Origin-Resource-Policy via applySecurityHeaders helper', () => {
      const mockHeaders = new Map<string, string>();
      const mockResponse = {
        headers: {
          set: (key: string, value: string) => { mockHeaders.set(key, value); },
          get: (key: string) => mockHeaders.get(key),
        } as unknown as Headers,
      };

      applySecurityHeaders(mockResponse);
      expect(mockHeaders.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    });

    it('should include Cross-Origin-Resource-Policy in next.config.ts headers for all routes', async () => {
      const configuredHeaders = await nextConfig.headers!();
      const routeHeaders = configuredHeaders.find((r) => r.source === '/:path*')?.headers ?? [];
      const header = routeHeaders.find((h) => h.key === 'Cross-Origin-Resource-Policy');
      expect(header?.value).toBe('same-origin');
    });
  });

  describe('applySecurityHeaders helper — full coverage', () => {
    it('should set all security headers on a response object', () => {
      const mockHeaders = new Map<string, string>();
      const mockResponse = {
        headers: {
          set: (key: string, value: string) => { mockHeaders.set(key, value); },
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

