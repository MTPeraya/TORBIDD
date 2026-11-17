// =============================================================================
// lib/auth/google.ts - Google OAuth 2.0 & OIDC Token Validation (SEC-04)
// =============================================================================
// Implements robust Google OIDC token validation and PKCE flow according to:
// - ASVS V6.7.1: Protect trusted public keys and certificates.
// - ASVS V6.7.2: Use sufficiently long and unique cryptographic nonce.
// - ASVS V6.8.2: Validate authentication assertion signatures.
// - ASVS V6.8.4: Validate authentication strength and recency information.
// - ASVS V10.1.1: Restrict token access to backend components.
// - ASVS V10.1.2: Bind authorization responses to original session and transaction.
// - ASVS V10.2.1: Protect authorization-code flow against CSRF.
// - ASVS V10.2.3: Request only necessary OAuth scopes.
// - ASVS V10.5.1: Validate OIDC nonce.
// - ASVS V10.5.2: Identify users using stable `sub` claim.
// - ASVS V10.5.3: Validate expected issuer.
// - ASVS V10.5.4: Validate ID Token audience.
// =============================================================================

import crypto from 'crypto';

export const GOOGLE_ISSUERS = [
  'https://accounts.google.com',
  'accounts.google.com',
] as const;

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/** Scopes strictly necessary for Google Sign-In (ASVS V10.2.3) */
export const REQUIRED_OIDC_SCOPES = 'openid email profile';

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface GoogleJwkKey {
  kty: string;
  alg?: string;
  use?: string;
  kid: string;
  n: string;
  e: string;
}

export interface GoogleJwksResponse {
  keys: GoogleJwkKey[];
}

export interface GoogleIdTokenHeader {
  alg: string;
  kid: string;
  typ?: string;
}

export interface GoogleIdTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  auth_time?: number;
  [key: string]: unknown;
}

export interface ValidateIdTokenOptions {
  expectedClientId: string;
  expectedNonce?: string;
  maxAgeSec?: number;
  clockSkewSec?: number;
  jwksKeys?: GoogleJwkKey[];
}

// ---------------------------------------------------------------------------
// 1. PKCE (Proof Key for Code Exchange - RFC 7636) (ASVS V10.1.2)
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically secure PKCE code verifier and code challenge.
 * Uses 32 random bytes (256 bits) encoded with base64url, hashed with SHA-256.
 */
export function generatePkcePair(): PkcePair {
  // 32 bytes yields 43 base64url characters, matching RFC 7636 recommendations
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Validates a code verifier against an expected S256 code challenge.
 */
export function verifyPkceChallenge(codeVerifier: string, expectedChallenge: string): boolean {
  if (!codeVerifier || !expectedChallenge) return false;
  const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const bufA = Buffer.from(computed);
  const bufB = Buffer.from(expectedChallenge);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// 2. Cryptographic OIDC Nonce (ASVS V6.7.2, V10.5.1)
// ---------------------------------------------------------------------------

/**
 * Generates a 256-bit (32 byte) cryptographically secure random nonce.
 */
export function generateOidcNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ---------------------------------------------------------------------------
// 3. Trusted JWKS Public Key Cache (ASVS V6.7.1)
// ---------------------------------------------------------------------------

interface JwksCache {
  keys: GoogleJwkKey[];
  expiresAt: number;
}

let jwksCache: JwksCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches Google's public JWKS certificates with in-memory caching.
 */
export async function getGoogleJwksKeys(forceRefresh = false): Promise<GoogleJwkKey[]> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  try {
    const res = await fetch(GOOGLE_JWKS_URL, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Google JWKS: HTTP ${res.status}`);
    }

    const data = (await res.json()) as GoogleJwksResponse;
    if (!data || !Array.isArray(data.keys)) {
      throw new Error('Invalid Google JWKS response structure');
    }

    jwksCache = {
      keys: data.keys,
      expiresAt: now + CACHE_TTL_MS,
    };

    return data.keys;
  } catch (err) {
    if (jwksCache && jwksCache.keys.length > 0) {
      // Return stale cache if network error occurs (resilience)
      return jwksCache.keys;
    }
    throw err;
  }
}

/**
 * Resets the in-memory JWKS cache (useful for testing or cache invalidation).
 */
export function resetJwksCache(): void {
  jwksCache = null;
}

// ---------------------------------------------------------------------------
// 4. Google ID Token Signature & Claims Validation (ASVS V6.8.2, V10.5.1-4)
// ---------------------------------------------------------------------------

/**
 * Decodes a raw JWT without signature verification.
 */
export function decodeJwt<THeader = GoogleIdTokenHeader, TPayload = GoogleIdTokenPayload>(
  token: string,
): { header: THeader; payload: TPayload; signature: string; signingInput: string } {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: token must be a non-empty string');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token: JWT must contain exactly 3 dot-separated parts');
  }

  const [headerB64, payloadB64, signature] = parts;

  let header: THeader;
  let payload: TPayload;

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
  } catch {
    throw new Error('Invalid token: failed to parse JWT header');
  }

  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
  } catch {
    throw new Error('Invalid token: failed to parse JWT payload');
  }

  return {
    header,
    payload,
    signature,
    signingInput: `${headerB64}.${payloadB64}`,
  };
}

/**
 * Fully validates a Google ID Token:
 *  - Header format (RS256, kid)
 *  - RS256 signature against Google JWKS (ASVS V6.8.2)
 *  - Issuer (`iss`) matching Google (ASVS V10.5.3)
 *  - Audience (`aud`) matching client ID (ASVS V10.5.4)
 *  - Expiration (`exp`) and Issued-at (`iat`) with clock skew tolerance
 *  - Nonce (`nonce`) matching original transaction nonce (ASVS V10.5.1)
 *  - Subject (`sub`) present as stable identifier (ASVS V10.5.2)
 *  - Recency (`auth_time`) if maxAgeSec is provided (ASVS V6.8.4)
 */
export async function validateGoogleIdToken(
  idToken: string,
  options: ValidateIdTokenOptions,
): Promise<GoogleIdTokenPayload> {
  const {
    expectedClientId,
    expectedNonce,
    maxAgeSec,
    clockSkewSec = 60,
    jwksKeys,
  } = options;

  if (!expectedClientId) {
    throw new Error('validateGoogleIdToken: expectedClientId must be configured');
  }

  // 1. Decode token
  const { header, payload, signature, signingInput } = decodeJwt(idToken);

  // 2. Header validations
  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported token algorithm '${header.alg}'. Expected RS256.`);
  }

  if (!header.kid) {
    throw new Error('Missing "kid" (key ID) in ID token header.');
  }

  // 3. Locate matching JWK public key
  let keys = jwksKeys;
  if (!keys) {
    keys = await getGoogleJwksKeys();
  }

  let matchingKey = keys.find((k) => k.kid === header.kid);

  // If key not found and using live cache, force a refresh once (key rollover)
  if (!matchingKey && !jwksKeys) {
    const refreshedKeys = await getGoogleJwksKeys(true);
    matchingKey = refreshedKeys.find((k) => k.kid === header.kid);
  }

  if (!matchingKey) {
    throw new Error(`No matching public key found in Google JWKS for kid '${header.kid}'.`);
  }

  // 4. Verify cryptographic signature (ASVS V6.8.2)
  try {
    const publicKey = crypto.createPublicKey({
      key: matchingKey as unknown as crypto.JsonWebKey,
      format: 'jwk',
    });

    const sigBuffer = Buffer.from(signature, 'base64url');
    const isValidSignature = crypto.verify(
      'RSA-SHA256',
      Buffer.from(signingInput),
      publicKey,
      sigBuffer,
    );

    if (!isValidSignature) {
      throw new Error('Invalid ID token signature.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Invalid ID token signature')) {
      throw err;
    }
    throw new Error(`Signature verification failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. Validate Claims
  const now = Math.floor(Date.now() / 1000);

  // 5a. Expected Issuer (ASVS V10.5.3)
  if (!GOOGLE_ISSUERS.includes(payload.iss as (typeof GOOGLE_ISSUERS)[number])) {
    throw new Error(
      `Invalid ID token issuer '${payload.iss}'. Expected one of: ${GOOGLE_ISSUERS.join(', ')}.`,
    );
  }

  // 5b. Expected Audience (ASVS V10.5.4)
  if (payload.aud !== expectedClientId) {
    throw new Error(
      `Invalid ID token audience '${payload.aud}'. Expected '${expectedClientId}'.`,
    );
  }

  // 5c. Expiration and Issued-at with clock skew
  if (typeof payload.exp !== 'number' || payload.exp < now - clockSkewSec) {
    throw new Error(`ID token has expired (exp: ${payload.exp}, now: ${now}).`);
  }

  if (typeof payload.iat !== 'number' || payload.iat > now + clockSkewSec) {
    throw new Error(`ID token issued in the future (iat: ${payload.iat}, now: ${now}).`);
  }

  // 5d. Stable user identification: `sub` must be present (ASVS V10.5.2)
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    throw new Error('Missing or empty stable "sub" claim in ID token.');
  }

  // 5e. Validate OIDC nonce (ASVS V10.5.1)
  if (expectedNonce) {
    if (!payload.nonce) {
      throw new Error('ID token is missing expected "nonce" claim.');
    }
    if (payload.nonce !== expectedNonce) {
      throw new Error(
        `OIDC nonce mismatch. Possible token substitution or replay attack.`,
      );
    }
  }

  // 5f. Validate authentication recency if requested (ASVS V6.8.4)
  if (maxAgeSec !== undefined) {
    if (typeof payload.auth_time === 'number') {
      const authAge = now - payload.auth_time;
      if (authAge > maxAgeSec + clockSkewSec) {
        throw new Error(
          `Authentication is stale (auth_time was ${authAge}s ago, maximum allowed is ${maxAgeSec}s).`,
        );
      }
    }
  }

  return payload;
}
