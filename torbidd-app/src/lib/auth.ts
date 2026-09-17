// =============================================================================
// lib/auth.ts - Session Signing, Verification & Google Auth Helpers
// =============================================================================

import crypto from 'crypto';

import { AUTH_COOKIE_NAME, OAUTH_STATE_COOKIE } from './auth-constants';
export { AUTH_COOKIE_NAME, OAUTH_STATE_COOKIE };

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

// 7 days session duration
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function getSecretKey(): string {
  return process.env.SESSION_SECRET || process.env.AUTH_SECRET || 'torbidd_dev_fallback_secret_key_32bytes!';
}

/**
 * Signs an auth payload into a URL-safe tamper-proof token: <base64Payload>.<signature>
 */
export function signSession(user: AuthSessionUser): string {
  const secret = getSecretKey();
  const payload: AuthSessionPayload = {
    user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Verifies the token signature and returns the payload if valid and not expired.
 */
export function verifySession(token: string): AuthSessionPayload | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    const secret = getSecretKey();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payload: AuthSessionPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

export interface CookieReader {
  cookies: {
    get: (name: string) => { value?: string } | undefined;
  };
}

/**
 * Extracts and verifies the session from an incoming NextRequest or cookie container.
 */
export function getAuthSessionFromRequest(req: CookieReader): AuthSessionUser | null {
  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!cookie) return null;
  const verified = verifySession(cookie);
  return verified ? verified.user : null;
}
