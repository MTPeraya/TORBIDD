// =============================================================================
// lib/fetch-metadata.ts — Sec-Fetch-* Request Header Validation
// =============================================================================
// ASVS req_id 3.5.8: Authenticated resources must only be loadable when the
// request originates from an appropriate context (same-origin navigation or
// an explicit same-site fetch), not from a cross-origin page trying to embed
// user-specific content via <img>, <script>, <iframe> or other sub-resource
// inclusion methods.
//
// This module provides two complementary layers of defence:
//
//  1. validateFetchMetadata(req) — inspects the browser-sent Sec-Fetch-Site /
//     Sec-Fetch-Mode / Sec-Fetch-Dest request headers and returns a 403 when
//     the request comes from an inappropriate cross-origin context.
//
//  2. withCorpHeader(response) — attaches Cross-Origin-Resource-Policy to the
//     response so browsers natively block the response from being read by a
//     cross-origin page even if the server-side check is bypassed (e.g., older
//     browser without Sec-Fetch-* support, or non-browser HTTP client that
//     skips validation).
//
// Usage in an authenticated API route handler:
//
//   import { validateFetchMetadata, withCorpHeader } from '@/lib/fetch-metadata';
//
//   export async function GET(req: NextRequest) {
//     const deny = validateFetchMetadata(req);
//     if (deny) return deny;
//     // ... handler logic ...
//     return withCorpHeader(NextResponse.json(data));
//   }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Allowed values for the Sec-Fetch-Site header as defined in the Fetch spec.
 */
export type SecFetchSite = 'cross-site' | 'same-origin' | 'same-site' | 'none';

/**
 * Allowed values for the Sec-Fetch-Mode header.
 */
export type SecFetchMode =
  | 'cors'
  | 'navigate'
  | 'no-cors'
  | 'same-origin'
  | 'websocket'
  | string;

/**
 * Allowed values for the Sec-Fetch-Dest header (subset of common values).
 */
export type SecFetchDest =
  | 'document'
  | 'embed'
  | 'font'
  | 'frame'
  | 'iframe'
  | 'image'
  | 'manifest'
  | 'object'
  | 'report'
  | 'script'
  | 'serviceworker'
  | 'sharedworker'
  | 'style'
  | 'track'
  | 'video'
  | 'audio'
  | 'worker'
  | 'xslt'
  | 'empty'
  | string;

export interface FetchMetadata {
  site: SecFetchSite | null;
  mode: SecFetchMode | null;
  dest: SecFetchDest | null;
}

// ---------------------------------------------------------------------------
// Cross-Origin-Resource-Policy values
// ---------------------------------------------------------------------------

/**
 * CORP directive values per the Fetch specification.
 *
 * - `same-origin` → the strictest: browser blocks cross-origin reads.
 * - `same-site`   → allows same-site cross-origin reads (e.g. subdomain).
 * - `cross-origin`→ allows any origin to read the response (CDN assets etc.).
 */
export type CorpDirective = 'same-origin' | 'same-site' | 'cross-origin';

// ---------------------------------------------------------------------------
// Header extraction
// ---------------------------------------------------------------------------

/**
 * Reads the three Sec-Fetch-* request headers from an incoming request.
 * Returns null for each header that is absent (non-browser clients, curl, etc.).
 */
export function getFetchMetadata(req: NextRequest): FetchMetadata {
  return {
    site: (req.headers.get('sec-fetch-site') as SecFetchSite | null) ?? null,
    mode: req.headers.get('sec-fetch-mode') as SecFetchMode | null,
    dest: req.headers.get('sec-fetch-dest') as SecFetchDest | null,
  };
}

// ---------------------------------------------------------------------------
// Sec-Fetch-* validation
// ---------------------------------------------------------------------------

/**
 * Validates that an incoming request to an **authenticated resource** endpoint
 * originates from an appropriate browsing context.
 *
 * Policy:
 *   ALLOW when:
 *     - Sec-Fetch-Site is absent (non-browser or old browser — no metadata sent).
 *     - Sec-Fetch-Site is 'none' (direct navigation: address bar, bookmark).
 *     - Sec-Fetch-Site is 'same-origin' (request from the same TORBIDD origin).
 *     - Sec-Fetch-Site is 'same-site' (request from a same-site subdomain).
 *
 *   DENY (returns 403) when:
 *     - Sec-Fetch-Site is 'cross-site' AND the request is a no-cors sub-resource
 *       load (mode: no-cors, dest: image | video | audio | font | script | style),
 *       meaning a third-party page is attempting to embed our authenticated content.
 *
 * Returns null when the request is allowed, or a NextResponse(403) when denied.
 *
 * @param req  Incoming Next.js request.
 */
export function validateFetchMetadata(req: NextRequest): NextResponse | null {
  const { site, mode, dest } = getFetchMetadata(req);

  // If Sec-Fetch-Site is absent the browser is not sending fetch metadata
  // (old browser, non-browser client, server-to-server). Allow through —
  // other auth checks (cookies, session validation) handle these cases.
  if (site === null) return null;

  // Same-origin, same-site, or direct navigation are all safe.
  if (site === 'same-origin' || site === 'same-site' || site === 'none') return null;

  // site === 'cross-site': a foreign origin is making this request.
  // Block sub-resource embeds (no-cors mode) which is how <img src="...">,
  // <video>, <audio>, <script>, <link rel="stylesheet"> embed cross-origin content.
  const EMBED_MODES = new Set(['no-cors']);
  const EMBED_DESTS = new Set([
    'image', 'video', 'audio', 'font', 'script', 'style', 'track',
    'embed', 'object',
  ]);

  if (mode && EMBED_MODES.has(mode) && dest && EMBED_DESTS.has(dest)) {
    return new NextResponse(
      JSON.stringify({ error: 'Cross-origin resource embedding is not permitted.' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Cross-site navigations (mode: navigate) to API endpoints are also suspicious
  // but benign for top-level document loads; allow — CSP and CORP handle these.
  return null;
}

// ---------------------------------------------------------------------------
// Cross-Origin-Resource-Policy response header
// ---------------------------------------------------------------------------

/**
 * Attaches a `Cross-Origin-Resource-Policy` header to a response.
 *
 * ASVS req_id 3.5.8 — instructs the browser to refuse to expose the response
 * body to any cross-origin page, complementing the server-side Sec-Fetch-*
 * validation with a browser-enforced guarantee.
 *
 * @param response  The Next.js response to annotate.
 * @param directive  Defaults to 'same-origin' (most restrictive).
 */
export function withCorpHeader<T extends NextResponse>(
  response: T,
  directive: CorpDirective = 'same-origin',
): T {
  response.headers.set('Cross-Origin-Resource-Policy', directive);
  return response;
}

/**
 * Returns a 403 JSON response indicating a cross-origin embed attempt was blocked.
 * Convenience wrapper for explicit denial in route handlers that bypass
 * validateFetchMetadata (e.g., when custom logic is needed).
 */
export function corpDenyResponse(): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: 'Cross-origin resource embedding is not permitted.' }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    },
  );
}
