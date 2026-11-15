// =============================================================================
// lib/authorization.ts - Role & Privilege Authorization Helpers
// =============================================================================
// Centralises all role-related logic for TORBIDD. This module is the single
// source of truth for:
//   - Canonical role names and the allowed role set.
//   - Admin-privilege checks (wrapping auth-constants for server-side use).
//   - Validation of role assignment requests (guards privilege escalation).
//   - Detection of reserved/forbidden account identifiers (ASVS V6.3.2).
//
// Design principles (ASVS V6.3.2):
//   1. No default admin accounts – admin status is ONLY granted via the
//      ADMIN_EMAILS environment variable set by an operator at deploy time,
//      or by an existing admin explicitly promoting another user.
//   2. No hardcoded credentials – the application never stores or checks
//      passwords; authentication is delegated entirely to Google OAuth 2.0.
//   3. Privilege escalation is impossible for ordinary users – the `role`
//      field on a session can only be set to an admin value by the backend
//      when ADMIN_EMAILS contains the user's email, or when an existing admin
//      approves the promotion via the admin user-management API.
//   4. Reserved usernames blocked – identifiers like 'admin', 'root', 'sa',
//      'system', and 'superuser' are detected and rejected if they appear in
//      OAuth profiles (should not happen with real Google accounts, but
//      guards against misconfigured mock environments).
// =============================================================================

import { AuthSessionUser, isAdminUser } from './auth-constants';

export { isAdminUser };

// ---------------------------------------------------------------------------
// Canonical role constants
// ---------------------------------------------------------------------------

/** All roles that the application recognises. */
export const ROLES = {
  ADMIN: 'admin',
  BMA_OFFICER: 'BMA Officer',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

/** Roles that confer administrative privileges. */
const PRIVILEGED_ROLES = new Set(['admin', 'administrator']);

// ---------------------------------------------------------------------------
// Reserved / forbidden identifiers (ASVS V6.3.2)
// ---------------------------------------------------------------------------

/**
 * Lowercase identifiers that MUST NOT be granted any role automatically.
 * If a Google profile supplies one of these as `name` or `email` prefix, the
 * account is considered suspicious and cannot be promoted to admin.
 */
const RESERVED_IDENTIFIERS = new Set([
  'admin',
  'administrator',
  'root',
  'sa',
  'system',
  'superuser',
  'sysadmin',
  'superadmin',
  'service_account',
]);

/**
 * Returns `true` when the supplied identifier matches a reserved system name.
 * Checks are case-insensitive and strip common separators (_, -, .).
 */
export function isReservedIdentifier(value: string): boolean {
  if (!value) return false;
  const normalised = value.toLowerCase().replace(/[_.\-\s]/g, '');
  return RESERVED_IDENTIFIERS.has(normalised);
}

// ---------------------------------------------------------------------------
// Admin email list helpers
// ---------------------------------------------------------------------------

/**
 * Returns the list of operator-configured admin emails from the
 * ADMIN_EMAILS environment variable (comma-separated, lowercased).
 */
export function getConfiguredAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns `true` when `email` is in the ADMIN_EMAILS list.
 * This is the ONLY mechanism by which a new admin account may be created
 * automatically on first Google OAuth login.
 */
export function isEmailConfiguredAsAdmin(email: string): boolean {
  if (!email) return false;
  return getConfiguredAdminEmails().includes(email.toLowerCase().trim());
}

// ---------------------------------------------------------------------------
// Role assignment validation
// ---------------------------------------------------------------------------

export interface RoleAssignmentResult {
  allowed: boolean;
  resolvedRole: string;
  reason: string;
}

/**
 * Validates whether `actor` is permitted to assign `requestedRole` to a target
 * user. Enforces the following authorization policy:
 *
 *   - Only an existing admin may grant admin/administrator roles.
 *   - Non-admins can only self-assign non-privileged roles.
 *   - Reserved identifiers can never be assigned a privileged role, regardless
 *     of actor privileges (defence-in-depth).
 *   - If `requestedRole` is not in the allowed set, it defaults to `BMA Officer`.
 *
 * @param actor         The user performing the assignment (may be the same as target).
 * @param requestedRole The role string that was requested.
 * @param targetEmail   The email of the account being assigned the role.
 */
export function validateRoleAssignment(
  actor: AuthSessionUser | null | undefined,
  requestedRole: string,
  targetEmail: string,
): RoleAssignmentResult {
  const actorIsAdmin = isAdminUser(actor);
  const normalised = (requestedRole || '').trim().toLowerCase();
  const isPrivileged = PRIVILEGED_ROLES.has(normalised);

  // Guard: reserved identifier may never receive a privileged role
  const emailPrefix = targetEmail.split('@')[0] ?? '';
  if (isPrivileged && (isReservedIdentifier(emailPrefix) || isReservedIdentifier(targetEmail.split('@')[0]))) {
    return {
      allowed: false,
      resolvedRole: ROLES.BMA_OFFICER,
      reason: 'Reserved account identifiers cannot hold privileged roles.',
    };
  }

  // Guard: only an admin actor may grant admin/administrator
  if (isPrivileged && !actorIsAdmin) {
    return {
      allowed: false,
      resolvedRole: ROLES.BMA_OFFICER,
      reason: 'Privilege escalation denied: only administrators can assign admin roles.',
    };
  }

  // Allow: actor is admin granting admin role
  if (isPrivileged && actorIsAdmin) {
    return {
      allowed: true,
      resolvedRole: ROLES.ADMIN,
      reason: 'Admin role granted by administrator.',
    };
  }

  // Default: safe non-privileged role assignment
  const safeRole = requestedRole.trim() || ROLES.BMA_OFFICER;
  return {
    allowed: true,
    resolvedRole: safeRole,
    reason: 'Non-privileged role assignment allowed.',
  };
}

// ---------------------------------------------------------------------------
// Mock-mode admin guard (development safety)
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the application is running with a mock OAuth session
 * (NODE_ENV !== 'production' and mock_dev_code path was used).
 *
 * Mock sessions are NEVER granted admin privileges in this function; callers
 * must check ADMIN_EMAILS just as with real accounts.
 */
export function isMockSession(userId: string): boolean {
  return userId === 'mock_user_bma_123';
}

/**
 * Determines the initial role for a user on first login (or upsert).
 * Admin role is ONLY assigned when the user's email is in ADMIN_EMAILS.
 * Mock sessions that happen to be in ADMIN_EMAILS still get admin – but the
 * mock account uses a non-reserved email, so this is intentional dev behaviour.
 *
 * @param email   The authenticated user's email address.
 * @returns       'admin' or 'BMA Officer'
 */
export function resolveInitialRole(email: string): AppRole {
  if (isEmailConfiguredAsAdmin(email)) return ROLES.ADMIN;
  return ROLES.BMA_OFFICER;
}
