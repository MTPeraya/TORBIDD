// =============================================================================
// app/api/ingestion/discover/route.ts - POST /api/ingestion/discover
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { IngestionDiscoverSchema } from '@/lib/validation';
import { IngestionService } from '@/services/ingestion/ingestion.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable, uses defaults
    }

    const parsed = IngestionDiscoverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const service = new IngestionService();
    const result = await service.discoverProjects({
      keyword: parsed.data.keyword,
      fiscalYear: parsed.data.fiscalYear,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    return NextResponse.json({
      success: true,
      total: result.total,
      page: result.page,
      limit: result.limit,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
      data: result.projects,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/ingestion/discover]', message);

    if (message.includes('GOVSPENDING_API_KEY is not configured')) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          message: 'GOVSPENDING_API_KEY is missing. Please configure it in .env.local to query live Thai Open Data.',
        },
        { status: 503 },
      );
    }

    if (message.includes('authentication failed')) {
      return NextResponse.json(
        { error: 'Authentication Failed', message },
        { status: 401 },
      );
    }

    if (message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Rate Limit Exceeded', message },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: 'Discovery failed', message },
      { status: 500 },
    );
  }
}
