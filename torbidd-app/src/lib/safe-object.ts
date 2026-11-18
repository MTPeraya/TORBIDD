// =============================================================================
// lib/safe-object.ts - Prototype Pollution, Parameter Pollution & Safe Object Utilities
// SEC-21: Defensive Coding & Resiliency (OWASP ASVS V15.3.2, V15.3.6, V15.3.7)
// =============================================================================

/**
 * Forbidden prototype-pollution property names.
 */
export const FORBIDDEN_PROTOTYPE_KEYS = Object.freeze([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * ASVS req_id 15.3.6: Checks if a property key is a dangerous prototype pollution vector.
 */
export function isPrototypePollutionKey(key: string): boolean {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  return (
    trimmed === '__proto__' ||
    trimmed === 'constructor' ||
    trimmed === 'prototype'
  );
}

/**
 * Creates an object with a null prototype (no inheritance),
 * completely immune to prototype pollution.
 */
export function createSafeDict<V = unknown>(): Record<string, V> {
  return Object.create(null);
}

/**
 * Recursively deep-sanitizes an object by removing prototype pollution keys
 * (__proto__, constructor, prototype) and returning a clean structure.
 */
export function sanitizeObject<T>(input: T): T {
  if (input === null || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const clean = Object.create(null);
  for (const [key, value] of Object.entries(input)) {
    if (!isPrototypePollutionKey(key)) {
      clean[key] = sanitizeObject(value);
    }
  }

  return clean as T;
}

/**
 * Safely parses JSON string while blocking and stripping any prototype pollution keys.
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    const parsed = JSON.parse(jsonString, (key, value) => {
      if (isPrototypePollutionKey(key)) {
        return undefined; // Strips __proto__, constructor, prototype
      }
      return value;
    });
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/**
 * ASVS req_id 15.3.7: Defends against HTTP Parameter Pollution (HPP).
 * Ensures a single string parameter is extracted regardless of whether
 * an attacker provided an array of duplicated query values (e.g., `?id=1&id=2`).
 */
export function getSafeSingleParam(
  param: string | string[] | null | undefined,
  fallback: string | null = null,
): string | null {
  if (param === null || param === undefined) {
    return fallback;
  }
  if (Array.isArray(param)) {
    // Take first element if array is injected, or return fallback
    const first = param[0];
    return typeof first === 'string' && first.trim().length > 0 ? first.trim() : fallback;
  }
  if (typeof param === 'string') {
    return param.trim().length > 0 ? param.trim() : fallback;
  }
  return fallback;
}

/**
 * ASVS req_id 15.3.2: Defends against open / automatic external redirects.
 * Validates that redirect URLs point to the same origin or approved domains.
 */
export function isSafeRedirectTarget(
  targetUrl: string,
  allowedDomains: string[] = ['localhost', '127.0.0.1', 'torbidd.bangkok.go.th'],
): boolean {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  const trimmed = targetUrl.trim();

  // Relative URLs (starting with '/' but not '//') are safe local redirects
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    // Disallow javascript:, data:, file: schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
