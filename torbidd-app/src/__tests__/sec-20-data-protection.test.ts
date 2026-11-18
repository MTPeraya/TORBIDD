/**
 * @jest-environment node
 */
/**
 * SEC-20: Data Protection, Privacy Controls & Transport Security
 *
 * OWASP ASVS v4.0.3 Chapter 14 Verification Test Suite
 *
 * Requirements Covered:
 * - V14.1.1: Data classification scheme (Public, Internal, Confidential) under Thai PDPA.
 * - V14.1.2: Documented protection requirements per data classification level.
 * - V14.2.1: Body/Header only transmission for sensitive data.
 * - V14.2.2: Prevention of sensitive data caching in server components and proxies.
 * - V14.2.3: Prohibition of untrusted third-party trackers and analytics scripts.
 * - V14.2.4: Enforce documented protection controls across storage, logs, and database records.
 * - V14.2.5: Web Cache Deception prevention (dedicated 404 handler and anti-cache).
 * - V14.2.6: Data minimization in API responses.
 * - V14.2.7: Automated retention pruning via MongoDB TTL index (30-day DLQ expiration).
 * - V14.3.1: Clear authenticated data and emit Clear-Site-Data on session termination.
 * - V14.3.2: Anti-caching HTTP response headers (Cache-Control: no-store, private).
 * - V14.3.3: Browser storage hardening (no tokens in localStorage, HttpOnly cookies for sessions).
 */

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import SyncError from '@/models/SyncError';
import { ANTI_CACHE_HEADERS, applyAntiCacheHeaders } from '@/lib/security-headers';
import { middleware } from '@/middleware';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { GET as getBookmarksHandler, POST as postBookmarksHandler } from '@/app/api/bookmarks/route';
import { GET as getNotificationsHandler } from '@/app/api/notifications/route';
import { GET as getAuthMeHandler } from '@/app/api/auth/me/route';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import { LEGACY_AUTH_COOKIE_NAME } from '@/lib/cookie-security';

describe('SEC-20: Data Protection, Privacy Controls & Transport Security', () => {
  // ── 1. Data Classification & Documentation (ASVS V14.1.1 & V14.1.2) ──────
  describe('1. Data Classification & Privacy Documentation (ASVS V14.1.1 & V14.1.2)', () => {
    const docPath = path.resolve(__dirname, '../../docs/security/data-protection-privacy.md');

    it('documents data classification into Public, Internal, and Confidential levels', () => {
      expect(fs.existsSync(docPath)).toBe(true);
      const content = fs.readFileSync(docPath, 'utf-8');

      expect(content).toContain('Public Data');
      expect(content).toContain('Internal Data');
      expect(content).toContain('Confidential Data');
      expect(content).toContain('PDPA');
    });

    it('documents specific protection requirements per classification level', () => {
      const content = fs.readFileSync(docPath, 'utf-8');

      expect(content).toContain('Encryption in Transit');
      expect(content).toContain('Encryption at Rest');
      expect(content).toContain('Retention Policy');
      expect(content).toContain('Logging & Telemetry');
      expect(content).toContain('HTTP Caching');
    });
  });

  // ── 2. Sensitive Data Transmission & Minimization (ASVS V14.2.1 & V14.2.6) ──
  describe('2. Sensitive Data Transmission & Minimization (ASVS V14.2.1 & V14.2.6)', () => {
    it('accepts resource manipulation via request body rather than URL query parameters', async () => {
      const req = new NextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: '507f1f77bcf86cd799439011' }),
      });

      const res = await postBookmarksHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('minimizes returned user fields to display essentials in /api/auth/me', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/me');
      const res = await getAuthMeHandler(req);
      const data = await res.json();

      expect(data).toHaveProperty('authenticated');
      expect(data).toHaveProperty('user');
      // Must not leak internal database metadata or secrets
      if (data.user) {
        expect(data.user).not.toHaveProperty('password');
        expect(data.user).not.toHaveProperty('googleClientSecret');
        expect(data.user).not.toHaveProperty('accessToken');
        expect(data.user).not.toHaveProperty('refreshToken');
      }
    });
  });

  // ── 3. Anti-Caching Headers Enforcement (ASVS V14.2.2 & V14.3.2) ──────────
  describe('3. Anti-Caching Headers Enforcement (ASVS V14.2.2 & V14.3.2)', () => {
    it('defines standard anti-caching HTTP response headers', () => {
      expect(ANTI_CACHE_HEADERS['Cache-Control']).toContain('no-store');
      expect(ANTI_CACHE_HEADERS['Cache-Control']).toContain('no-cache');
      expect(ANTI_CACHE_HEADERS['Cache-Control']).toContain('must-revalidate');
      expect(ANTI_CACHE_HEADERS['Cache-Control']).toContain('private');
      expect(ANTI_CACHE_HEADERS['Pragma']).toBe('no-cache');
      expect(ANTI_CACHE_HEADERS['Expires']).toBe('0');
    });

    it('applyAntiCacheHeaders injects anti-caching headers into a response', () => {
      const baseRes = NextResponse.json({ test: true });
      const protectedRes = applyAntiCacheHeaders(baseRes);

      expect(protectedRes.headers.get('Cache-Control')).toBe(ANTI_CACHE_HEADERS['Cache-Control']);
      expect(protectedRes.headers.get('Pragma')).toBe('no-cache');
      expect(protectedRes.headers.get('Expires')).toBe('0');
    });

    it('middleware injects anti-caching headers for API routes', () => {
      const req = new NextRequest('http://localhost:3000/api/bookmarks');
      const res = middleware(req);

      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Pragma')).toBe('no-cache');
      expect(res.headers.get('Expires')).toBe('0');
    });

    it('middleware injects anti-caching headers for protected client routes', () => {
      const req = new NextRequest('http://localhost:3000/notifications');
      const res = middleware(req);

      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Pragma')).toBe('no-cache');
      expect(res.headers.get('Expires')).toBe('0');
    });

    it('/api/bookmarks GET response includes anti-caching headers', async () => {
      const req = new NextRequest('http://localhost:3000/api/bookmarks');
      const res = await getBookmarksHandler(req);

      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Pragma')).toBe('no-cache');
      expect(res.headers.get('Expires')).toBe('0');
    });

    it('/api/notifications GET response includes anti-caching headers', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications');
      const res = await getNotificationsHandler(req);

      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Pragma')).toBe('no-cache');
      expect(res.headers.get('Expires')).toBe('0');
    });

    it('/api/auth/me GET response includes anti-caching headers', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/me');
      const res = await getAuthMeHandler(req);

      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Pragma')).toBe('no-cache');
      expect(res.headers.get('Expires')).toBe('0');
    });
  });

  // ── 4. Third-Party Tracker Prohibition (ASVS V14.2.3) ─────────────────────
  describe('4. Third-Party Tracker Prohibition (ASVS V14.2.3)', () => {
    it('confirms absence of third-party tracking scripts in client application layout', () => {
      const layoutPath = path.resolve(__dirname, '../app/layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      // Prohibited trackers
      expect(layoutContent).not.toContain('googletagmanager');
      expect(layoutContent).not.toContain('google-analytics');
      expect(layoutContent).not.toContain('gtag');
      expect(layoutContent).not.toContain('connect.facebook.net');
      expect(layoutContent).not.toContain('mixpanel');
      expect(layoutContent).not.toContain('hotjar');
    });
  });

  // ── 5. Web Cache Deception Mitigation (ASVS V14.2.5) ──────────────────────
  describe('5. Web Cache Deception Mitigation (ASVS V14.2.5)', () => {
    it('provides a dedicated 404 not-found page component for nonexistent resources', () => {
      const notFoundPath = path.resolve(__dirname, '../app/not-found.tsx');
      expect(fs.existsSync(notFoundPath)).toBe(true);
      const content = fs.readFileSync(notFoundPath, 'utf-8');

      expect(content).toContain('404');
      expect(content).toContain('Page Not Found');
    });
  });

  // ── 6. Automated Retention Pruning via MongoDB TTL (ASVS V14.2.7) ──────────
  describe('6. Automated Retention Pruning via MongoDB TTL (ASVS V14.2.7)', () => {
    it('defines a MongoDB TTL index on SyncError schema with 30-day expiration', () => {
      const indexes = SyncError.schema.indexes();

      // Look for an index on { createdAt: 1 } with expireAfterSeconds: 2592000 (30 days)
      const ttlIndex = indexes.find(
        ([fields, options]) =>
          fields.createdAt !== undefined &&
          options &&
          typeof options.expireAfterSeconds === 'number',
      );

      expect(ttlIndex).toBeDefined();
      if (ttlIndex) {
        const [fields, options] = ttlIndex;
        expect(fields.createdAt).toBe(1);
        expect(options.expireAfterSeconds).toBe(30 * 24 * 60 * 60); // 2,592,000s
      }
    });
  });

  // ── 7. Session Termination & Client Storage Hardening (ASVS V14.3.1 & V14.3.3) ──
  describe('7. Session Termination & Client Storage Hardening (ASVS V14.3.1 & V14.3.3)', () => {
    it('POST /api/auth/logout emits Clear-Site-Data and anti-caching headers', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST' });
      const res = await logoutHandler(req);

      expect(res.status).toBe(200);

      // ASVS V14.3.1: Clear-Site-Data header
      const clearSiteData = res.headers.get('Clear-Site-Data');
      expect(clearSiteData).toBeDefined();
      expect(clearSiteData).toContain('"cache"');
      expect(clearSiteData).toContain('"cookies"');
      expect(clearSiteData).toContain('"storage"');

      // ASVS V14.3.2: Anti-caching header
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Pragma')).toBe('no-cache');
      expect(res.headers.get('Expires')).toBe('0');
    });

    it('POST /api/auth/logout invalidates session cookies with maxAge: 0', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST' });
      const res = await logoutHandler(req);

      const hostCookie = res.cookies.get(AUTH_COOKIE_NAME);
      const legacyCookie = res.cookies.get(LEGACY_AUTH_COOKIE_NAME);

      expect(hostCookie).toBeDefined();
      expect(hostCookie?.value).toBe('');
      expect(hostCookie?.maxAge).toBe(0);

      expect(legacyCookie).toBeDefined();
      expect(legacyCookie?.value).toBe('');
      expect(legacyCookie?.maxAge).toBe(0);
    });

    it('verifies client AuthContext performs client storage cleanup on logout', () => {
      const authContextPath = path.resolve(__dirname, '../contexts/AuthContext.tsx');
      const content = fs.readFileSync(authContextPath, 'utf-8');

      expect(content).toContain("localStorage.removeItem('torbidd_profile')");
      expect(content).toContain("localStorage.removeItem('torbidd_settings')");
      expect(content).toContain('sessionStorage.clear()');
    });

    it('verifies Topbar component performs client storage cleanup on logout', () => {
      const topbarPath = path.resolve(__dirname, '../components/layout/Topbar.tsx');
      const content = fs.readFileSync(topbarPath, 'utf-8');

      expect(content).toContain("localStorage.removeItem('torbidd_profile')");
      expect(content).toContain("localStorage.removeItem('torbidd_settings')");
      expect(content).toContain('sessionStorage.clear()');
    });
  });
});
