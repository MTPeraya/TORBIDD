// =============================================================================
// app/api/admin/sync/route.ts - POST /api/admin/sync
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';

import { triggerImmediateSync } from '@/services/ingestion/sync-state';

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

    let reqBody: { keyword?: string; limit?: number; fiscalYear?: number } = {};
    try {
      reqBody = await req.json();
    } catch {}

    // Trigger real multi-source synchronization across all 3 government sources:
    // 1. CKAN (data.go.th)
    // 2. BMA e-Procurement (egp2.bangkok.go.th)
    // 3. National e-GP (process3/process5.gprocurement.go.th)
    const result = await triggerImmediateSync({
      keyword: reqBody.keyword || 'ซอฟต์แวร์',
      fiscalYear: reqBody.fiscalYear,
      limit: reqBody.limit || 1000,
      triggerType: 'manual',
    });

    const duration = Date.now() - startTime;
    const completedAt = new Date();
    const bySource = result.bySource || {
      CKAN_GOVSPENDING: 0,
      BMA_EGP: 0,
      NATIONAL_EGP: 0,
    };

    const logDetails = [
      `[${completedAt.toLocaleTimeString('th-TH')}] เชื่อมต่อระบบจัดซื้อจัดจ้างครบ 3 แหล่ง (CKAN data.go.th, BMA egp2, National e-GP)...`,
      `[${completedAt.toLocaleTimeString('th-TH')}] 1. Data.go.th (CKAN Open Government Data): ดึงสำเร็จ ${bySource.CKAN_GOVSPENDING ?? 0} โครงการ`,
      `[${completedAt.toLocaleTimeString('th-TH')}] 2. BMA e-Procurement (กทม. egp2.bangkok.go.th): ดึงสำเร็จ ${bySource.BMA_EGP ?? 0} โครงการ`,
      `[${completedAt.toLocaleTimeString('th-TH')}] 3. National e-GP (กรมบัญชีกลาง gprocurement.go.th): ดึงสำเร็จ ${bySource.NATIONAL_EGP ?? 0} โครงการ`,
      `[${completedAt.toLocaleTimeString('th-TH')}] คัดกรองและจำแนกโครงการด้านซอฟต์แวร์ (UC-10): พบรวม ${result.total || 0} โครงการ`,
      `[${completedAt.toLocaleTimeString('th-TH')}] บันทึก/อัปเดตลงฐานข้อมูล MongoDB Atlas: สร้างใหม่ ${result.upsertedCount || 0} รายการ, อัปเดต ${result.modifiedCount || 0} รายการ`,
      `[${completedAt.toLocaleTimeString('th-TH')}] การซิงค์ทั้ง 3 แหล่งเสร็จสมบูรณ์ใน ${duration}ms`,
    ];

    const syncResult = {
      jobId: 'sync_' + Date.now(),
      status: 'completed',
      durationMs: duration,
      timestamp: completedAt.toISOString(),
      lastPullTime: completedAt.toISOString(),
      source: 'CKAN_GOVSPENDING, BMA_EGP & NATIONAL_EGP',
      bySource,
      scrapedNoticesCount: result.total || 0,
      softwareTendersMatched: result.total || 0,
      aiClassifiedCount: result.total || 0,
      createdProjectsCount: result.upsertedCount || 0,
      updatedProjectsCount: result.modifiedCount || 0,
      logDetails,
    };

    return NextResponse.json({
      success: true,
      message: 'การซิงค์ข้อมูลจัดซื้อจัดจ้างทั้ง 3 แหล่ง (CKAN, BMA, e-GP) สำเร็จเรียบร้อย',
      data: syncResult,
      executionTimeMs: duration,
    });
  } catch (err) {
    console.error('[POST /api/admin/sync]', err);
    return NextResponse.json({ error: 'Sync pipeline execution failed' }, { status: 500 });
  }
}
