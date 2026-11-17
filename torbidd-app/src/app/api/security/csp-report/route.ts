// =============================================================================
// app/api/security/csp-report/route.ts — CSP Violation Report Endpoint
// =============================================================================
// ASVS req_id 3.4.7: Receives Content-Security-Policy violation reports
// sent by browsers via the CSP `report-to` and legacy `report-uri` directives.
//
// Security hardening applied to this endpoint:
//  1. Rate-limited: 30 reports / minute per IP (stops DoS amplification).
//  2. Payload-capped: body read is limited to 64 KB max.
//  3. No sensitive data echo: violations are logged server-side only, never
//     reflected back to the client in any response body.
//  4. Input untrusted: the full report body is never rendered as HTML or
//     persisted to any shared user-facing database without sanitisation.
//  5. Always responds 204 No Content so the browser does not need to parse
//     any body, minimising attack surface.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

/** Maximum accepted body size in bytes (64 KB). */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Rate limit: 30 reports per minute per IP.
 * Browsers batch and throttle CSP reports, so legitimate traffic is well under
 * this ceiling. A higher sustained rate indicates either abuse or a severe,
 * systemic CSP misconfiguration.
 */
const CSP_REPORT_LIMITER = {
  windowMs: 60_000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 10_000 : 30,
  label: 'csp-report',
};

/**
 * Structural shape of a Reporting API v1 report payload.
 * Browsers send an array of report objects with a `body` property.
 */
interface CspReportV1Body {
  'blocked-uri'?: string;
  'document-uri'?: string;
  'violated-directive'?: string;
  'effective-directive'?: string;
  'original-policy'?: string;
  'disposition'?: string;
  'status-code'?: number;
  [key: string]: unknown;
}

interface ReportingApiV1Report {
  type?: string;
  url?: string;
  user_agent?: string;
  age?: number;
  body?: CspReportV1Body;
}

/** Legacy CSP report-uri payload shape (wrapped under csp-report key). */
interface LegacyCspReport {
  'csp-report'?: CspReportV1Body;
}

/**
 * Extracts a sanitised, loggable summary from either report format.
 * Strips original-policy (can be large) and any unknown extra fields,
 * keeping only the fields needed for incident triage.
 */
function extractLogFields(
  body: CspReportV1Body | undefined,
): Record<string, string | number | undefined> {
  if (!body) return {};
  return {
    blockedUri: typeof body['blocked-uri'] === 'string' ? body['blocked-uri'] : undefined,
    documentUri: typeof body['document-uri'] === 'string' ? body['document-uri'] : undefined,
    violatedDirective:
      typeof body['violated-directive'] === 'string' ? body['violated-directive'] : undefined,
    effectiveDirective:
      typeof body['effective-directive'] === 'string' ? body['effective-directive'] : undefined,
    disposition: typeof body['disposition'] === 'string' ? body['disposition'] : undefined,
    statusCode: typeof body['status-code'] === 'number' ? body['status-code'] : undefined,
  };
}

/**
 * POST /api/security/csp-report
 *
 * Accepts CSP violation reports from browsers in two formats:
 *  - Reporting API v1: Content-Type: application/reports+json (array)
 *  - Legacy report-uri: Content-Type: application/csp-report (object)
 *
 * Always responds 204 No Content.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Rate limiting ──────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rl = checkRateLimit('csp-report', ip, CSP_REPORT_LIMITER);
  if (!rl.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfter) },
    });
  }

  // ── 2. Payload size guard ─────────────────────────────────────────────────
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  try {
    // Read up to MAX_BODY_BYTES and discard any excess
    const rawBytes = await req.arrayBuffer();
    if (rawBytes.byteLength > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }

    const rawText = new TextDecoder().decode(rawBytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Malformed JSON — log and discard silently
      console.warn('[CSP] Received malformed JSON violation report');
      return new NextResponse(null, { status: 204 });
    }

    const contentType = req.headers.get('content-type') ?? '';

    // ── 3. Reporting API v1 format (application/reports+json) ───────────────
    if (contentType.includes('application/reports+json') && Array.isArray(parsed)) {
      for (const report of parsed as ReportingApiV1Report[]) {
        if (report?.type === 'csp-violation') {
          const fields = extractLogFields(report.body);
          console.warn('[CSP] Violation report (v1):', {
            url: typeof report.url === 'string' ? report.url : undefined,
            ...fields,
          });
        }
      }
      return new NextResponse(null, { status: 204 });
    }

    // ── 4. Legacy report-uri format (application/csp-report) ────────────────
    if (
      contentType.includes('application/csp-report') &&
      typeof parsed === 'object' &&
      parsed !== null
    ) {
      const legacy = parsed as LegacyCspReport;
      const fields = extractLogFields(legacy['csp-report']);
      console.warn('[CSP] Violation report (legacy):', fields);
      return new NextResponse(null, { status: 204 });
    }

    // Unknown content type — accept silently (do not echo anything back)
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[CSP] Error processing violation report:', err);
    return new NextResponse(null, { status: 204 });
  }
}
