// =============================================================================
// lib/authorization/permissions.ts – Permission matrix for RBAC
// SEC-05: Role-Based Access Control — ASVS V8.1.1, V8.2.1
// =============================================================================
// Defines which permissions are granted to each application role.
// All authorization decisions in route handlers should call hasPermission()
// rather than comparing role strings directly.
//
// Permission Definitions:
//   read:procurement     – View procurement listings and search results
//   read:opportunity     – View opportunity detail pages
//   write:bookmark       – Create/delete personal bookmarks
//   write:profile        – Update own user profile (name, org)
//   read:notifications   – View and manage own notifications/preferences
//   admin:users          – List users and change user roles (UC-9)
//   admin:sync           – Trigger data synchronisation
//   admin:ai             – Configure AI provider settings
//   admin:classification – Review and correct AI-generated classifications (UC-4, UC-10)
// =============================================================================

export type Permission =
  | 'read:procurement'
  | 'read:opportunity'
  | 'write:bookmark'
  | 'write:profile'
  | 'read:notifications'
  | 'admin:users'
  | 'admin:sync'
  | 'admin:ai'
  | 'admin:classification';

/**
 * Permission map — indexed by role string.
 * Unlisted roles fall back to 'anonymous' permissions.
 *
 * ASVS V8.1.1: Function-level and data-specific authorization rules are
 * documented here as the single source of truth.
 */
export const PERMISSIONS: Record<string, Set<Permission>> = {
  /**
   * admin — Full platform access.
   * Assigned via ADMIN_EMAILS env var or explicit admin promotion.
   */
  admin: new Set<Permission>([
    'read:procurement',
    'read:opportunity',
    'write:bookmark',
    'write:profile',
    'read:notifications',
    'admin:users',
    'admin:sync',
    'admin:ai',
    'admin:classification',
  ]),

  /**
   * BMA Officer — Standard registered user.
   * Default role assigned on first Google OAuth sign-in.
   */
  'BMA Officer': new Set<Permission>([
    'read:procurement',
    'read:opportunity',
    'write:bookmark',
    'write:profile',
    'read:notifications',
  ]),

  /**
   * anonymous — Unauthenticated visitor.
   * Read-only access to public procurement data.
   */
  anonymous: new Set<Permission>([
    'read:procurement',
    'read:opportunity',
  ]),
};

/**
 * Returns `true` when the given role has the requested permission.
 * Unknown roles are treated as 'anonymous' (least privilege).
 *
 * ASVS V8.2.1: Restricts function-level access to consumers with explicit permissions.
 *
 * @param role       The user's current role string (from session or DB).
 * @param permission The permission being checked.
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const perms = PERMISSIONS[role] ?? PERMISSIONS['anonymous'];
  return perms.has(permission);
}
