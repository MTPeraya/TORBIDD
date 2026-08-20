// =============================================================================
// app/api/historical/route.ts - GET /api/historical
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalProjects } from '@/services/database/historical';
import { HistoricalFiltersSchema } from '@/lib/validation';
import { INITIAL_HISTORICAL } from '@/lib/initialData';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = HistoricalFiltersSchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      const data = await getHistoricalProjects(parsed.data);
      if (data && data.length > 0) {
        return NextResponse.json({ data, total: data.length });
      }
    } catch {}

    return NextResponse.json({ data: INITIAL_HISTORICAL, total: INITIAL_HISTORICAL.length });
  } catch (err) {
    console.error('[GET /api/historical]', err);
    return NextResponse.json({ data: INITIAL_HISTORICAL, total: INITIAL_HISTORICAL.length });
  }
}
