// =============================================================================
// lib/session.ts - Anonymous Session ID Helper
// =============================================================================
// Reads or creates an anonymous session ID from the request cookie.
// Used to scope bookmarks and settings to a device without requiring login.
// =============================================================================

import { NextRequest } from 'next/server';
import {
  SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
  readCookieWithFallback,
} from './cookie-security';

export { SESSION_COOKIE, LEGACY_SESSION_COOKIE };

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function getSessionId(req: NextRequest): string {
  const existing = readCookieWithFallback(req.cookies, SESSION_COOKIE, LEGACY_SESSION_COOKIE);
  if (existing && existing.length > 0) return existing;
  // Generate a new ID — the response middleware sets the cookie
  return generateSessionId();
}
