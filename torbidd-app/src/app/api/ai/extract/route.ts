// =============================================================================
// app/api/ai/extract/route.ts - POST /api/ai/extract
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { extractTorFromUrl, extractTorFromBase64 } from '@/services/ai/tor-extractor';
import { AiExtractSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AiExtractSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    let result;
    if (parsed.data.documentUrl) {
      result = await extractTorFromUrl(parsed.data.documentUrl);
    } else if (parsed.data.documentBase64) {
      result = await extractTorFromBase64(parsed.data.documentBase64);
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[POST /api/ai/extract]', err);
    return NextResponse.json({ error: 'TOR extraction failed' }, { status: 500 });
  }
}
