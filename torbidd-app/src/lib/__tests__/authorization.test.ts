// =============================================================================
// lib/__tests__/authorization.test.ts – Unit tests for SEC-02 controls
// =============================================================================
// Tests the authorization module that enforces ASVS V6.3.2:
//   - No default admin accounts or reserved identifiers with privileges.
//   - Admin role can only be assigned by existing admins or via ADMIN_EMAILS.
//   - Ordinary users cannot escalate their own privileges.
//   - Reserved identifiers cannot hold admin roles.
// =============================================================================

import {
  isReservedIdentifier,
  validateRoleAssignment,
  resolveInitialRole,
  isEmailConfiguredAsAdmin,
  getConfiguredAdminEmails,
  isMockSession,
  ROLES,
} from '../authorization';
import { AuthSessionUser } from '../auth-constants';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const adminUser: AuthSessionUser = {
  id: 'admin_001',
  email: 'superadmin@bangkok.go.th',
  name: 'System Admin',
  picture: '',
  role: 'admin',
  org: 'กรุงเทพมหานคร',
};

const regularUser: AuthSessionUser = {
  id: 'user_001',
  email: 'officer@bangkok.go.th',
  name: 'BMA Officer',
  picture: '',
  role: 'BMA Officer',
  org: 'กรุงเทพมหานคร',
};

const targetEmail = 'target@bangkok.go.th';

// ---------------------------------------------------------------------------
// isReservedIdentifier
// ---------------------------------------------------------------------------

describe('isReservedIdentifier', () => {
  it('returns true for "admin"', () => {
    expect(isReservedIdentifier('admin')).toBe(true);
  });

  it('returns true for "root"', () => {
    expect(isReservedIdentifier('root')).toBe(true);
  });

  it('returns true for "sa"', () => {
    expect(isReservedIdentifier('sa')).toBe(true);
  });

  it('returns true for "system"', () => {
    expect(isReservedIdentifier('system')).toBe(true);
  });

  it('returns true for "superuser"', () => {
    expect(isReservedIdentifier('superuser')).toBe(true);
  });

  it('returns true for "sysadmin"', () => {
    expect(isReservedIdentifier('sysadmin')).toBe(true);
  });

  it('is case-insensitive ("ADMIN")', () => {
    expect(isReservedIdentifier('ADMIN')).toBe(true);
  });

  it('strips separators ("super_user")', () => {
    expect(isReservedIdentifier('super_user')).toBe(true);
  });

  it('strips dots ("super.admin")', () => {
    expect(isReservedIdentifier('super.admin')).toBe(true);
  });

  it('returns false for a normal BMA officer email prefix', () => {
    expect(isReservedIdentifier('officer')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isReservedIdentifier('')).toBe(false);
  });

  it('returns false for a typical user name', () => {
    expect(isReservedIdentifier('somchai.prasert')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateRoleAssignment – privilege escalation guards
// ---------------------------------------------------------------------------

describe('validateRoleAssignment – privilege escalation', () => {
  it('allows an admin to grant admin role to another user', () => {
    const result = validateRoleAssignment(adminUser, 'admin', targetEmail);
    expect(result.allowed).toBe(true);
    expect(result.resolvedRole).toBe(ROLES.ADMIN);
  });

  it('allows an admin to grant non-privileged role', () => {
    const result = validateRoleAssignment(adminUser, 'BMA Officer', targetEmail);
    expect(result.allowed).toBe(true);
  });

  it('blocks a regular user from granting admin role (self-escalation)', () => {
    const result = validateRoleAssignment(regularUser, 'admin', regularUser.email);
    expect(result.allowed).toBe(false);
    expect(result.resolvedRole).toBe(ROLES.BMA_OFFICER);
    expect(result.reason).toMatch(/escalation denied/i);
  });

  it('blocks a regular user from granting admin role to another user', () => {
    const result = validateRoleAssignment(regularUser, 'admin', targetEmail);
    expect(result.allowed).toBe(false);
    expect(result.resolvedRole).toBe(ROLES.BMA_OFFICER);
  });

  it('blocks a regular user from granting "administrator" role', () => {
    const result = validateRoleAssignment(regularUser, 'administrator', targetEmail);
    expect(result.allowed).toBe(false);
    expect(result.resolvedRole).toBe(ROLES.BMA_OFFICER);
  });

  it('allows a regular user to assign a non-privileged role to themselves', () => {
    const result = validateRoleAssignment(regularUser, 'BMA Officer', regularUser.email);
    expect(result.allowed).toBe(true);
  });

  it('blocks assigning admin role to a reserved-identifier account', () => {
    const result = validateRoleAssignment(adminUser, 'admin', 'admin@bangkok.go.th');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/reserved/i);
  });

  it('blocks assigning admin role to root@domain account', () => {
    const result = validateRoleAssignment(adminUser, 'admin', 'root@example.com');
    expect(result.allowed).toBe(false);
  });

  it('defaults resolvedRole to BMA Officer when role is empty', () => {
    const result = validateRoleAssignment(regularUser, '', targetEmail);
    expect(result.allowed).toBe(true);
    expect(result.resolvedRole).toBe(ROLES.BMA_OFFICER);
  });

  it('blocks a null/undefined actor from granting admin role', () => {
    const result = validateRoleAssignment(null, 'admin', targetEmail);
    expect(result.allowed).toBe(false);
    expect(result.resolvedRole).toBe(ROLES.BMA_OFFICER);
  });

  it('blocks an undefined actor from granting admin role', () => {
    const result = validateRoleAssignment(undefined, 'admin', targetEmail);
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveInitialRole – OAuth first-login role assignment
// ---------------------------------------------------------------------------

describe('resolveInitialRole', () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('returns BMA Officer for a regular user not in ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'superadmin@bangkok.go.th';
    expect(resolveInitialRole('officer@bangkok.go.th')).toBe(ROLES.BMA_OFFICER);
  });

  it('returns admin for an email explicitly listed in ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'superadmin@bangkok.go.th, other@domain.com';
    expect(resolveInitialRole('superadmin@bangkok.go.th')).toBe(ROLES.ADMIN);
  });

  it('is case-insensitive when matching ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'SuperAdmin@Bangkok.go.th';
    expect(resolveInitialRole('superadmin@bangkok.go.th')).toBe(ROLES.ADMIN);
  });

  it('returns BMA Officer when ADMIN_EMAILS is not set', () => {
    delete process.env.ADMIN_EMAILS;
    expect(resolveInitialRole('anyone@anywhere.com')).toBe(ROLES.BMA_OFFICER);
  });

  it('returns BMA Officer when ADMIN_EMAILS is empty string', () => {
    process.env.ADMIN_EMAILS = '';
    expect(resolveInitialRole('anyone@anywhere.com')).toBe(ROLES.BMA_OFFICER);
  });

  it('never grants admin based on role field in session – only email list', () => {
    // Even if someone crafts a session with role='admin', the initial role for
    // a NEW login is computed only from the email list.
    process.env.ADMIN_EMAILS = 'real@admin.com';
    // 'admin@example.com' is NOT in ADMIN_EMAILS even though prefix is 'admin'
    expect(resolveInitialRole('admin@example.com')).toBe(ROLES.BMA_OFFICER);
  });
});

// ---------------------------------------------------------------------------
// isEmailConfiguredAsAdmin
// ---------------------------------------------------------------------------

describe('isEmailConfiguredAsAdmin', () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('returns true for a configured admin email', () => {
    process.env.ADMIN_EMAILS = 'admin@bangkok.go.th';
    expect(isEmailConfiguredAsAdmin('admin@bangkok.go.th')).toBe(true);
  });

  it('returns false for an email not in the list', () => {
    process.env.ADMIN_EMAILS = 'admin@bangkok.go.th';
    expect(isEmailConfiguredAsAdmin('other@bangkok.go.th')).toBe(false);
  });

  it('returns false for an empty email', () => {
    process.env.ADMIN_EMAILS = 'admin@bangkok.go.th';
    expect(isEmailConfiguredAsAdmin('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getConfiguredAdminEmails
// ---------------------------------------------------------------------------

describe('getConfiguredAdminEmails', () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('returns an empty array when ADMIN_EMAILS is not set', () => {
    delete process.env.ADMIN_EMAILS;
    expect(getConfiguredAdminEmails()).toEqual([]);
  });

  it('parses a comma-separated list correctly', () => {
    process.env.ADMIN_EMAILS = 'a@b.com, c@d.com , e@f.com';
    expect(getConfiguredAdminEmails()).toEqual(['a@b.com', 'c@d.com', 'e@f.com']);
  });

  it('lowercases all emails', () => {
    process.env.ADMIN_EMAILS = 'Admin@Bangkok.GO.TH';
    expect(getConfiguredAdminEmails()).toEqual(['admin@bangkok.go.th']);
  });
});

// ---------------------------------------------------------------------------
// isMockSession
// ---------------------------------------------------------------------------

describe('isMockSession', () => {
  it('returns true for the well-known mock user ID', () => {
    expect(isMockSession('mock_user_bma_123')).toBe(true);
  });

  it('returns false for real user IDs', () => {
    expect(isMockSession('real_mongo_id_abc123')).toBe(false);
    expect(isMockSession('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ASVS V6.3.2 – No default admin account guarantee
// ---------------------------------------------------------------------------

describe('ASVS V6.3.2 – No default admin account', () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('no user gets admin on first login when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS;
    // Simulate first Google OAuth login for three users
    const users = ['alice@test.com', 'bob@test.com', 'carol@test.com'];
    users.forEach((email) => {
      expect(resolveInitialRole(email)).toBe(ROLES.BMA_OFFICER);
    });
  });

  it('reserved identifier emails cannot receive admin role', () => {
    process.env.ADMIN_EMAILS = '';
    const reserved = ['admin@domain.com', 'root@domain.com', 'sa@domain.com', 'system@domain.com'];
    reserved.forEach((email) => {
      // resolveInitialRole relies on ADMIN_EMAILS; not in list → BMA Officer
      expect(resolveInitialRole(email)).toBe(ROLES.BMA_OFFICER);

      // Even if admin tries to promote them, validateRoleAssignment blocks it
      const result = validateRoleAssignment(adminUser, 'admin', email);
      expect(result.allowed).toBe(false);
    });
  });

  it('ordinary users cannot self-assign admin role via profile update', () => {
    // This mirrors what happens in PUT /api/auth/me
    const result = validateRoleAssignment(regularUser, 'admin', regularUser.email);
    expect(result.allowed).toBe(false);
    expect(result.resolvedRole).toBe(ROLES.BMA_OFFICER);
  });
});
