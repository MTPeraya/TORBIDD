/**
 * @jest-environment node
 */
// =============================================================================
// lib/__tests__/authorization-backend.test.ts
// SEC-08: Backend Authorization and Permission Enforcement — ASVS V8.3.1-V8.3.3
// =============================================================================

import { requireAuth, requireAdmin, requirePermission } from '../authorization/backend';
import { AuthSessionUser } from '../auth-constants';

describe('SEC-08 backend authorization helpers', () => {
  const adminUser: AuthSessionUser = {
    id: 'user_admin_01',
    email: 'admin@bangkok.go.th',
    name: 'Admin User',
    picture: '',
    role: 'admin',
    org: 'กรุงเทพมหานคร',
  };

  const regularUser: AuthSessionUser = {
    id: 'user_officer_01',
    email: 'officer@bangkok.go.th',
    name: 'Officer User',
    picture: '',
    role: 'BMA Officer',
    org: 'กรุงเทพมหานคร',
  };

  describe('requireAuth', () => {
    it('returns ok: true for authenticated user', () => {
      const result = requireAuth(regularUser);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ok).toBe(true);
      }
    });

    it('returns ok: false with 401 when user is null', () => {
      const result = requireAuth(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });

    it('returns ok: false with 401 when user is undefined', () => {
      const result = requireAuth(undefined);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });
  });

  describe('requireAdmin', () => {
    it('returns ok: true for admin user', () => {
      const result = requireAdmin(adminUser);
      expect(result.ok).toBe(true);
    });

    it('returns ok: false with 403 when user is not authenticated', () => {
      const result = requireAdmin(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });

    it('returns ok: false with 403 when user is not admin (BMA Officer)', () => {
      const result = requireAdmin(regularUser);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });

    it('returns ok: true when user is configured as admin in ADMIN_EMAILS', () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = 'custom_admin@bangkok.go.th';
      try {
        const configuredAdmin: AuthSessionUser = {
          ...regularUser,
          email: 'custom_admin@bangkok.go.th',
          role: 'BMA Officer', // role string is not admin, but email is configured
        };
        const result = requireAdmin(configuredAdmin);
        expect(result.ok).toBe(true);
      } finally {
        process.env.ADMIN_EMAILS = originalEnv;
      }
    });
  });

  describe('requirePermission', () => {
    it('returns ok: false with 401 for null user', () => {
      const result = requirePermission(null, 'read:procurement');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });

    it('returns ok: true for BMA Officer accessing read:procurement', () => {
      const result = requirePermission(regularUser, 'read:procurement');
      expect(result.ok).toBe(true);
    });

    it('returns ok: true for BMA Officer accessing write:bookmark', () => {
      const result = requirePermission(regularUser, 'write:bookmark');
      expect(result.ok).toBe(true);
    });

    it('returns ok: false with 403 for BMA Officer trying admin:users', () => {
      const result = requirePermission(regularUser, 'admin:users');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });

    it('returns ok: false with 403 for BMA Officer trying admin:sync', () => {
      const result = requirePermission(regularUser, 'admin:sync');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });

    it('returns ok: true for admin accessing admin:users', () => {
      const result = requirePermission(adminUser, 'admin:users');
      expect(result.ok).toBe(true);
    });

    it('returns ok: true for admin accessing admin:classification', () => {
      const result = requirePermission(adminUser, 'admin:classification');
      expect(result.ok).toBe(true);
    });
  });
});
