// =============================================================================
// app/api/ai/classify/route.ts - POST /api/ai/classify
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { classifyProject } from '@/services/ai/classifier';
import { AiClassifySchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AiClassifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await classifyProject(parsed.data.title, parsed.data.description);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[POST /api/ai/classify]', err);
    return NextResponse.json({ error: 'AI classification failed' }, { status: 500 });
  }
}
