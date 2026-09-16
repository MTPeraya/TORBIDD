// =============================================================================
// lib/__tests__/auth.test.ts - Unit Tests for Authentication & Session Helpers
// =============================================================================

import { signSession, verifySession, getAuthSessionFromRequest, AUTH_COOKIE_NAME, AuthSessionUser } from '../auth';

describe('Authentication & Session Helper (lib/auth.ts)', () => {
  const sampleUser: AuthSessionUser = {
    id: 'user_test_123',
    email: 'officer@bangkok.go.th',
    name: 'Somchai Prasert',
    picture: 'https://example.com/avatar.jpg',
    role: 'BMA Procurement Specialist',
    org: 'สำนักยุทธศาสตร์และประเมินผล',
  };

  it('should generate a valid signed session token', () => {
    const token = signSession(sampleUser);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
  });

  it('should verify an authentic session token and recover user payload', () => {
    const token = signSession(sampleUser);
    const verified = verifySession(token);

    expect(verified).not.toBeNull();
    expect(verified?.user.id).toBe(sampleUser.id);
    expect(verified?.user.email).toBe(sampleUser.email);
    expect(verified?.user.name).toBe(sampleUser.name);
    expect(verified?.user.picture).toBe(sampleUser.picture);
    expect(verified?.user.role).toBe(sampleUser.role);
    expect(verified?.user.org).toBe(sampleUser.org);
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should reject a tampered token where payload is altered', () => {
    const token = signSession(sampleUser);
    const [payloadStr, signature] = token.split('.');

    // Tamper with base64 payload
    const decoded = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    decoded.user.email = 'hacker@evil.com';
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    const tamperedToken = `${tamperedPayload}.${signature}`;
    const verified = verifySession(tamperedToken);

    expect(verified).toBeNull();
  });

  it('should reject a tampered token where signature is altered', () => {
    const token = signSession(sampleUser);
    const [payloadStr] = token.split('.');
    const fakeSignature = 'invalid_signature_xyz123';

    const tamperedToken = `${payloadStr}.${fakeSignature}`;
    const verified = verifySession(tamperedToken);

    expect(verified).toBeNull();
  });

  it('should return null for malformed tokens or empty strings', () => {
    expect(verifySession('')).toBeNull();
    expect(verifySession('not_a_valid_token')).toBeNull();
    expect(verifySession('abc.def.extra_part')).toBeNull();
  });

  it('should extract authenticated user from request cookies', () => {
    const token = signSession(sampleUser);
    const req = {
      cookies: {
        get: (name: string) => (name === AUTH_COOKIE_NAME ? { value: token } : undefined),
      },
    };

    const user = getAuthSessionFromRequest(req);
    expect(user).not.toBeNull();
    expect(user?.email).toBe(sampleUser.email);
    expect(user?.name).toBe(sampleUser.name);
  });

  it('should return null if request lacks the auth cookie', () => {
    const req = {
      cookies: {
        get: () => undefined,
      },
    };
    const user = getAuthSessionFromRequest(req);
    expect(user).toBeNull();
  });
});
