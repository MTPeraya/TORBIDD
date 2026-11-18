// =============================================================================
// lib/ssrf.ts - Server-Side Request Forgery (SSRF) Protection (ASVS V1.3.6)
// =============================================================================
// ASVS V1.3.6 Requirement:
// "Verify that the application protects against Server-side Request Forgery (SSRF)
// attacks, by validating untrusted data against an allowlist of protocols,
// domains, paths and ports and sanitizing potentially dangerous characters before
// using the data to call another service."
// =============================================================================

/**
 * Validates whether a string is a valid IPv4 address (Edge & Node compatible).
 */
export function isIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const p = parts[i];
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    if (n < 0 || n > 255) return false;
    if (p.length > 1 && p.startsWith('0')) return false;
  }
  return true;
}

/**
 * Validates whether a string is a valid IPv6 address (Edge & Node compatible).
 */
export function isIPv6(ip: string): boolean {
  if (!ip.includes(':')) return false;
  const parts = ip.split(':');
  if (parts.length < 3 || parts.length > 8) return false;
  return /^[0-9a-fA-F:]+$/.test(ip);
}

/**
 * Standard allowed protocols for external outbound document retrieval.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Standard allowed HTTP ports. Disallows connecting to internal databases
 * or management services (e.g., 27017 for MongoDB, 6379 for Redis, 22 for SSH).
 */
const ALLOWED_PORTS = new Set(['', '80', '443']);

/**
 * Hostnames and domain suffixes permitted for outbound data collection and document processing.
 * Covers Thai Government e-GP, Bangkok Metropolitan Administration, and official Cloud services.
 */
export const DEFAULT_ALLOWED_DOMAINS: readonly string[] = [
  'gprocurement.go.th',
  '.gprocurement.go.th',
  'bangkok.go.th',
  '.bangkok.go.th',
  'data.go.th',
  '.data.go.th',
  'storage.googleapis.com',
  'generativelanguage.googleapis.com',
  'accounts.google.com',
  'oauth2.googleapis.com',
];

export interface SsrfOptions {
  /**
   * Additional domain patterns allowed for document extraction.
   */
  allowedDomains?: string[];
  /**
   * Allow HTTP in addition to HTTPS (default: false in production, true in development).
   */
  allowHttp?: boolean;
}

/**
 * Checks whether an IP address is private, loopback, link-local, or cloud metadata.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // Normalize IPv6-mapped IPv4 e.g. ::ffff:127.0.0.1
  let cleanIp = ip.trim().toLowerCase();
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }

  // Check IPv4
  if (isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map(Number);
    const [p0, p1] = parts;

    // 0.0.0.0/8 (Current network)
    if (p0 === 0) return true;

    // 127.0.0.0/8 (Loopback / localhost)
    if (p0 === 127) return true;

    // 10.0.0.0/8 (Private RFC 1918)
    if (p0 === 10) return true;

    // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 - 172.31.255.255)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

    // 192.168.0.0/16 (Private RFC 1918)
    if (p0 === 192 && p1 === 168) return true;

    // 169.254.0.0/16 (Link-local & Cloud Metadata endpoint 169.254.169.254)
    if (p0 === 169 && p1 === 254) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (p0 >= 224) return true;

    return false;
  }

  // Check IPv6
  if (isIPv6(cleanIp)) {
    if (cleanIp === '::1' || cleanIp === '::') return true; // Loopback / Unspecified
    if (cleanIp.startsWith('fe80:') || cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) {
      return true; // Link-local
    }
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) {
      return true; // Unique local address (ULA)
    }
    return false;
  }

  return false;
}

/**
 * Checks whether a hostname matches any entry in the allowed domain list.
 */
function isDomainAllowed(hostname: string, allowedDomains: readonly string[]): boolean {
  const host = hostname.toLowerCase().trim();

  for (const pattern of allowedDomains) {
    const p = pattern.toLowerCase().trim();
    if (p.startsWith('.')) {
      // Subdomain wildcards e.g. .gprocurement.go.th matches foo.gprocurement.go.th
      if (host.endsWith(p) || host === p.slice(1)) {
        return true;
      }
    } else {
      // Exact domain match
      if (host === p) {
        return true;
      }
    }
  }

  return false;
}

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Validates untrusted URLs against SSRF threats:
 * 1. Protocol allowlist (only http/https)
 * 2. Port allowlist (only standard 80/443)
 * 3. Rejects private IP spaces (127.0.0.1, 10.x, 192.168.x, 169.254.x cloud metadata)
 * 4. Rejects internal hostnames (localhost, *.local, *.internal)
 * 5. Validates hostname against configured domain allowlist
 *
 * ASVS V1.3.6: SSRF Protection
 */
export function validateSafeUrl(
  inputUrl: unknown,
  options: SsrfOptions = {},
): UrlValidationResult {
  if (typeof inputUrl !== 'string' || !inputUrl.trim()) {
    return { valid: false, reason: 'URL must be a non-empty string' };
  }

  const raw = inputUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }

  // 1. Validate Protocol (Disallow file:, gopher:, javascript:, data:, etc.)
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      valid: false,
      reason: `Prohibited URL protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.`,
    };
  }

  if (parsed.protocol === 'http:' && options.allowHttp !== true) {
    return {
      valid: false,
      reason: 'Cleartext HTTP is prohibited for outbound requests; HTTPS is required (SSRF prevention).',
    };
  }

  // 2. Validate Port (Prevent connecting to internal services like 27017, 6379, 22)
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return {
      valid: false,
      reason: `Prohibited port: ${parsed.port}. Only default HTTP(80)/HTTPS(443) ports are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Reject local hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '0.0.0.0'
  ) {
    return {
      valid: false,
      reason: `Access to local/internal hostname "${hostname}" is prohibited (SSRF prevention).`,
    };
  }

  // 4. Reject numeric/octal/decimal obfuscated and private IP addresses
  if (isPrivateOrReservedIp(hostname)) {
    return {
      valid: false,
      reason: `Access to private or reserved IP address "${hostname}" is prohibited (SSRF prevention).`,
    };
  }

  // Check for decimal-encoded IPv4 (e.g. 2130706433 for 127.0.0.1)
  if (/^\d+$/.test(hostname)) {
    return {
      valid: false,
      reason: 'Decimal encoded IP addresses are prohibited (SSRF prevention).',
    };
  }

  // 5. Check domain allowlist
  const envAllowed = (process.env.ALLOWED_DOCUMENT_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const domainAllowlist: string[] = [
    ...DEFAULT_ALLOWED_DOMAINS,
    ...envAllowed,
    ...(options.allowedDomains || []),
  ];

  if (!isDomainAllowed(hostname, domainAllowlist)) {
    return {
      valid: false,
      reason: `Domain "${hostname}" is not in the trusted domain allowlist.`,
    };
  }

  return { valid: true, url: parsed };
}

/**
 * Asserts that a URL is safe against SSRF attacks. Throws an error if invalid.
 */
export function assertSafeUrl(inputUrl: unknown, options?: SsrfOptions): URL {
  const result = validateSafeUrl(inputUrl, options);
  if (!result.valid || !result.url) {
    throw new Error(`[SSRF Blocked] ${result.reason || 'Untrusted URL'}`);
  }
  return result.url;
}
