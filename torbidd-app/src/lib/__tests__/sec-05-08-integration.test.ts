/**
 * @jest-environment node
 */
// =============================================================================
// lib/__tests__/sec-05-08-integration.test.ts
// Integration test suite covering:
//   - SEC-05: Role-Based Access Control (RBAC) (ASVS V8.1.1, V8.2.1)
//   - SEC-06: Resource Ownership & Object-Level Authorization (IDOR) (ASVS V8.2.2)
//   - SEC-07: Field-Level Authorization (BOPLA) (ASVS V8.1.2, V8.2.3)
//   - SEC-08: Backend Authorization & Immediate Freshness (ASVS V8.3.1 - V8.3.3)
// =============================================================================

import {
  ROLES,
  hasPermission,
  PERMISSIONS,
  type Permission,
  verifyBookmarkOwnership,
  verifyOwnership,
  ADMIN_ONLY_USER_FIELDS,
  ADMIN_ONLY_PROJECT_FIELDS,
  stripUnauthorizedFields,
  rejectUnauthorizedFields,
} from '../authorization';
import { requireAuth, requireAdmin, requirePermission } from '../authorization/backend';
import { AuthSessionUser } from '../auth-constants';
import { signSession, verifySession } from '../auth';

describe('SEC-05 / SEC-06 / SEC-07 / SEC-08 Security Integration Suite', () => {
  const adminActor: AuthSessionUser = {
    id: 'user_admin_999',
    email: 'admin.super@bangkok.go.th',
    name: 'Admin Supervisor',
    picture: 'https://example.com/admin.jpg',
    role: ROLES.ADMIN,
    org: 'กรุงเทพมหานคร',
  };

  const officerActor: AuthSessionUser = {
    id: 'user_officer_111',
    email: 'officer.user@bangkok.go.th',
    name: 'BMA Procurement Officer',
    picture: 'https://example.com/officer.jpg',
    role: ROLES.BMA_OFFICER,
    org: 'กรุงเทพมหานคร',
  };

  const otherOfficerActor: AuthSessionUser = {
    id: 'user_officer_222',
    email: 'other.officer@bangkok.go.th',
    name: 'Another Officer',
    picture: 'https://example.com/other.jpg',
    role: ROLES.BMA_OFFICER,
    org: 'กรุงเทพมหานคร',
  };

  // ===========================================================================
  // SEC-05: RBAC Role and Function-Level Authorization
  // ===========================================================================
  describe('SEC-05: Role-Based Access Control', () => {
    it('enforces that admin has complete access across all permissions', () => {
      const allPermissions: Permission[] = [
        'read:procurement',
        'read:opportunity',
        'write:bookmark',
        'write:profile',
        'read:notifications',
        'admin:users',
        'admin:sync',
        'admin:ai',
        'admin:classification',
      ];
      allPermissions.forEach((p) => {
        expect(hasPermission(adminActor.role, p)).toBe(true);
      });
    });

    it('enforces that BMA Officer can access normal operations but is strictly barred from admin operations', () => {
      // Allowed operations
      expect(hasPermission(officerActor.role, 'read:procurement')).toBe(true);
      expect(hasPermission(officerActor.role, 'read:opportunity')).toBe(true);
      expect(hasPermission(officerActor.role, 'write:bookmark')).toBe(true);
      expect(hasPermission(officerActor.role, 'write:profile')).toBe(true);
      expect(hasPermission(officerActor.role, 'read:notifications')).toBe(true);

      // Blocked operations
      expect(hasPermission(officerActor.role, 'admin:users')).toBe(false);
      expect(hasPermission(officerActor.role, 'admin:sync')).toBe(false);
      expect(hasPermission(officerActor.role, 'admin:ai')).toBe(false);
      expect(hasPermission(officerActor.role, 'admin:classification')).toBe(false);
    });

    it('enforces that anonymous visitors have strictly read-only access to public listings', () => {
      expect(hasPermission('anonymous', 'read:procurement')).toBe(true);
      expect(hasPermission('anonymous', 'read:opportunity')).toBe(true);

      expect(hasPermission('anonymous', 'write:bookmark')).toBe(false);
      expect(hasPermission('anonymous', 'write:profile')).toBe(false);
      expect(hasPermission('anonymous', 'admin:users')).toBe(false);
      expect(hasPermission('anonymous', 'admin:sync')).toBe(false);
    });
  });

  // ===========================================================================
  // SEC-06: Resource Ownership and IDOR Prevention
  // ===========================================================================
  describe('SEC-06: Resource Ownership & IDOR Prevention', () => {
    it('verifies bookmark ownership for legitimate resource owner', () => {
      const isOwner = verifyBookmarkOwnership(officerActor.id, officerActor.id);
      expect(isOwner).toBe(true);
    });

    it('blocks cross-user bookmark access when another user tries to access or delete it', () => {
      // User 2 tries to tamper with User 1's bookmark
      const isOwner = verifyBookmarkOwnership(otherOfficerActor.id, officerActor.id);
      expect(isOwner).toBe(false);
    });

    it('blocks ownership verification when either ID is blank or missing', () => {
      expect(verifyBookmarkOwnership('', officerActor.id)).toBe(false);
      expect(verifyBookmarkOwnership(officerActor.id, '')).toBe(false);
      expect(verifyOwnership('', '')).toBe(false);
    });
  });

  // ===========================================================================
  // SEC-07: Field-Level Authorization (BOPLA Prevention)
  // ===========================================================================
  describe('SEC-07: Field-Level Authorization', () => {
    it('rejects attempt by BMA Officer to inject administrative fields via profile payload', () => {
      const attemptedPayload = {
        name: 'Tampered Name',
        isAdmin: true, // BOPLA privilege injection attempt
        org: 'Hacked Org',
      };

      const check = rejectUnauthorizedFields(
        attemptedPayload,
        officerActor.role,
        ADMIN_ONLY_USER_FIELDS,
      );

      expect(check.rejected).toBe(true);
      expect(check.fields).toContain('isAdmin');
    });

    it('permits administrator to update administrative fields in profile payload', () => {
      const adminPayload = {
        name: 'Admin Name',
        isAdmin: true,
      };

      const check = rejectUnauthorizedFields(
        adminPayload,
        adminActor.role,
        ADMIN_ONLY_USER_FIELDS,
      );

      expect(check.rejected).toBe(false);
      expect(check.fields).toHaveLength(0);
    });

    it('strips classification fields when a non-admin submits project updates', () => {
      const incomingUpdate = {
        title: 'New Portal Project',
        budget: 5000000,
        category: 'ERP' as const,
        isSoftwareRelated: false,
        classificationReviewStatus: 'APPROVED' as const,
      };

      const sanitized = stripUnauthorizedFields(
        incomingUpdate,
        officerActor.role,
        ADMIN_ONLY_PROJECT_FIELDS,
      );

      expect(sanitized).toHaveProperty('title', 'New Portal Project');
      expect(sanitized).toHaveProperty('budget', 5000000);
      expect(sanitized).not.toHaveProperty('category');
      expect(sanitized).not.toHaveProperty('isSoftwareRelated');
      expect(sanitized).not.toHaveProperty('classificationReviewStatus');
    });
  });

  // ===========================================================================
  // SEC-08: Backend Authorization Enforcement & Session Freshness
  // ===========================================================================
  describe('SEC-08: Backend Authorization Enforcement', () => {
    it('requireAuth rejects unauthenticated requests with 401', () => {
      const res = requireAuth(null);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.response.status).toBe(401);
      }
    });

    it('requireAdmin rejects ordinary user with 403 Forbidden', () => {
      const res = requireAdmin(officerActor);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.response.status).toBe(403);
      }
    });

    it('requireAdmin allows administrator with ok: true', () => {
      const res = requireAdmin(adminActor);
      expect(res.ok).toBe(true);
    });

    it('requirePermission enforces granular permission checks', () => {
      // Officer has read:procurement
      const readProc = requirePermission(officerActor, 'read:procurement');
      expect(readProc.ok).toBe(true);

      // Officer does NOT have admin:sync
      const adminSync = requirePermission(officerActor, 'admin:sync');
      expect(adminSync.ok).toBe(false);
      if (!adminSync.ok) {
        expect(adminSync.response.status).toBe(403);
      }
    });

    it('preserves immediate session freshness when re-signing session upon role promotion', () => {
      // Simulate role change: BMA Officer promoted to admin
      const promotedUser: AuthSessionUser = {
        ...officerActor,
        role: ROLES.ADMIN,
      };

      const freshToken = signSession(promotedUser);
      const verified = verifySession(freshToken);

      expect(verified).not.toBeNull();
      expect(verified?.user.role).toBe(ROLES.ADMIN);
      expect(requireAdmin(verified?.user).ok).toBe(true);
    });
  });
});
