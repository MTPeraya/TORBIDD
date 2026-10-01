// =============================================================================
// app/api/admin/sync-health/route.ts - GET & POST /api/admin/sync-health
// Dedicated Admin API Endpoint for Synchronization Health & Audit Logs
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSyncStatus, triggerImmediateSync } from '@/services/ingestion/sync-state';
import { getSystemSyncMetadata, getRecentSyncLogs } from '@/services/database/sync-logs';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const localStatus = getSyncStatus();
    const dbMetadata = await getSystemSyncMetadata();
    const recentLogs = await getRecentSyncLogs(10);

    const lastSuccessfulSyncAt =
      dbMetadata?.lastSuccessfulSyncAt?.toISOString() || localStatus.lastSuccessfulSyncAt;
    const lastAttemptAt =
      dbMetadata?.lastAttemptAt?.toISOString() || localStatus.lastAttemptAt;
    const health = dbMetadata?.lastStatus || localStatus.health;
    const recordsSyncedCount = dbMetadata?.recordsSyncedCount ?? localStatus.recordsSyncedCount;
    const lastTriggerType = dbMetadata?.lastTriggerType || localStatus.triggerType;
    const nextScheduledSyncAt =
      dbMetadata?.nextScheduledSyncAt?.toISOString() || localStatus.nextSyncAt;

    let externalSources = null;
    try {
      const { IngestionService } = await import('@/services/ingestion/ingestion.service');
      const ingestionService = new IngestionService();
      externalSources = await ingestionService.checkAllSourcesHealth();
    } catch (sourceErr) {
      console.warn('[SyncHealth] Could not check external sources:', sourceErr);
    }

    return NextResponse.json({
      success: true,
      health,
      lastSuccessfulSyncAt,
      lastAttemptAt,
      recordsSyncedCount,
      lastTriggerType,
      nextScheduledSyncAt,
      syncIntervalHours: localStatus.syncIntervalHours,
      recentLogs,
      status: localStatus,
      externalSources,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: 'Could not retrieve sync health', message },
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

    let body: { keyword?: string; fiscalYear?: number; limit?: number } = {};
    try {
      body = await req.json();
    } catch {}

    const result = await triggerImmediateSync({
      keyword: body.keyword,
      fiscalYear: body.fiscalYear,
      limit: body.limit,
      triggerType: 'manual',
    });

    const recentLogs = await getRecentSyncLogs(5);

    return NextResponse.json({
      success: true,
      message: 'Admin manual synchronization executed successfully',
      health: result.syncStatus.health,
      lastSuccessfulSyncAt: result.syncStatus.lastSuccessfulSyncAt,
      recordsSyncedCount: result.syncStatus.recordsSyncedCount,
      triggerType: 'manual',
      syncStatus: result.syncStatus,
      recentLogs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: 'Admin sync execution failed', message },
      { status: 500 },
    );
  }
}
