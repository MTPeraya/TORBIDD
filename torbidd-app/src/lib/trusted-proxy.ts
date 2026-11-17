// =============================================================================
// lib/trusted-proxy.ts — Intermediary Header Security & Trusted Client IP
// =============================================================================
// Implements:
// - ASVS req_id 4.1.3: Verify that any HTTP header field used by the application
//   and set by an intermediary layer (load balancer, web proxy, BFF) cannot be
//   overridden by the end-user (e.g., X-Real-IP, X-Forwarded-*, X-User-ID).
// =============================================================================

import net from 'net';
import { isPrivateOrReservedIp } from './ssrf';

/**
 * List of headers reserved for internal system use or set only by trusted intermediaries.
 * If an end-user / untrusted client sends these in a request, they must be stripped
 * to prevent identity spoofing, privilege escalation, or trust boundary bypass.
 */
export const SENSITIVE_INTERMEDIARY_HEADERS = [
  'x-user-id',
  'x-user-email',
  'x-user-role',
  'x-authenticated-user',
  'x-torbidd-admin',
  'x-torbidd-internal',
];

/**
 * Validates whether a string is a syntactically valid IPv4 or IPv6 address.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  return net.isIP(trimmed) !== 0;
}

export interface RequestWithHeaders {
  headers?: {
    get(name: string): string | null;
  };
}

/**
 * Securely extracts the client IP address from request headers without allowing
 * end-user header spoofing (ASVS 4.1.3).
 *
 * Vulnerability prevented:
 *   When an attacker sends `X-Forwarded-For: 1.1.1.1` to a reverse proxy (e.g. Nginx, ALB),
 *   the proxy appends the real remote address: `1.1.1.1, 203.0.113.195`.
 *   A naive implementation reading the leftmost entry (`split(',')[0]`) trusts the attacker's
 *   spoofed IP, defeating IP-based rate limiting, access control, and audit logs.
 *
 * Defense:
 *   1. Direct reverse proxy headers (`cf-connecting-ip`, `x-real-ip`) configured by edge proxies
 *      take precedence if they contain a valid IP.
 *   2. For `X-Forwarded-For`, the entries are evaluated from right to left (most recent proxy hops).
 *   3. All extracted values are validated against RFC IP syntax; invalid or malformed strings
 *      are discarded.
 */
export function getTrustedClientIp(req?: RequestWithHeaders): string {
  if (!req?.headers?.get) return 'unknown';

  // 1. Cloudflare True-Client-IP or CF-Connecting-IP (set by Cloudflare edge)
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp && isValidIp(cfIp)) {
    return cfIp;
  }

  // 2. X-Real-IP (typically set by single reverse proxy / Nginx with $remote_addr)
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  // 3. X-Forwarded-For
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const rawIps = forwarded.split(',').map((s) => s.trim()).filter(Boolean);

    // Filter to only syntactically valid IPs
    const validIps = rawIps.filter(isValidIp);

    if (validIps.length > 0) {
      // Traverse from right to left, skipping trusted private proxy hops (e.g. 10.x, 172.16-31.x, 127.x).
      // The rightmost non-private IP represents the remote client that connected to our trusted proxy.
      for (let i = validIps.length - 1; i >= 0; i--) {
        const ip = validIps[i];
        if (!isPrivateOrReservedIp(ip)) {
          return ip;
        }
      }

      // If all IPs in the chain are private (e.g. local dev, internal test environment),
      // return the first non-proxy client IP or the leftmost entry.
      return validIps[0];
    }
  }

  return 'unknown';
}

/**
 * Sanitizes request headers by stripping end-user supplied internal intermediary headers (ASVS 4.1.3).
 */
export function sanitizeIntermediaryHeaders(headers: { delete(name: string): void }): void {
  for (const headerName of SENSITIVE_INTERMEDIARY_HEADERS) {
    headers.delete(headerName);
  }
}
