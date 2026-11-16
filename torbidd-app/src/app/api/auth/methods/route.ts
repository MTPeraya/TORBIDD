// =============================================================================
// app/api/auth/methods/route.ts - Allowed Authentication Methods & Policy (SEC-03)
// =============================================================================
// Exposes the application's supported authentication methods and explicitly
// rejects unauthorized authentication attempts (ASVS V6.3.6).
// =============================================================================

import { NextResponse } from 'next/server';
import {
  ALLOWED_AUTH_METHODS,
  PROHIBITED_AUTH_METHODS,
  ASVS_V6_3_6_MESSAGE,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      allowed: ALLOWED_AUTH_METHODS,
      prohibited: PROHIBITED_AUTH_METHODS,
      policy: 'OWASP ASVS V6.3.6',
      description:
        'TORBIDD strictly delegates user authentication to Google OAuth 2.0 / OpenID Connect. ' +
        'Email-only authentication, passwords, magic links, and email OTPs are disabled.',
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: ASVS_V6_3_6_MESSAGE,
      allowedMethods: ALLOWED_AUTH_METHODS,
    },
    { status: 405 },
  );
}
