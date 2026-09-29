// =============================================================================
// app/api/admin/sync/route.ts - POST /api/admin/sync
// =============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const startTime = Date.now();

    // Simulated sync pipeline
    const syncResult = {
      jobId: 'sync_' + Date.now(),
      status: 'completed',
      durationMs: 1420,
      timestamp: new Date().toISOString(),
      source: 'Bangkok Metropolitan Administration e-GP Portal (procure.bangkok.go.th)',
      scrapedNoticesCount: 18,
      softwareTendersMatched: 3,
      aiClassifiedCount: 3,
      createdProjectsCount: 1,
      updatedProjectsCount: 2,
      logDetails: [
        'Connecting to BMA e-GP announcement portal...',
        'Fetched 18 latest tender documents and TOR PDFs.',
        'Filtered 3 software & digital service procurement notices.',
        'Triggered Vertex AI Gemini 1.5 Pro clause extraction for qualification requirements.',
        'Project #101: BMA Cyber Defense Center — synchronized.',
        'Project #102: Smart Traffic IoT Telemetry — synchronized.',
        'Data sync job completed successfully.',
      ],
    };

    return NextResponse.json({
      success: true,
      message: 'BMA e-GP sync completed successfully',
      data: syncResult,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[POST /api/admin/sync]', err);
    return NextResponse.json({ error: 'Sync pipeline execution failed' }, { status: 500 });
  }
}
