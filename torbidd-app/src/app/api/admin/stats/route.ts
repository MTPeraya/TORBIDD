// =============================================================================
// app/api/admin/stats/route.ts - GET /api/admin/stats
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminProjectStats } from '@/services/database/projects';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let stats;
    try {
      stats = await getAdminProjectStats();
    } catch {
      stats = {
        totalProjects: 0,
        totalBudget: 0,
        activeProjects: 0,
        aiEnrichedCount: 0,
        categoryCounts: {},
        confidenceCounts: { High: 0, Medium: 0, Low: 0 },
      };
    }

    let auditLogs: Array<{ id: string; action: string; actor: string; details: string; timestamp: string; status: string }> = [];
    let lastSyncTime: string | null = null;

    try {
      const { default: SyncLog } = await import('@/models/SyncLog');
      const recentLogs = await SyncLog.find().sort({ startedAt: -1 }).limit(10).lean();
      if (recentLogs && recentLogs.length > 0) {
        lastSyncTime = (recentLogs[0].completedAt || recentLogs[0].startedAt || new Date()).toISOString();
        auditLogs = recentLogs.map((l) => ({
          id: String(l._id),
          action: l.triggerType === 'manual' ? 'MANUAL_SYNC' : 'SCHEDULED_SYNC',
          actor: l.triggerType === 'manual' ? 'ผู้ดูแลระบบ (Admin)' : 'ระบบอัตโนมัติ (Daemon)',
          details: `ซิงค์ข้อมูล 3 แหล่ง (${l.source || 'CKAN / BMA / e-GP'}): สำเร็จ ${l.recordsSyncedCount || 0} รายการ (ใช้เวลา ${l.durationMs || 0}ms)`,
          timestamp: (l.completedAt || l.startedAt || new Date()).toISOString(),
          status: l.status === 'SUCCESS' ? 'success' : 'error',
        }));
      }
    } catch {}

    if (!lastSyncTime) {
      try {
        const { getSyncStatus } = await import('@/services/ingestion/sync-state');
        const localStatus = getSyncStatus();
        lastSyncTime = localStatus.lastSuccessfulSyncAt || localStatus.lastAttemptAt || null;
      } catch {
        lastSyncTime = null;
      }
    }

    const { getAiClassifierAdapter, FallbackClassifierAdapter } = await import('@/services/ai/adapters');
    const adapter = getAiClassifierAdapter();
    const isFallback = adapter instanceof FallbackClassifierAdapter;
    const activeProvider = adapter.provider;

    let aiProviderName = 'Rule-based Classifier (Keywords)';
    if (activeProvider === 'google-ai-studio') {
      aiProviderName = `Google AI Studio (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`;
    } else if (activeProvider === 'openrouter') {
      aiProviderName = `OpenRouter (${process.env.OPENROUTER_MODEL || 'qwen/qwen3.5-flash-02-23'})`;
    } else if (activeProvider === 'vertexai') {
      aiProviderName = `Vertex AI (${process.env.VERTEX_AI_MODEL || 'gemini-2.0-flash'})`;
    }

    if (isFallback) {
      aiProviderName += ' [Fallback Active: Vertex AI Last]';
    }

    const payload = {
      ...stats,
      systemStatus: {
        database: 'Connected (MongoDB Atlas)',
        aiService: aiProviderName,
        crawler: 'Ready',
        lastSync: lastSyncTime || 'ยังไม่มีการซิงค์ข้อมูล (Never)',
        lastPullTime: lastSyncTime,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      auditLogs,
    };

    return NextResponse.json({ data: payload, success: true });
  } catch (err) {
    console.error('[GET /api/admin/stats]', err);
    return NextResponse.json({ error: 'Failed to retrieve admin stats' }, { status: 500 });
  }
}
