// =============================================================================
// app/api/ingestion/status/route.ts - GET & POST /api/ingestion/status
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getSyncStatus,
  triggerImmediateSync,
  checkAndAutoSync,
} from '@/services/ingestion/sync-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Proactively check if 5 hours have passed to trigger automatic sync
    checkAndAutoSync().catch((err) => console.warn('[AutoSync Check Error]', err));

    const status = getSyncStatus();
    return NextResponse.json({
      success: true,
      status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Could not retrieve sync status', message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: { keyword?: string; fiscalYear?: number; limit?: number } = {};
    try {
      body = await req.json();
    } catch {}

    const result = await triggerImmediateSync({
      keyword: body.keyword,
      fiscalYear: body.fiscalYear,
      limit: body.limit,
    });

    return NextResponse.json({
      message: 'Sync completed successfully',
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/ingestion/status]', message);

    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed',
        message,
        status: getSyncStatus(),
      },
      { status: 500 },
    );
  }
}
