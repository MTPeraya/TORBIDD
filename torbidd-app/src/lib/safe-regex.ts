// =============================================================================
// lib/safe-regex.ts - Regular Expression Escaping & ReDoS Protection
// ASVS V1.2.9: Escape special characters in regular expressions
// ASVS V1.3.12: Prevent exponential backtracking & sanitize untrusted regex input
// =============================================================================

/**
 * Standard regular expression metacharacters defined by ECMAScript:
 * . * + ? ^ $ { } ( ) | [ ] \ /
 */
const REGEX_METACHARACTERS_REGEX = /[.*+?^${}()|[\]\\\/]/g;

/**
 * Maximum safe length for an untrusted search string used inside a regex.
 * Bounding input length prevents high-state memory exhaustion.
 */
export const MAX_REGEX_INPUT_LENGTH = 300;

export interface SafeRegexOptions {
  /**
   * Maximum length allowed for the search term before escaping.
   * Defaults to MAX_REGEX_INPUT_LENGTH (300 chars).
   */
  maxLength?: number;
}

/**
 * Escapes all regular expression metacharacters in a string with a backslash.
 *
 * ASVS V1.2.9: Ensures characters like . * + ? ^ $ ( ) [ ] { } | are treated as
 * literal characters, preventing them from being misinterpreted as regex syntax.
 *
 * @param input The raw input string from untrusted user or external source.
 * @returns The escaped string safe for use in RegExp constructor or MongoDB $regex.
 */
export function escapeRegex(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(REGEX_METACHARACTERS_REGEX, '\\$&');
}

/**
 * Sanitizes and escapes an untrusted search term for use in MongoDB $regex queries.
 *
 * ASVS V1.3.12: Trims whitespace, bounds maximum length to mitigate ReDoS,
 * and escapes all special metacharacters.
 *
 * @param term The user search term.
 * @param options Options including maximum length limit.
 * @returns Escaped, bounded string safe for database $regex queries.
 */
export function sanitizeSearchRegex(
  term: unknown,
  options: SafeRegexOptions = {},
): string {
  if (typeof term !== 'string') {
    return '';
  }

  const { maxLength = MAX_REGEX_INPUT_LENGTH } = options;

  // Trim and clamp to maximum safe length to prevent ReDoS
  const clamped = term.trim().slice(0, maxLength);

  return escapeRegex(clamped);
}

/**
 * Compiles a safe RegExp object from an untrusted user pattern.
 *
 * ASVS V1.2.9 & V1.3.12: Escapes metacharacters to ensure the regex performs
 * strictly literal matching and cannot trigger catastrophic backtracking.
 *
 * @param pattern The untrusted string pattern to match literally.
 * @param flags RegExp flags, e.g. 'i', 'g', 'u'. Defaults to 'i'.
 * @param options Options including maximum length limit.
 * @returns A safe, literal RegExp instance.
 */
export function createSafeRegex(
  pattern: unknown,
  flags: string = 'i',
  options: SafeRegexOptions = {},
): RegExp {
  const sanitized = sanitizeSearchRegex(pattern, options);
  return new RegExp(sanitized, flags);
}
