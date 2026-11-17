// =============================================================================
// lib/session.ts - Anonymous Session ID Helper
// =============================================================================
// Reads or creates an anonymous session ID from the request cookie.
// Used to scope bookmarks and settings to a device without requiring login.
// =============================================================================

import { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'torbidd_session';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return require('crypto').randomUUID();
}

export function getSessionId(req: NextRequest): string {
  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  if (existing && existing.length > 0) return existing;
  // Generate a new ID — the response middleware sets the cookie
  return generateUuid();
}
