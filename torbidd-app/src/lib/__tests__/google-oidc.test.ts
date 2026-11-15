// =============================================================================
// lib/__tests__/google-oidc.test.ts - Unit tests for SEC-04 controls
// =============================================================================

import crypto from 'crypto';
import {
  generatePkcePair,
  verifyPkceChallenge,
  generateOidcNonce,
  decodeJwt,
  validateGoogleIdToken,
  resetJwksCache,
  GoogleJwkKey,
  GoogleIdTokenPayload,
} from '../auth/google';

describe('Google OAuth 2.0 & OIDC Token Validation (SEC-04)', () => {
  const CLIENT_ID = 'torbidd-test-client-12345.apps.googleusercontent.com';
  const NONCE = 'c0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ff';

  // Generate test RSA KeyPair for RS256 signature testing
  let privateKey: crypto.KeyObject;
  let publicKeyJwk: GoogleJwkKey;
  const TEST_KID = 'test-key-id-2026';

  beforeAll(() => {
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    privateKey = keyPair.privateKey;
    const jwk = keyPair.publicKey.export({ format: 'jwk' }) as unknown as GoogleJwkKey;
    publicKeyJwk = {
      ...jwk,
      kid: TEST_KID,
      alg: 'RS256',
      use: 'sig',
    };
  });

  afterEach(() => {
    resetJwksCache();
  });

  /**
   * Helper to sign a test ID Token using the test RSA private key.
   */
  function signTestIdToken(
    payloadOverrides: Partial<GoogleIdTokenPayload> = {},
    headerOverrides: Record<string, unknown> = {},
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      kid: TEST_KID,
      typ: 'JWT',
      ...headerOverrides,
    };

    const payload: GoogleIdTokenPayload = {
      iss: 'https://accounts.google.com',
      sub: 'google_user_sub_987654321',
      aud: CLIENT_ID,
      exp: now + 3600,
      iat: now,
      nonce: NONCE,
      email: 'officer@bangkok.go.th',
      email_verified: true,
      name: 'Somchai Prasert',
      picture: 'https://lh3.googleusercontent.com/test-avatar',
      auth_time: now - 30,
      ...payloadOverrides,
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${headerB64}.${payloadB64}`;

    const signature = crypto
      .sign('RSA-SHA256', Buffer.from(signingInput), privateKey)
      .toString('base64url');

    return `${signingInput}.${signature}`;
  }

  // ---------------------------------------------------------------------------
  // 1. PKCE (ASVS V10.1.2)
  // ---------------------------------------------------------------------------
  describe('PKCE Generation & Verification (RFC 7636)', () => {
    it('generates high-entropy code verifier and valid S256 code challenge', () => {
      const pkce = generatePkcePair();
      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(pkce.codeChallengeMethod).toBe('S256');

      // Verify the challenge was computed via sha256
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(pkce.codeVerifier)
        .digest('base64url');
      expect(pkce.codeChallenge).toBe(expectedChallenge);
    });

    it('successfully verifies a matching code verifier against challenge', () => {
      const pkce = generatePkcePair();
      expect(verifyPkceChallenge(pkce.codeVerifier, pkce.codeChallenge)).toBe(true);
    });

    it('rejects an altered code verifier (tampering / substitution guard)', () => {
      const pkce = generatePkcePair();
      const alteredVerifier = pkce.codeVerifier.slice(0, -1) + 'X';
      expect(verifyPkceChallenge(alteredVerifier, pkce.codeChallenge)).toBe(false);
    });

    it('returns false for empty or missing verifier or challenge', () => {
      expect(verifyPkceChallenge('', 'some_challenge')).toBe(false);
      expect(verifyPkceChallenge('some_verifier', '')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Cryptographic Nonce (ASVS V6.7.2, V10.5.1)
  // ---------------------------------------------------------------------------
  describe('Cryptographic OIDC Nonce (ASVS V6.7.2)', () => {
    it('generates a 256-bit (64 hex character) random cryptographic nonce', () => {
      const nonce1 = generateOidcNonce();
      const nonce2 = generateOidcNonce();

      expect(nonce1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(nonce1)).toBe(true);
      expect(nonce1).not.toBe(nonce2);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. JWT Decoding
  // ---------------------------------------------------------------------------
  describe('decodeJwt', () => {
    it('decodes valid JWT header and payload', () => {
      const token = signTestIdToken();
      const decoded = decodeJwt(token);

      expect(decoded.header.alg).toBe('RS256');
      expect(decoded.header.kid).toBe(TEST_KID);
      expect(decoded.payload.sub).toBe('google_user_sub_987654321');
      expect(decoded.payload.aud).toBe(CLIENT_ID);
    });

    it('throws error for malformed token structure', () => {
      expect(() => decodeJwt('only.two.parts.extra')).toThrow(/exactly 3/);
      expect(() => decodeJwt('single-part')).toThrow(/exactly 3/);
      expect(() => decodeJwt('')).toThrow(/non-empty string/);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Full ID Token Validation (ASVS V6.8.2, V10.5.1-4)
  // ---------------------------------------------------------------------------
  describe('validateGoogleIdToken', () => {
    it('successfully validates a legitimate Google ID Token with valid RS256 signature and claims', async () => {
      const token = signTestIdToken();
      const payload = await validateGoogleIdToken(token, {
        expectedClientId: CLIENT_ID,
        expectedNonce: NONCE,
        jwksKeys: [publicKeyJwk],
      });

      expect(payload).toBeDefined();
      expect(payload.sub).toBe('google_user_sub_987654321');
      expect(payload.email).toBe('officer@bangkok.go.th');
      expect(payload.aud).toBe(CLIENT_ID);
      expect(payload.nonce).toBe(NONCE);
    });

    it('accepts alternative valid Google issuer accounts.google.com (ASVS V10.5.3)', async () => {
      const token = signTestIdToken({ iss: 'accounts.google.com' });
      const payload = await validateGoogleIdToken(token, {
        expectedClientId: CLIENT_ID,
        expectedNonce: NONCE,
        jwksKeys: [publicKeyJwk],
      });
      expect(payload.iss).toBe('accounts.google.com');
    });

    it('rejects an invalid signature (tampered token body) (ASVS V6.8.2)', async () => {
      const token = signTestIdToken();
      const parts = token.split('.');
      // Tamper with payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: 'hacker_sub', iss: 'https://accounts.google.com' }),
      ).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      await expect(
        validateGoogleIdToken(tamperedToken, {
          expectedClientId: CLIENT_ID,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/Invalid ID token signature/);
    });

    it('rejects token with unexpected issuer (ASVS V10.5.3)', async () => {
      const token = signTestIdToken({ iss: 'https://attacker-idp.example.com' });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/Invalid ID token issuer/);
    });

    it('rejects token with incorrect audience (ASVS V10.5.4)', async () => {
      const token = signTestIdToken({ aud: 'another-app-client-id.apps.googleusercontent.com' });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/Invalid ID token audience/);
    });

    it('rejects expired ID token (ASVS V10.5.4)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = signTestIdToken({ exp: now - 300, iat: now - 3600 });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          clockSkewSec: 0,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/ID token has expired/);
    });

    it('rejects token issued in the future beyond clock skew', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = signTestIdToken({ iat: now + 500, exp: now + 4000 });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          clockSkewSec: 60,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/ID token issued in the future/);
    });

    it('rejects token when OIDC nonce does not match original transaction (ASVS V10.5.1)', async () => {
      const token = signTestIdToken({ nonce: 'substituted_or_replayed_nonce' });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          expectedNonce: NONCE,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/OIDC nonce mismatch/);
    });

    it('rejects token missing nonce claim when nonce was expected', async () => {
      const token = signTestIdToken({ nonce: undefined });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          expectedNonce: NONCE,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/missing expected "nonce" claim/);
    });

    it('rejects token with missing or empty sub claim (ASVS V10.5.2)', async () => {
      const token = signTestIdToken({ sub: '' });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/Missing or empty stable "sub" claim/);
    });

    it('rejects unsupported signing algorithm (e.g. HS256, none)', async () => {
      const token = signTestIdToken({}, { alg: 'HS256' });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/Unsupported token algorithm 'HS256'/);
    });

    it('rejects token when kid does not match any key in JWKS', async () => {
      const token = signTestIdToken({}, { kid: 'unknown-kid-999' });

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/No matching public key found in Google JWKS/);
    });

    it('rejects stale authentication when maxAgeSec threshold is exceeded (ASVS V6.8.4)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = signTestIdToken({ auth_time: now - 3600 }); // Authenticated 1 hour ago

      await expect(
        validateGoogleIdToken(token, {
          expectedClientId: CLIENT_ID,
          expectedNonce: NONCE,
          maxAgeSec: 300, // Maximum allowed 5 minutes
          clockSkewSec: 0,
          jwksKeys: [publicKeyJwk],
        }),
      ).rejects.toThrow(/Authentication is stale/);
    });
  });
});
