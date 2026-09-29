// =============================================================================
// services/transformation/normalizers/text-sanitizer.ts
// Sanitizes strings, agency names, and project titles from heterogeneous sources
// =============================================================================

/**
 * Clean and sanitize heterogeneous text strings:
 * - Trims leading and trailing whitespace
 * - Replaces non-breaking spaces (\u00a0) and tabs with standard space
 * - Collapses multiple spaces into a single space
 * - Strips invisible ASCII control characters (0x00 - 0x1F, 0x7F)
 */
export function sanitizeText(text: unknown, fallback = ''): string {
  if (text === null || text === undefined) {
    return fallback;
  }

  // Handle bilingual object: { th?: string; en?: string }
  if (typeof text === 'object') {
    const obj = text as { th?: unknown; en?: unknown };
    if (obj.th) return sanitizeText(obj.th, fallback);
    if (obj.en) return sanitizeText(obj.en, fallback);
    return fallback;
  }

  let str = String(text);

  // Replace non-breaking spaces and tabs
  str = str.replace(/[\u00a0\t\r]+/g, ' ');

  // Strip non-printable ASCII control characters except newline
  // eslint-disable-next-line no-control-regex
  str = str.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');

  // Collapse consecutive spaces
  str = str.replace(/ {2,}/g, ' ');

  str = str.trim();

  return str || fallback;
}

/**
 * Standardize Thai agency names, removing redundant prefixes if requested.
 */
export function sanitizeAgencyName(rawAgency: unknown): string {
  const sanitized = sanitizeText(rawAgency, 'กรุงเทพมหานคร / หน่วยงานภาครัฐ');
  return sanitized;
}
