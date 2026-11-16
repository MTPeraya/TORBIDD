// =============================================================================
// lib/canonicalize.ts - Input Canonicalization Architecture (ASVS V1.1.1)
// =============================================================================
// ASVS V1.1.1 Requirement:
// "Verify that input is decoded or unescaped into a canonical form only once,
// it is only decoded when encoded data in that form is expected, and that this
// is done before processing the input further, for example it is not performed
// after input validation or sanitization."
// =============================================================================

import { z } from 'zod';

/**
 * Regex for dangerous Unicode and control characters that could bypass
 * filters or distort text representation:
 * - \u0000: Null bytes (used for path traversal / string termination bypasses)
 * - \u202A-\u202E, \u2066-\u2069: Bidirectional override and isolate characters
 * - \u200B-\u200D, \uFEFF: Zero-width spaces and invisible joiners (filter evasion)
 */
const STRIP_DANGEROUS_CHARS_REGEX = /[\u0000\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]/g;

export interface CanonicalizeOptions {
  /**
   * Whether to trim leading/trailing whitespace.
   * Defaults to true.
   */
  trim?: boolean;
  /**
   * Whether to strip invisible / bidi control characters.
   * Defaults to true.
   */
  stripControlChars?: boolean;
}

/**
 * Canonicalizes a raw string into standard Unicode Normalization Form C (NFC),
 * strips null bytes and dangerous control characters, and trims whitespace.
 *
 * This provides a deterministic, canonical representation for Thai text,
 * Latin text, and special symbols before validation, hashing, or database queries.
 */
export function canonicalizeString(
  input: unknown,
  options: CanonicalizeOptions = {},
): string {
  if (typeof input !== 'string') {
    return '';
  }

  const { trim = true, stripControlChars = true } = options;

  // 1. Unicode Normalization Form C (canonical decomposition followed by canonical composition)
  // Ensures Thai vowels and tone marks are in canonical ordering (NFC).
  let result = input.normalize('NFC');

  // 2. Strip null bytes and invisible control characters used in evasion attacks
  if (stripControlChars) {
    result = result.replace(STRIP_DANGEROUS_CHARS_REGEX, '');
  }

  // 3. Trim whitespace if requested
  if (trim) {
    result = result.trim();
  }

  return result;
}

/**
 * Deeply canonicalizes all string values within an object, array, or primitive.
 */
export function canonicalizeData<T>(data: T, options?: CanonicalizeOptions): T {
  if (typeof data === 'string') {
    return canonicalizeString(data, options) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => canonicalizeData(item, options)) as unknown as T;
  }

  if (data !== null && typeof data === 'object') {
    const canonicalObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Canonicalize the object key and value
      const canonicalKey = canonicalizeString(key, options);
      canonicalObj[canonicalKey] = canonicalizeData(value, options);
    }
    return canonicalObj as unknown as T;
  }

  return data;
}

/**
 * Helper to build a Zod string schema that canonicalizes input *before*
 * applying any pattern, length, or allowlist checks.
 *
 * ASVS V1.1.1: Canonicalization is performed before further validation.
 */
export function canonicalString<T extends z.ZodTypeAny = z.ZodString>(
  innerSchema: T = z.string() as unknown as T,
  options?: CanonicalizeOptions,
) {
  return z.preprocess((val) => {
    if (typeof val === 'string') {
      return canonicalizeString(val, options);
    }
    return val;
  }, innerSchema);
}
