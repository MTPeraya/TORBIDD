// =============================================================================
// lib/crypto-policy.ts - Cryptographic Key Management Policy & Inventory
// =============================================================================
// Implements ASVS v5.0:
//   - 11.1.1: Cryptographic key management policy aligned with NIST SP 800-57,
//             including lifecycle governance and oversharing constraints.
//   - 11.1.2: Cryptographic inventory listing all keys, algorithms, and
//             certificates used by the application, with allowed/forbidden uses
//             and associated data classifications.
// =============================================================================

// ---------------------------------------------------------------------------
// § 11.1.1 – Key Management Policy (NIST SP 800-57 alignment)
// ---------------------------------------------------------------------------

/**
 * Key lifecycle phases as defined by NIST SP 800-57 Part 1.
 */
export type KeyLifecyclePhase =
  | 'pre-activation'
  | 'active'
  | 'suspended'
  | 'deactivated'
  | 'compromised'
  | 'destroyed';

/**
 * Cryptographic key types supported by the application.
 */
export type CryptoKeyType = 'symmetric' | 'asymmetric-private' | 'asymmetric-public';

/**
 * Key management policy constraints enforced at runtime.
 *
 * NIST SP 800-57 Part 1 §5.4 — Maximum entities that may hold a key:
 *   - Shared secrets (symmetric): ≤ 2 entities.
 *   - Private keys (asymmetric): exactly 1 entity.
 *   - Public keys: unrestricted (they are intentionally shareable).
 */
export const KEY_SHARING_POLICY = {
  /** Maximum number of entities allowed to hold a symmetric/shared secret. */
  MAX_SYMMETRIC_HOLDERS: 2,
  /** Maximum number of entities allowed to hold a private key. */
  MAX_PRIVATE_KEY_HOLDERS: 1,
} as const;

/**
 * Minimum key / parameter sizes approved for use in this application,
 * aligned with NIST SP 800-57 Part 1 Rev. 5 §5.6 and ASVS v5.0 §11.
 */
export const MINIMUM_KEY_SIZES: Record<string, number> = {
  /** HMAC-SHA-256 key: minimum 256 bits (32 bytes). */
  'HMAC-SHA256': 256,
  /** AES key: minimum 128 bits; prefer 256. */
  AES: 128,
  /** RSA modulus: minimum 2048 bits; prefer 3072+. */
  RSA: 2048,
  /** ECDSA / ECDH: minimum 256-bit curve (P-256). */
  EC: 256,
};

/**
 * Approved hash algorithms (no MD5, SHA-1, etc.).
 * Source: NIST SP 800-131A Rev. 2, ASVS v5.0 §11.
 */
export const APPROVED_HASH_ALGORITHMS: ReadonlySet<string> = new Set([
  'sha256',
  'sha384',
  'sha512',
  'sha3-256',
  'sha3-384',
  'sha3-512',
]);

/**
 * Approved HMAC algorithms.
 */
export const APPROVED_HMAC_ALGORITHMS: ReadonlySet<string> = new Set([
  'sha256',
  'sha384',
  'sha512',
]);

/**
 * Algorithms that are explicitly forbidden (deprecated/broken).
 */
export const FORBIDDEN_ALGORITHMS: ReadonlySet<string> = new Set([
  'md5',
  'md4',
  'sha1',
  'sha',
  'sha-1',
  'des',
  '3des',
  'des-ede3',
  'rc4',
  'rc2',
  'blowfish',
  'idea',
]);

/**
 * Recommended key rotation periods (in days) per key type.
 * Source: NIST SP 800-57 Part 1 Rev. 5 §5.3.
 */
export const KEY_ROTATION_POLICY_DAYS: Record<string, number> = {
  /** Session signing secret: rotate at least annually. */
  SESSION_SECRET: 365,
  /** OAuth state signing secret: same as session. */
  OAUTH_STATE_SECRET: 365,
  /** TLS certificates: rotate before expiry (≤ 90 days recommended). */
  TLS_CERT: 90,
};

/**
 * Validates that a hash algorithm name is in the approved list.
 *
 * @param algorithm - Lower-case algorithm identifier (e.g. 'sha256').
 * @returns `true` if approved, `false` if forbidden or unknown.
 */
export function isApprovedHashAlgorithm(algorithm: string): boolean {
  const normalised = algorithm.toLowerCase().trim();
  if (isForbiddenAlgorithm(normalised)) return false;
  return APPROVED_HASH_ALGORITHMS.has(normalised);
}

/**
 * Validates that an HMAC algorithm is approved.
 */
export function isApprovedHmacAlgorithm(algorithm: string): boolean {
  const normalised = algorithm.toLowerCase().trim();
  if (isForbiddenAlgorithm(normalised)) return false;
  return APPROVED_HMAC_ALGORITHMS.has(normalised);
}

/**
 * Checks if an algorithm identifier or compound description refers to a forbidden / deprecated algorithm.
 */
export function isForbiddenAlgorithm(algorithm: string): boolean {
  const norm = algorithm.toLowerCase().trim();
  if (FORBIDDEN_ALGORITHMS.has(norm)) return true;

  // Patterns for compound descriptions (e.g. 'HMAC-MD5', 'DES-CBC', 'SHA-1')
  const forbiddenPatterns = [
    /\bmd[45]\b/i,
    /\bsha-?[01]\b/i,
    /\b(3des|des|des-ede3)\b/i,
    /\brc[24]\b/i,
    /\bblowfish\b/i,
    /\bidea\b/i,
  ];

  return forbiddenPatterns.some((pattern) => pattern.test(norm));
}

/**
 * Validates that a minimum key-size constraint is met.
 *
 * @param keyType - e.g. 'HMAC-SHA256', 'RSA', 'EC', 'AES'.
 * @param actualBits - Actual key size in bits.
 * @returns `true` if the size meets the minimum.
 */
export function meetsMinimumKeySize(keyType: string, actualBits: number): boolean {
  const minimum = MINIMUM_KEY_SIZES[keyType];
  if (minimum === undefined) return false; // unknown type → reject
  return actualBits >= minimum;
}

/**
 * Validates the key-sharing policy for a given key type.
 *
 * @param keyType - Type of the key.
 * @param holderCount - Number of entities / services that hold the key.
 * @returns `true` if sharing is within policy limits.
 */
export function isWithinSharingPolicy(keyType: CryptoKeyType, holderCount: number): boolean {
  if (holderCount < 1) return false;
  switch (keyType) {
    case 'symmetric':
      return holderCount <= KEY_SHARING_POLICY.MAX_SYMMETRIC_HOLDERS;
    case 'asymmetric-private':
      return holderCount <= KEY_SHARING_POLICY.MAX_PRIVATE_KEY_HOLDERS;
    case 'asymmetric-public':
      return true; // public keys are intentionally shareable
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// § 11.1.2 – Cryptographic Inventory
// ---------------------------------------------------------------------------

/** Data classification levels for data protected by a key. */
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

/** A single entry in the cryptographic inventory. */
export interface CryptoInventoryEntry {
  /** Unique identifier for this entry. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Key / algorithm type. */
  keyType: CryptoKeyType | 'certificate' | 'hash' | 'kdf';
  /** Algorithm identifier. */
  algorithm: string;
  /** Storage location of the key material. */
  storageLocation: string;
  /** Team / role responsible for this key. */
  owner: string;
  /** Current lifecycle phase. */
  lifecyclePhase: KeyLifecyclePhase;
  /** Rotation period in days (undefined = no scheduled rotation). */
  rotationDays?: number;
  /** Actions this key/algorithm is explicitly authorised to perform. */
  allowedUses: string[];
  /** Actions explicitly prohibited for this key/algorithm. */
  forbiddenUses: string[];
  /** Data classifications this key may protect. */
  protectedDataClassifications: DataClassification[];
}

/**
 * TORBIDD application cryptographic inventory.
 *
 * ASVS 11.1.2: This inventory must be kept current whenever a new
 * cryptographic primitive is introduced.  Spot-check: every `createHmac`,
 * `createHash`, `randomBytes`, or `crypto.verify` call in source code must
 * map to exactly one row here.
 *
 * Source-to-inventory mapping:
 *   - src/lib/auth.ts              → SESSION_SIGNING_KEY, OAUTH_STATE_SIGNING_KEY
 *   - src/lib/auth/google.ts       → PKCE_HASH, OIDC_NONCE_CSPRNG, GOOGLE_RS256_PUBKEYS
 *   - src/services/database/procurement.ts   → DEDUP_HASH
 *   - src/services/translation/translation-cache.ts  → CACHE_KEY_HASH
 */
export const CRYPTO_INVENTORY: readonly CryptoInventoryEntry[] = [
  {
    id: 'SESSION_SIGNING_KEY',
    description: 'HMAC-SHA-256 key used to sign and verify session tokens.',
    keyType: 'symmetric',
    algorithm: 'HMAC-SHA256',
    storageLocation: 'Environment variable SESSION_SECRET / AUTH_SECRET',
    owner: 'Platform Security Team',
    lifecyclePhase: 'active',
    rotationDays: KEY_ROTATION_POLICY_DAYS.SESSION_SECRET,
    allowedUses: ['sign session tokens', 'verify session tokens'],
    forbiddenUses: [
      'encrypt user data at rest',
      'sign OAuth state tokens (use OAUTH_STATE_SIGNING_KEY)',
      'shared with external parties',
    ],
    protectedDataClassifications: ['confidential', 'restricted'],
  },
  {
    id: 'OAUTH_STATE_SIGNING_KEY',
    description: 'HMAC-SHA-256 key used to sign and verify OAuth 2.0 state tokens (anti-CSRF).',
    keyType: 'symmetric',
    algorithm: 'HMAC-SHA256',
    storageLocation: 'Environment variable SESSION_SECRET / AUTH_SECRET (same as session)',
    owner: 'Platform Security Team',
    lifecyclePhase: 'active',
    rotationDays: KEY_ROTATION_POLICY_DAYS.OAUTH_STATE_SECRET,
    allowedUses: ['sign OAuth state tokens', 'verify OAuth state tokens'],
    forbiddenUses: [
      'sign session tokens',
      'encrypt user data at rest',
      'shared with external parties',
    ],
    protectedDataClassifications: ['internal', 'confidential'],
  },
  {
    id: 'PKCE_HASH',
    description: 'SHA-256 used to derive the PKCE code challenge from the code verifier (RFC 7636).',
    keyType: 'hash',
    algorithm: 'SHA-256',
    storageLocation: 'Computed on-the-fly; no persistent key material.',
    owner: 'Platform Security Team',
    lifecyclePhase: 'active',
    allowedUses: ['derive PKCE code challenge', 'verify PKCE code challenge'],
    forbiddenUses: ['password hashing', 'data integrity beyond PKCE'],
    protectedDataClassifications: ['internal'],
  },
  {
    id: 'OIDC_NONCE_CSPRNG',
    description: '256-bit CSPRNG-derived nonce for OIDC replay protection.',
    keyType: 'symmetric',
    algorithm: 'crypto.randomBytes (Node.js CSPRNG)',
    storageLocation: 'HTTP-only cookie (short-lived, single-use)',
    owner: 'Platform Security Team',
    lifecyclePhase: 'active',
    allowedUses: ['OIDC nonce generation', 'replay attack prevention'],
    forbiddenUses: ['session identifier', 'long-lived token'],
    protectedDataClassifications: ['internal'],
  },
  {
    id: 'PKCE_VERIFIER_CSPRNG',
    description: '256-bit CSPRNG-derived PKCE code verifier (RFC 7636).',
    keyType: 'symmetric',
    algorithm: 'crypto.randomBytes (Node.js CSPRNG)',
    storageLocation: 'HTTP-only cookie (short-lived, single-use)',
    owner: 'Platform Security Team',
    lifecyclePhase: 'active',
    allowedUses: ['PKCE code verifier generation'],
    forbiddenUses: ['session identifier', 'long-lived token'],
    protectedDataClassifications: ['internal'],
  },
  {
    id: 'GOOGLE_RS256_PUBKEYS',
    description: 'Google OIDC RS256 public keys fetched from JWKS endpoint for ID token verification.',
    keyType: 'asymmetric-public',
    algorithm: 'RSA-PKCS1-v1_5 / RS256',
    storageLocation: 'In-memory JWKS cache (auto-refreshed); source: googleapis.com/oauth2/v3/certs',
    owner: 'Google (external); cached by Platform Security Team',
    lifecyclePhase: 'active',
    allowedUses: ['verify Google ID token signatures'],
    forbiddenUses: ['encrypt data', 'sign application tokens', 'store in database'],
    protectedDataClassifications: ['public'],
  },
  {
    id: 'DEDUP_HASH',
    description: 'SHA-256 hash used to generate stable deduplication IDs for procurement records.',
    keyType: 'hash',
    algorithm: 'SHA-256',
    storageLocation: 'Computed on-the-fly; no persistent key material.',
    owner: 'Backend Engineering Team',
    lifecyclePhase: 'active',
    allowedUses: ['derive deterministic procurement record IDs'],
    forbiddenUses: ['password hashing', 'cryptographic authentication', 'integrity validation'],
    protectedDataClassifications: ['internal'],
  },
  {
    id: 'CACHE_KEY_HASH',
    description: 'SHA-256 hash used to derive translation-cache lookup keys.',
    keyType: 'hash',
    algorithm: 'SHA-256',
    storageLocation: 'Computed on-the-fly; no persistent key material.',
    owner: 'Backend Engineering Team',
    lifecyclePhase: 'active',
    allowedUses: ['derive cache lookup keys from translation input'],
    forbiddenUses: ['password hashing', 'cryptographic authentication', 'integrity validation'],
    protectedDataClassifications: ['internal'],
  },
] as const;

// ---------------------------------------------------------------------------
// Inventory helper utilities
// ---------------------------------------------------------------------------

/**
 * Retrieves an inventory entry by its ID.
 */
export function getInventoryEntry(id: string): CryptoInventoryEntry | undefined {
  return CRYPTO_INVENTORY.find((e) => e.id === id);
}

/**
 * Returns all active inventory entries.
 */
export function getActiveInventoryEntries(): CryptoInventoryEntry[] {
  return CRYPTO_INVENTORY.filter((e) => e.lifecyclePhase === 'active');
}

/**
 * Validates that every active entry uses an approved algorithm.
 *
 * @returns An array of non-compliant entry IDs (empty = all compliant).
 */
export function auditInventoryAlgorithms(): string[] {
  const nonCompliant: string[] = [];
  for (const entry of getActiveInventoryEntries()) {
    if (isForbiddenAlgorithm(entry.algorithm)) {
      nonCompliant.push(entry.id);
    }
  }
  return nonCompliant;
}

/**
 * Checks whether a proposed use is explicitly forbidden for a given inventory entry.
 *
 * @param entryId - Inventory entry ID.
 * @param proposedUse - Description of the intended use.
 * @returns `true` if the use is forbidden.
 */
export function isUseForbidden(entryId: string, proposedUse: string): boolean {
  const entry = getInventoryEntry(entryId);
  if (!entry) return true; // unknown entry → reject
  const lower = proposedUse.toLowerCase();
  return entry.forbiddenUses.some((f) => lower.includes(f.toLowerCase()));
}

// ---------------------------------------------------------------------------
// § 11.1.2 – Non-security Math.random() allowlist
// ---------------------------------------------------------------------------

/**
 * Documents approved uses of non-cryptographic randomness (Math.random()).
 * These uses are explicitly reviewed and confirmed non-security-sensitive.
 *
 * ASVS 11.1.2: Security-sensitive random values MUST use Node.js crypto.randomBytes()
 * or crypto.getRandomValues().  The uses listed here are non-security-sensitive.
 */
export const NON_CRYPTO_RANDOM_ALLOWLIST: ReadonlyArray<{
  location: string;
  purpose: string;
  isSecurity: false;
}> = [
  {
    location: 'src/lib/rate-limiter.ts:80',
    purpose: 'Probabilistic stale-entry pruning (1-in-50 chance); non-security, non-deterministic path only.',
    isSecurity: false,
  },
  {
    location: 'src/services/database/notifications.ts:129',
    purpose: 'Mock notification ID suffix in development/test stub; non-security.',
    isSecurity: false,
  },
  {
    location: 'src/services/notifications/email-delivery.service.ts:319',
    purpose: 'Mock message ID suffix in development/test stub; non-security.',
    isSecurity: false,
  },
] as const;
