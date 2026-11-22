// =============================================================================
// app/api/ai/extract/route.ts - POST /api/ai/extract
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { extractTorFromUrl, extractTorFromBase64 } from '@/services/ai/tor-extractor';
import { AiExtractSchema } from '@/lib/validation';
import { MAX_PDF_BASE64_LENGTH, PdfSecurityError } from '@/lib/secure-pdf';
import {
  AI_EXTRACT_LIMITER,
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limiter';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { requireAuth } from '@/lib/authorization/backend';

export async function POST(req: NextRequest) {
  // 1. Authenticate user before processing AI extraction (T-01, T-14)
  const authUser = getAuthSessionFromRequest(req);
  const authResult = requireAuth(authUser);
  if (!authResult.ok) {
    return authResult.response;
  }

  // ASVS V2.4.1: Prevent automated extraction abuse and AI quota exhaustion.
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit('ai-extract', clientIp, AI_EXTRACT_LIMITER);
  const responseHeaders = rateLimitHeaders(rateLimit, AI_EXTRACT_LIMITER.max);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many extraction requests. Please wait before submitting again.',
        retryAfter: rateLimit.retryAfter,
      },
      { status: 429, headers: responseHeaders },
    );
  }

  try {
    const contentLength = Number(req.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BASE64_LENGTH + 4096) {
      return NextResponse.json(
        { error: 'PDF payload exceeds the 25 MB limit' },
        { status: 413, headers: responseHeaders },
      );
    }

    const body = await req.json();
    const parsed = AiExtractSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400, headers: responseHeaders },
      );
    }

    let result;
    if (parsed.data.documentUrl) {
      result = await extractTorFromUrl(parsed.data.documentUrl);
    } else if (parsed.data.documentBase64) {
      result = await extractTorFromBase64(parsed.data.documentBase64);
    }

    return NextResponse.json({ data: result }, { headers: responseHeaders });
  } catch (err) {
    console.error('[POST /api/ai/extract]', err);
    if (err instanceof PdfSecurityError) {
      return NextResponse.json(
        { error: err.message },
        {
          status: err.code === 'TOO_LARGE' ? 413 : 400,
          headers: responseHeaders,
        },
      );
    }
    return NextResponse.json(
      { error: 'TOR extraction failed' },
      { status: 500, headers: responseHeaders },
    );
  }
}
