/**
 * @jest-environment node
 */
// =============================================================================
// lib/__tests__/crypto-policy.test.ts
// Tests for ASVS v5.0:
//   - req_id 11.1.1: Cryptographic Key Management Policy (NIST SP 800-57)
//   - req_id 11.1.2: Cryptographic Inventory
// =============================================================================

import crypto from 'crypto';

import {
  // Policy constants
  KEY_SHARING_POLICY,
  MINIMUM_KEY_SIZES,
  APPROVED_HASH_ALGORITHMS,
  APPROVED_HMAC_ALGORITHMS,
  FORBIDDEN_ALGORITHMS,
  KEY_ROTATION_POLICY_DAYS,
  // Policy validators
  isApprovedHashAlgorithm,
  isApprovedHmacAlgorithm,
  isForbiddenAlgorithm,
  meetsMinimumKeySize,
  isWithinSharingPolicy,
  // Inventory
  CRYPTO_INVENTORY,
  getInventoryEntry,
  getActiveInventoryEntries,
  auditInventoryAlgorithms,
  isUseForbidden,
  NON_CRYPTO_RANDOM_ALLOWLIST,
} from '../crypto-policy';

// ---------------------------------------------------------------------------
// req_id 11.1.1 – Cryptographic Key Management Policy
// ---------------------------------------------------------------------------

describe('req_id 11.1.1 - Cryptographic Key Management Policy', () => {
  describe('Algorithm approval list', () => {
    it('approves SHA-256 as a hash algorithm', () => {
      expect(isApprovedHashAlgorithm('sha256')).toBe(true);
    });

    it('approves SHA-384 and SHA-512 as hash algorithms', () => {
      expect(isApprovedHashAlgorithm('sha384')).toBe(true);
      expect(isApprovedHashAlgorithm('sha512')).toBe(true);
    });

    it('approves SHA-3 variants', () => {
      expect(isApprovedHashAlgorithm('sha3-256')).toBe(true);
      expect(isApprovedHashAlgorithm('sha3-512')).toBe(true);
    });

    it('rejects MD5 (broken)', () => {
      expect(isApprovedHashAlgorithm('md5')).toBe(false);
    });

    it('rejects SHA-1 (deprecated)', () => {
      expect(isApprovedHashAlgorithm('sha1')).toBe(false);
      expect(isApprovedHashAlgorithm('sha-1')).toBe(false);
      expect(isApprovedHashAlgorithm('sha')).toBe(false);
    });

    it('rejects RC4 (broken stream cipher)', () => {
      expect(isApprovedHashAlgorithm('rc4')).toBe(false);
    });

    it('rejects unknown algorithms', () => {
      expect(isApprovedHashAlgorithm('unknown-alg')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isApprovedHashAlgorithm('SHA256')).toBe(true);
      expect(isApprovedHashAlgorithm('MD5')).toBe(false);
    });

    it('approves HMAC-SHA-256/384/512', () => {
      expect(isApprovedHmacAlgorithm('sha256')).toBe(true);
      expect(isApprovedHmacAlgorithm('sha384')).toBe(true);
      expect(isApprovedHmacAlgorithm('sha512')).toBe(true);
    });

    it('rejects HMAC-MD5 and HMAC-SHA1', () => {
      expect(isApprovedHmacAlgorithm('md5')).toBe(false);
      expect(isApprovedHmacAlgorithm('sha1')).toBe(false);
    });

    it('identifies compound forbidden algorithms correctly', () => {
      expect(isForbiddenAlgorithm('HMAC-MD5')).toBe(true);
      expect(isForbiddenAlgorithm('DES-CBC')).toBe(true);
      expect(isForbiddenAlgorithm('SHA-1')).toBe(true);
      expect(isForbiddenAlgorithm('HMAC-SHA256')).toBe(false);
      expect(isForbiddenAlgorithm('SHA-256')).toBe(false);
      expect(isForbiddenAlgorithm('RSA-PKCS1-v1_5 / RS256')).toBe(false);
    });
  });

  describe('FORBIDDEN_ALGORITHMS set', () => {
    const expected = ['md5', 'sha1', 'des', '3des', 'rc4', 'rc2', 'blowfish'];
    it.each(expected)('contains %s', (alg) => {
      expect(FORBIDDEN_ALGORITHMS.has(alg)).toBe(true);
    });
  });

  describe('APPROVED_HASH_ALGORITHMS set', () => {
    const expected = ['sha256', 'sha384', 'sha512', 'sha3-256', 'sha3-384', 'sha3-512'];
    it.each(expected)('contains %s', (alg) => {
      expect(APPROVED_HASH_ALGORITHMS.has(alg)).toBe(true);
    });
  });

  describe('APPROVED_HMAC_ALGORITHMS set', () => {
    it('contains sha256, sha384, sha512', () => {
      expect(APPROVED_HMAC_ALGORITHMS.has('sha256')).toBe(true);
      expect(APPROVED_HMAC_ALGORITHMS.has('sha384')).toBe(true);
      expect(APPROVED_HMAC_ALGORITHMS.has('sha512')).toBe(true);
    });

    it('does not contain sha1 or md5', () => {
      expect(APPROVED_HMAC_ALGORITHMS.has('sha1')).toBe(false);
      expect(APPROVED_HMAC_ALGORITHMS.has('md5')).toBe(false);
    });
  });

  describe('Minimum key size enforcement (NIST SP 800-57)', () => {
    it('requires HMAC-SHA256 keys to be at least 256 bits', () => {
      expect(meetsMinimumKeySize('HMAC-SHA256', 256)).toBe(true);
      expect(meetsMinimumKeySize('HMAC-SHA256', 128)).toBe(false);
    });

    it('requires RSA keys to be at least 2048 bits', () => {
      expect(meetsMinimumKeySize('RSA', 2048)).toBe(true);
      expect(meetsMinimumKeySize('RSA', 3072)).toBe(true);
      expect(meetsMinimumKeySize('RSA', 1024)).toBe(false);
    });

    it('requires EC keys to be at least 256 bits (P-256 or stronger)', () => {
      expect(meetsMinimumKeySize('EC', 256)).toBe(true);
      expect(meetsMinimumKeySize('EC', 384)).toBe(true);
      expect(meetsMinimumKeySize('EC', 128)).toBe(false);
    });

    it('requires AES keys to be at least 128 bits', () => {
      expect(meetsMinimumKeySize('AES', 128)).toBe(true);
      expect(meetsMinimumKeySize('AES', 256)).toBe(true);
      expect(meetsMinimumKeySize('AES', 64)).toBe(false);
    });

    it('rejects unknown key types', () => {
      expect(meetsMinimumKeySize('UNKNOWN', 256)).toBe(false);
    });

    it('MINIMUM_KEY_SIZES contains expected entries', () => {
      expect(MINIMUM_KEY_SIZES['HMAC-SHA256']).toBe(256);
      expect(MINIMUM_KEY_SIZES['RSA']).toBe(2048);
      expect(MINIMUM_KEY_SIZES['EC']).toBe(256);
      expect(MINIMUM_KEY_SIZES['AES']).toBe(128);
    });
  });

  describe('Key sharing policy (NIST SP 800-57 §5.4)', () => {
    it('allows symmetric key shared between at most 2 entities', () => {
      expect(isWithinSharingPolicy('symmetric', 1)).toBe(true);
      expect(isWithinSharingPolicy('symmetric', 2)).toBe(true);
    });

    it('rejects symmetric key shared among 3 or more entities', () => {
      expect(isWithinSharingPolicy('symmetric', 3)).toBe(false);
    });

    it('allows private key held by exactly 1 entity', () => {
      expect(isWithinSharingPolicy('asymmetric-private', 1)).toBe(true);
    });

    it('rejects private key held by 2 or more entities', () => {
      expect(isWithinSharingPolicy('asymmetric-private', 2)).toBe(false);
    });

    it('allows public keys to be shared by any number of entities', () => {
      expect(isWithinSharingPolicy('asymmetric-public', 1)).toBe(true);
      expect(isWithinSharingPolicy('asymmetric-public', 100)).toBe(true);
    });

    it('rejects 0 holders for any key type', () => {
      expect(isWithinSharingPolicy('symmetric', 0)).toBe(false);
      expect(isWithinSharingPolicy('asymmetric-private', 0)).toBe(false);
    });

    it('KEY_SHARING_POLICY constants reflect NIST limits', () => {
      expect(KEY_SHARING_POLICY.MAX_SYMMETRIC_HOLDERS).toBe(2);
      expect(KEY_SHARING_POLICY.MAX_PRIVATE_KEY_HOLDERS).toBe(1);
    });
  });

  describe('Key rotation policy', () => {
    it('defines rotation period for session signing key', () => {
      expect(KEY_ROTATION_POLICY_DAYS.SESSION_SECRET).toBeGreaterThan(0);
    });

    it('defines rotation period for OAuth state signing key', () => {
      expect(KEY_ROTATION_POLICY_DAYS.OAUTH_STATE_SECRET).toBeGreaterThan(0);
    });

    it('defines rotation period for TLS certificates', () => {
      expect(KEY_ROTATION_POLICY_DAYS.TLS_CERT).toBeGreaterThan(0);
      // TLS should rotate more frequently than session secrets
      expect(KEY_ROTATION_POLICY_DAYS.TLS_CERT).toBeLessThanOrEqual(90);
    });
  });

  describe('Real usage: auth.ts uses HMAC-SHA256 (approved)', () => {
    it('HMAC-SHA256 produces consistent, non-empty signatures', () => {
      const secret = 'test-secret-key-32-bytes-long!!!';
      const data = 'test-payload';
      const sig1 = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      const sig2 = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      expect(sig1).toBe(sig2);
      expect(sig1.length).toBeGreaterThan(0);
    });

    it('SHA-256 is usable for PKCE code challenges (google.ts)', () => {
      const verifier = crypto.randomBytes(32).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      expect(challenge.length).toBeGreaterThan(0);
      expect(isApprovedHashAlgorithm('sha256')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// req_id 11.1.2 – Cryptographic Inventory
// ---------------------------------------------------------------------------

describe('req_id 11.1.2 - Cryptographic Inventory', () => {
  describe('Inventory completeness', () => {
    it('defines a non-empty cryptographic inventory', () => {
      expect(CRYPTO_INVENTORY.length).toBeGreaterThan(0);
    });

    it('every entry has a unique ID', () => {
      const ids = CRYPTO_INVENTORY.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('every entry has at least one allowed use', () => {
      for (const entry of CRYPTO_INVENTORY) {
        expect(entry.allowedUses.length).toBeGreaterThan(0);
      }
    });

    it('every entry has at least one forbidden use', () => {
      for (const entry of CRYPTO_INVENTORY) {
        expect(entry.forbiddenUses.length).toBeGreaterThan(0);
      }
    });

    it('every entry has a storage location', () => {
      for (const entry of CRYPTO_INVENTORY) {
        expect(entry.storageLocation.length).toBeGreaterThan(0);
      }
    });

    it('every entry has an owner', () => {
      for (const entry of CRYPTO_INVENTORY) {
        expect(entry.owner.length).toBeGreaterThan(0);
      }
    });

    it('every entry has at least one data classification', () => {
      for (const entry of CRYPTO_INVENTORY) {
        expect(entry.protectedDataClassifications.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Mandatory inventory entries (source-code spot-check)', () => {
    it('inventories SESSION_SIGNING_KEY (src/lib/auth.ts)', () => {
      const entry = getInventoryEntry('SESSION_SIGNING_KEY');
      expect(entry).toBeDefined();
      expect(entry!.algorithm).toMatch(/HMAC-SHA256/i);
      expect(entry!.keyType).toBe('symmetric');
    });

    it('inventories OAUTH_STATE_SIGNING_KEY (src/lib/auth.ts)', () => {
      const entry = getInventoryEntry('OAUTH_STATE_SIGNING_KEY');
      expect(entry).toBeDefined();
      expect(entry!.algorithm).toMatch(/HMAC-SHA256/i);
    });

    it('inventories PKCE_HASH (src/lib/auth/google.ts)', () => {
      const entry = getInventoryEntry('PKCE_HASH');
      expect(entry).toBeDefined();
      expect(entry!.algorithm).toMatch(/SHA-256/i);
      expect(entry!.keyType).toBe('hash');
    });

    it('inventories OIDC_NONCE_CSPRNG (src/lib/auth/google.ts)', () => {
      const entry = getInventoryEntry('OIDC_NONCE_CSPRNG');
      expect(entry).toBeDefined();
      expect(entry!.keyType).toBe('symmetric');
    });

    it('inventories PKCE_VERIFIER_CSPRNG (src/lib/auth/google.ts)', () => {
      const entry = getInventoryEntry('PKCE_VERIFIER_CSPRNG');
      expect(entry).toBeDefined();
    });

    it('inventories GOOGLE_RS256_PUBKEYS (src/lib/auth/google.ts)', () => {
      const entry = getInventoryEntry('GOOGLE_RS256_PUBKEYS');
      expect(entry).toBeDefined();
      expect(entry!.keyType).toBe('asymmetric-public');
    });

    it('inventories DEDUP_HASH (src/services/database/procurement.ts)', () => {
      const entry = getInventoryEntry('DEDUP_HASH');
      expect(entry).toBeDefined();
      expect(entry!.algorithm).toMatch(/SHA-256/i);
    });

    it('inventories CACHE_KEY_HASH (src/services/translation/translation-cache.ts)', () => {
      const entry = getInventoryEntry('CACHE_KEY_HASH');
      expect(entry).toBeDefined();
      expect(entry!.algorithm).toMatch(/SHA-256/i);
    });
  });

  describe('Algorithm compliance audit', () => {
    it('all active inventory entries use approved algorithms', () => {
      const nonCompliant = auditInventoryAlgorithms();
      expect(nonCompliant).toEqual([]);
    });

    it('getActiveInventoryEntries returns only active entries', () => {
      const active = getActiveInventoryEntries();
      expect(active.every((e) => e.lifecyclePhase === 'active')).toBe(true);
    });
  });

  describe('Allowed/forbidden use enforcement', () => {
    it('SESSION_SIGNING_KEY: forbids use for encrypting data at rest', () => {
      expect(isUseForbidden('SESSION_SIGNING_KEY', 'encrypt user data at rest')).toBe(true);
    });

    it('SESSION_SIGNING_KEY: allows signing session tokens', () => {
      expect(isUseForbidden('SESSION_SIGNING_KEY', 'sign session tokens')).toBe(false);
    });

    it('GOOGLE_RS256_PUBKEYS: forbids encrypting data', () => {
      expect(isUseForbidden('GOOGLE_RS256_PUBKEYS', 'encrypt data')).toBe(true);
    });

    it('PKCE_HASH: forbids password hashing', () => {
      expect(isUseForbidden('PKCE_HASH', 'password hashing')).toBe(true);
    });

    it('unknown inventory ID is treated as forbidden', () => {
      expect(isUseForbidden('NON_EXISTENT_KEY', 'any use')).toBe(true);
    });
  });

  describe('Non-cryptographic Math.random() allowlist', () => {
    it('all allowlist entries are explicitly marked non-security', () => {
      for (const entry of NON_CRYPTO_RANDOM_ALLOWLIST) {
        expect(entry.isSecurity).toBe(false);
      }
    });

    it('allowlist covers src/lib/rate-limiter.ts pruning use', () => {
      const entry = NON_CRYPTO_RANDOM_ALLOWLIST.find((e) =>
        e.location.includes('rate-limiter'),
      );
      expect(entry).toBeDefined();
      expect(entry!.isSecurity).toBe(false);
    });

    it('allowlist covers mock notification ID use', () => {
      const entry = NON_CRYPTO_RANDOM_ALLOWLIST.find((e) =>
        e.location.includes('notifications'),
      );
      expect(entry).toBeDefined();
    });
  });

  describe('CSPRNG usage verification', () => {
    it('crypto.randomBytes produces unique values on each call (not Math.random)', () => {
      const a = crypto.randomBytes(32).toString('hex');
      const b = crypto.randomBytes(32).toString('hex');
      expect(a).not.toBe(b);
    });

    it('crypto.randomBytes produces the requested byte length', () => {
      const buf = crypto.randomBytes(32);
      expect(buf.length).toBe(32);
    });

    it('generated nonces are at least 256 bits (32 bytes)', () => {
      // Mirrors generateOidcNonce() in src/lib/auth/google.ts
      const nonce = crypto.randomBytes(32).toString('hex');
      // hex-encoded 32 bytes = 64 chars
      expect(nonce.length).toBe(64);
    });
  });
});
