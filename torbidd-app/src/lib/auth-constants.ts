// =============================================================================
// lib/auth-constants.ts - Auth Cookie Names and Constants
// (Edge-runtime safe: does not import Node.js built-ins)
// =============================================================================

export const AUTH_COOKIE_NAME = 'torbidd_auth_session';
export const OAUTH_STATE_COOKIE = 'torbidd_oauth_state';

export interface AuthSessionUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: string;
  org: string;
}

export interface AuthSessionPayload {
  user: AuthSessionUser;
  exp: number; // expiration timestamp in seconds
}

/**
 * Checks whether a user has administrative privileges.
 * (Edge runtime safe)
 */
export function isAdminUser(user: AuthSessionUser | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase().trim();
  if (role === 'admin' || role === 'administrator') return true;

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (user.email && adminEmails.includes(user.email.toLowerCase().trim())) {
    return true;
  }

  return false;
}

/**
 * Decodes the base64 URL-safe session payload without cryptographic verification.
 * (Edge runtime safe)
 */
export function decodeSessionPayload(token: string): AuthSessionPayload | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadStr] = token.split('.');
    if (!payloadStr) return null;

    let jsonStr = '';
    if (typeof atob === 'function') {
      const base64 = payloadStr.replace(/-/g, '+').replace(/_/g, '/');
      jsonStr = atob(base64);
    } else {
      jsonStr = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    }

    const payload: AuthSessionPayload = JSON.parse(jsonStr);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
