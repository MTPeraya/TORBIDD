// =============================================================================
// app/api/ingestion/sync/route.ts - POST /api/ingestion/sync
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { triggerImmediateSync, getSyncStatus } from '@/services/ingestion/sync-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = getSyncStatus();
  return NextResponse.json({ success: true, status });
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
      message: 'Immediate procurement sync executed successfully',
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: 'Sync failed', message },
      { status: 500 },
    );
  }
}
