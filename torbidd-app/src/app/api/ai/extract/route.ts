// =============================================================================
// app/api/ai/extract/route.ts - POST /api/ai/extract
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { extractTorFromUrl, extractTorFromBase64 } from '@/services/ai/tor-extractor';
import { AiExtractSchema } from '@/lib/validation';
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  AI_EXTRACT_LIMITER,
} from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  // ── ASVS req_id 2.4.1: Anti-automation control ─────────────────────────────
  const clientIp = getClientIp(req);
  const rl = checkRateLimit('ai-extract', clientIp, AI_EXTRACT_LIMITER);
  const rlHeaders = rateLimitHeaders(rl, AI_EXTRACT_LIMITER.max);

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'Too many extraction requests. Please wait before submitting again.',
        retryAfter: rl.retryAfter,
      },
      { status: 429, headers: rlHeaders },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();
    const parsed = AiExtractSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400, headers: rlHeaders },
      );
    }

    let result;
    if (parsed.data.documentUrl) {
      result = await extractTorFromUrl(parsed.data.documentUrl);
    } else if (parsed.data.documentBase64) {
      result = await extractTorFromBase64(parsed.data.documentBase64);
    }

    return NextResponse.json({ data: result }, { headers: rlHeaders });
  } catch (err) {
    console.error('[POST /api/ai/extract]', err);
    return NextResponse.json({ error: 'TOR extraction failed' }, { status: 500, headers: rlHeaders });
  }
}
