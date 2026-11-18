// =============================================================================
// lib/authorization/backend.ts – Backend authorization enforcement helpers
// SEC-08: Backend Authorization and Permission Enforcement — ASVS V8.3.1-V8.3.3
// =============================================================================
// Provides type-safe helpers that route handlers call to enforce authorization
// at the trusted backend layer, independently of any frontend controls.
//
// Design principles:
//   - Every protected route handler calls these helpers BEFORE processing.
//   - The helpers produce a typed result object; the handler returns the
//     response if `ok` is false, or continues if `ok` is true.
//   - Authorization decisions are NEVER delegated to frontend state or
//     hidden UI components.
//
// ASVS V8.3.1: Authorization is enforced at a trusted service layer.
// ASVS V8.3.3: Object access is based on the originating user's permissions.
// =============================================================================

import { NextResponse } from 'next/server';
import { AuthSessionUser, isAdminUser } from '../auth-constants';
import { hasPermission, type Permission } from './permissions';
import { logAuthzFailure } from '../audit-logger';

export type AuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * Verifies that a user is authenticated.
 * Returns 401 Unauthorized when the session is absent or invalid.
 *
 * ASVS V8.3.1: Enforce authorization at a trusted service layer.
 */
export function requireAuth(user: AuthSessionUser | null | undefined): AuthResult {
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 },
      ),
    };
  }
  return { ok: true };
}

/**
 * Verifies that the authenticated user holds administrative privileges.
 * Returns 403 Forbidden when unauthenticated or not an admin, matching
 * the application-wide admin endpoint convention (ASVS V8.2.1, V8.3.1).
 */
export function requireAdmin(user: AuthSessionUser | null | undefined): AuthResult {
  if (!user || !isAdminUser(user)) {
    // ASVS req_id 16.3.2: Log failed administrative authorization attempts with 403
    logAuthzFailure(user?.id || user?.email || null, null, 'administrative_endpoint', 'Admin access required', { status: 403 });
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 },
      ),
    };
  }
  return { ok: true };
}

/**
 * Verifies that the authenticated user has a specific permission.
 * Returns 401 when unauthenticated, 403 when permission is denied.
 *
 * ASVS V8.2.1: Restricts function-level access to consumers with explicit permissions.
 *
 * @param user       The authenticated user (from session cookie).
 * @param permission The permission required to access the resource.
 */
export function requirePermission(
  user: AuthSessionUser | null | undefined,
  permission: Permission,
): AuthResult {
  const authCheck = requireAuth(user);
  if (!authCheck.ok) return authCheck;

  if (!hasPermission(user!.role, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Forbidden: Permission '${permission}' required` },
        { status: 403 },
      ),
    };
  }
  return { ok: true };
}
