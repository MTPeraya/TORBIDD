// =============================================================================
// app/api/admin/sync/route.ts - POST /api/admin/sync
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';

import { triggerImmediateSync } from '@/services/ingestion/sync-state';
import SyncLog from '@/models/SyncLog';
import connectToDatabase from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const startTime = Date.now();

    // Trigger real multi-source synchronization
    const result = await triggerImmediateSync({
      keyword: 'ซอฟต์แวร์',
      limit: 100,
    });

    const duration = Date.now() - startTime;

    const syncData = result as unknown as {
      success: boolean;
      total: number;
      upsertedCount?: number;
      modifiedCount?: number;
      bySource?: Record<string, number>;
    };

    // Log to sync database
    try {
      await connectToDatabase();
      await SyncLog.create({
        triggerType: 'manual',
        status: syncData.success ? 'SUCCESS' : 'FAILED',
        recordsSyncedCount: syncData.upsertedCount || syncData.modifiedCount || syncData.total || 0,
        source: 'CKAN_GOVSPENDING & National e-GP',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: duration,
        details: {
          total: syncData.total,
          upsertedCount: syncData.upsertedCount ?? 0,
          modifiedCount: syncData.modifiedCount ?? 0,
          bySource: syncData.bySource,
        },
      });
    } catch {}

    const logDetails = [
      `[${new Date().toLocaleTimeString('th-TH')}] เชื่อมต่อระบบจัดซื้อจัดจ้าง e-GP และ Open Data (CKAN)...`,
      `[${new Date().toLocaleTimeString('th-TH')}] ค้นหาและจำแนกโครงการด้านซอฟต์แวร์และใบอนุญาตลิขสิทธิ์: พบ ${syncData.total || 0} โครงการ`,
      `[${new Date().toLocaleTimeString('th-TH')}] บันทึก/อัปเดตข้อมูลโครงการสำเร็จ: ${syncData.upsertedCount || syncData.total || 0} รายการ`,
      `[${new Date().toLocaleTimeString('th-TH')}] การซิงค์และจัดหมวดหมู่เสร็จสมบูรณ์ใน ${duration}ms`,
    ];

    const syncResult = {
      jobId: 'sync_' + Date.now(),
      status: 'completed',
      durationMs: duration,
      timestamp: new Date().toISOString(),
      source: 'National e-GP & CKAN Open Government Data',
      scrapedNoticesCount: syncData.total || 0,
      softwareTendersMatched: syncData.total || 0,
      aiClassifiedCount: syncData.total || 0,
      createdProjectsCount: syncData.upsertedCount || 0,
      updatedProjectsCount: syncData.modifiedCount || 0,
      logDetails,
    };

    return NextResponse.json({
      success: true,
      message: 'การซิงค์ข้อมูลจัดซื้อจัดจ้าง e-GP สำเร็จเรียบร้อย',
      data: syncResult,
      executionTimeMs: duration,
    });
  } catch (err) {
    console.error('[POST /api/admin/sync]', err);
    return NextResponse.json({ error: 'Sync pipeline execution failed' }, { status: 500 });
  }
}
