// =============================================================================
// lib/session.ts - Anonymous Session ID Helper
// =============================================================================
// Reads or creates an anonymous session ID from the request cookie.
// Used to scope bookmarks and settings to a device without requiring login.
// =============================================================================

import { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'torbidd_session';

/** Generate a cryptographically strong UUID without loading an ESM-only package in Jest. */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function getSessionId(req: NextRequest): string {
  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  if (existing && existing.length > 0) return existing;
  // Generate a new ID — the response middleware sets the cookie
  return generateSessionId();
}
