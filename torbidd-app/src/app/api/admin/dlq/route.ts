// =============================================================================
// app/api/admin/dlq/route.ts - GET & POST /api/admin/dlq
// Admin Endpoint to Inspect and Manage Dead Letter Queue (DLQ) Items
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingDlqItems,
  getDlqStats,
  updateDlqItemStatus,
} from '@/services/database/dlq';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const limit = Number(req.nextUrl.searchParams.get('limit') || 20);
    const [stats, items] = await Promise.all([
      getDlqStats(),
      getPendingDlqItems(limit),
    ]);

    return NextResponse.json({
      success: true,
      stats,
      items,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: 'Could not retrieve DLQ items', message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, notes, resolvedBy } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid DLQ item ID' },
        { status: 400 },
      );
    }

    const targetStatus = action === 'discard' ? 'DISCARDED' : 'RESOLVED';
    const updated = await updateDlqItemStatus(
      id,
      targetStatus,
      notes || 'Resolved via Admin API',
      resolvedBy || 'admin',
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'DLQ item not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `DLQ item marked as ${targetStatus}`,
      item: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: 'Could not update DLQ item', message },
      { status: 500 },
    );
  }
}
