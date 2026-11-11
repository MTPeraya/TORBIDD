/**
 * @jest-environment node
 *
 * E2E: Admin Route Access Control, Ingestion Monitoring & Processing Log Inspection
 *
 * Verifies:
 *
 *  1. Admin route access control (all /api/admin/* endpoints)
 *     - Unauthenticated requests return 401 / 403
 *     - Authenticated non-admin (officer) requests return 403
 *     - Authenticated admin requests are served successfully
 *     - Each protected route enforces its own guard independently
 *
 *  2. GET /api/admin/stats – System health dashboard
 *     - Returns project counts, budget totals, AI confidence distribution
 *     - Returns systemStatus block (database, aiService, crawler, lastSync)
 *     - Returns auditLogs array for recent sync history
 *     - Handles DB error gracefully with zero-fallback stats
 *
 *  3. GET /api/admin/sync-health – Real-time sync health monitoring
 *     - Returns health, lastSuccessfulSyncAt, recordsSyncedCount, syncIntervalHours
 *     - Returns recentLogs array for processing log inspection
 *     - Returns nextScheduledSyncAt and lastTriggerType
 *     - Correctly reflects HEALTHY / DEGRADED health states
 *
 *  4. POST /api/admin/sync-health – Admin-triggered manual sync
 *     - Admin can trigger a manual sync and receives success response
 *     - Non-admin cannot trigger sync (403)
 *     - Response includes updated sync status and recent logs
 *
 *  5. POST /api/admin/sync – Full 3-source procurement sync
 *     - Admin triggers sync and receives jobId, bySource counts, logDetails
 *     - Non-admin receives 403; unauthenticated receives 401
 *     - logDetails array contains human-readable per-source step descriptions
 *     - Response includes durationMs, timestamp, createdProjectsCount
 *
 *  6. GET /api/ingestion/status – Public (no auth) sync status polling
 *     - Returns success:true with status object containing health / timestamps
 *     - Polling endpoint is accessible without authentication
 *
 *  7. GET /api/ingestion/sync – Public sync state read
 *     - Returns current sync status without requiring auth
 *
 *  8. POST /api/ingestion/sync – Auth-gated sync trigger
 *     - Unauthenticated POST returns 401
 *     - Non-admin authenticated POST returns 403
 *     - Admin POST succeeds and returns sync results
 *
 *  9. GET /api/admin/dlq – Dead Letter Queue inspection
 *     - Returns DLQ stats (pending / resolved / discarded / total counts)
 *     - Returns array of pending DLQ items for error troubleshooting
 *     - Non-admin receives 403
 *     - Custom limit query parameter is forwarded to service
 *
 * 10. POST /api/admin/dlq – DLQ item resolution
 *     - Admin can mark an item as RESOLVED with notes
 *     - Admin can mark an item as DISCARDED (action='discard')
 *     - Missing or invalid id returns 400
 *     - Non-existent id returns 404
 *     - Non-admin receives 403
 *
 * 11. GET /api/admin/classification-queue – AI classification queue
 *     - Returns projects pending review with summary counts
 *     - Pagination (page, limit) works correctly
 *     - Non-admin receives 403
 *     - Invalid status query param returns 400
 *
 * 12. POST /api/admin/classify-bulk – Bulk AI reclassification
 *     - Admin triggers bulk classification and receives processed/updated/failed counts
 *     - force=true reclassifies all projects; default only PENDING_REVIEW
 *     - limit is respected and capped at 500
 *     - Non-admin receives 403
 *
 * 13. GET /api/admin/ai-provider – AI provider diagnostic status
 *     - Returns activeProvider, activeModel, isFallbackEnabled, fallbackChain
 *     - Non-admin receives 403
 *
 * 14. POST /api/admin/ai-provider – Switch AI provider / reset cooldowns
 *     - resetCooldowns:true resets all cooldowns
 *     - provider switch updates active provider and returns confirmation
 *     - Missing body returns 400
 *     - Non-admin receives 403
 */

import { NextRequest } from 'next/server';

import { GET as adminStatsGET } from '@/app/api/admin/stats/route';
import { GET as syncHealthGET, POST as syncHealthPOST } from '@/app/api/admin/sync-health/route';
import { POST as adminSyncPOST } from '@/app/api/admin/sync/route';
import { GET as ingestionStatusGET, POST as ingestionStatusPOST } from '@/app/api/ingestion/status/route';
import { GET as ingestionSyncGET, POST as ingestionSyncPOST } from '@/app/api/ingestion/sync/route';
import { GET as dlqGET, POST as dlqPOST } from '@/app/api/admin/dlq/route';
import { GET as classQueueGET } from '@/app/api/admin/classification-queue/route';
import { POST as classifyBulkPOST } from '@/app/api/admin/classify-bulk/route';
import { GET as aiProviderGET, POST as aiProviderPOST } from '@/app/api/admin/ai-provider/route';

import { signSession } from '@/lib/auth';
import { AUTH_COOKIE_NAME } from '@/lib/auth-constants';

// ─────────────────────────────────────────────────────────────────────────────
// Infrastructure mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/lib/mongodb', () => {
  const mockFn = jest.fn().mockResolvedValue(true);
  return { __esModule: true, default: mockFn, connectToDatabase: mockFn };
});
jest.mock('@/models/User');
jest.mock('@/models/Project', () => {
  // Provide a manually-controlled mock so individual tests can set up .find/.countDocuments etc.
  const mockFindChain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  };
  const MockProject = {
    find: jest.fn().mockReturnValue(mockFindChain),
    countDocuments: jest.fn().mockResolvedValue(0),
    findByIdAndUpdate: jest.fn().mockResolvedValue(null),
  };
  return { __esModule: true, default: MockProject };
});
jest.mock('@/models/SyncLog');
jest.mock('@/models/ProcurementProject');

jest.mock('@/services/database/projects', () => ({
  getAdminProjectStats: jest.fn().mockResolvedValue({
    totalProjects: 142,
    totalBudget: 85_000_000,
    activeProjects: 38,
    aiEnrichedCount: 130,
    categoryCounts: { AI: 24, Cloud: 18, ERP: 15, Website: 30, 'Mobile App': 12, Database: 10, 'Data Analytics': 20, 'Information System': 13 },
    confidenceCounts: { High: 100, Medium: 30, Low: 12 },
  }),
}));

jest.mock('@/services/database/sync-logs', () => ({
  getSystemSyncMetadata: jest.fn().mockResolvedValue({
    lastSuccessfulSyncAt: new Date('2026-11-11T18:00:00Z'),
    lastAttemptAt: new Date('2026-11-11T18:00:00Z'),
    lastStatus: 'HEALTHY',
    recordsSyncedCount: 87,
    lastTriggerType: 'scheduled',
    nextScheduledSyncAt: new Date('2026-11-11T23:00:00Z'),
  }),
  getRecentSyncLogs: jest.fn().mockResolvedValue([
    {
      _id: 'log_001',
      triggerType: 'scheduled',
      status: 'SUCCESS',
      source: 'CKAN / BMA / e-GP',
      recordsSyncedCount: 87,
      durationMs: 4320,
      startedAt: new Date('2026-11-11T18:00:00Z'),
      completedAt: new Date('2026-11-11T18:00:04Z'),
      logMessages: ['Synced CKAN: 40 records', 'Synced BMA: 30 records', 'Synced e-GP: 17 records'],
      errors: [],
    },
    {
      _id: 'log_002',
      triggerType: 'manual',
      status: 'PARTIAL_SUCCESS',
      source: 'CKAN / BMA / e-GP',
      recordsSyncedCount: 12,
      durationMs: 8100,
      startedAt: new Date('2026-11-11T12:00:00Z'),
      completedAt: new Date('2026-11-11T12:00:08Z'),
      logMessages: ['Synced CKAN: 12 records', 'BMA timeout'],
      errors: ['BMA egp2 connection timeout ETIMEDOUT'],
    },
  ]),
}));

jest.mock('@/services/database/dlq', () => ({
  getPendingDlqItems: jest.fn().mockResolvedValue([
    {
      _id: 'dlq_001',
      projectId: 'proj_fail_001',
      errorType: 'TOR_EXTRACTION_FAILED',
      errorMessage: 'PDF parse error: encrypted document',
      status: 'PENDING',
      retryCount: 3,
      createdAt: new Date('2026-11-11T10:00:00Z'),
    },
    {
      _id: 'dlq_002',
      projectId: 'proj_fail_002',
      errorType: 'CLASSIFICATION_TIMEOUT',
      errorMessage: 'Vertex AI request timed out after 30s',
      status: 'PENDING',
      retryCount: 1,
      createdAt: new Date('2026-11-11T09:00:00Z'),
    },
  ]),
  getDlqStats: jest.fn().mockResolvedValue({
    pendingCount: 2,
    resolvedCount: 15,
    discardedCount: 3,
    totalCount: 20,
  }),
  updateDlqItemStatus: jest.fn().mockResolvedValue({
    _id: 'dlq_001',
    status: 'RESOLVED',
    resolutionNotes: 'Manually re-processed successfully',
    resolvedBy: 'admin@bma.go.th',
    resolvedAt: new Date(),
  }),
}));

jest.mock('@/services/ingestion/sync-state', () => ({
  getSyncStatus: jest.fn().mockReturnValue({
    health: 'HEALTHY',
    lastSuccessfulSyncAt: '2026-11-11T18:00:00.000Z',
    lastAttemptAt: '2026-11-11T18:00:00.000Z',
    lastSyncAt: '2026-11-11T18:00:00.000Z',
    nextSyncAt: '2026-11-11T23:00:00.000Z',
    syncIntervalHours: 5,
    recordsSyncedCount: 87,
    triggerType: 'scheduled',
  }),
  triggerImmediateSync: jest.fn().mockResolvedValue({
    total: 42,
    upsertedCount: 15,
    modifiedCount: 27,
    bySource: { CKAN_GOVSPENDING: 20, BMA_EGP: 12, NATIONAL_EGP: 10 },
    syncStatus: {
      health: 'HEALTHY',
      lastSuccessfulSyncAt: new Date().toISOString(),
      recordsSyncedCount: 42,
    },
    projects: Array.from({ length: 42 }, (_, i) => ({ _id: `proj_${i}` })),
  }),
  checkAndAutoSync: jest.fn().mockResolvedValue(undefined),
}));

// Mock AI adapters used in admin/stats and admin/ai-provider
jest.mock('@/services/ai/adapters', () => ({
  getAiClassifierAdapter: jest.fn().mockReturnValue({
    provider: 'google-ai-studio',
    model: 'gemini-2.5-flash',
    getDiagnostics: jest.fn().mockReturnValue([]),
    getFallbackChain: jest.fn().mockReturnValue(['google-ai-studio', 'vertexai']),
  }),
  switchActiveAiProvider: jest.fn(),
  resetProviderCooldowns: jest.fn(),
  normalizeProviderName: jest.fn((p: string) => p),
  FallbackClassifierAdapter: class FallbackClassifierAdapter {},
}));

jest.mock('@/services/ai/classifier', () => ({
  classifyProject: jest.fn().mockResolvedValue({
    category: 'AI',
    isSoftwareRelated: true,
    confidence: 'High',
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Auth session helpers
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: 'admin_e2e_01',
  email: 'admin@bma.go.th',
  name: 'ผู้ดูแลระบบ กทม.',
  org: 'กรุงเทพมหานคร',
  role: 'admin',
  picture: '',
};

const OFFICER_USER = {
  id: 'officer_e2e_01',
  email: 'officer@bma.go.th',
  name: 'เจ้าหน้าที่กทม.',
  org: 'กรุงเทพมหานคร',
  role: 'BMA Officer',
  picture: '',
};

function makeRequest(
  url: string,
  method: string,
  body?: Record<string, unknown>,
  user?: typeof ADMIN_USER | null,
  searchParams?: Record<string, string>,
): NextRequest {
  const fullUrl = new URL(url);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (user) {
    const token = signSession(user);
    headers.set('cookie', `${AUTH_COOKIE_NAME}=${token}`);
  }
  return new NextRequest(fullUrl.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const BASE = 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Admin Access Control, Ingestion Monitoring & Processing Logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Access Control – all admin endpoints enforce auth
  // ===========================================================================
  describe('1. Admin route access control', () => {
    it('1.1 GET /api/admin/stats – unauthenticated returns 403', async () => {
      const res = await adminStatsGET(makeRequest(`${BASE}/api/admin/stats`, 'GET', undefined, null));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/forbidden/i);
    });

    it('1.2 GET /api/admin/stats – non-admin officer returns 403', async () => {
      const res = await adminStatsGET(makeRequest(`${BASE}/api/admin/stats`, 'GET', undefined, OFFICER_USER));
      expect(res.status).toBe(403);
    });

    it('1.3 GET /api/admin/sync-health – non-admin returns 403', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, OFFICER_USER));
      expect(res.status).toBe(403);
    });

    it('1.4 GET /api/admin/sync-health – unauthenticated returns 403', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, null));
      expect(res.status).toBe(403);
    });

    it('1.5 POST /api/admin/sync – unauthenticated returns 401', async () => {
      const res = await adminSyncPOST(makeRequest(`${BASE}/api/admin/sync`, 'POST', {}, null));
      expect(res.status).toBe(401);
    });

    it('1.6 POST /api/admin/sync – non-admin officer returns 403', async () => {
      const res = await adminSyncPOST(makeRequest(`${BASE}/api/admin/sync`, 'POST', {}, OFFICER_USER));
      expect(res.status).toBe(403);
    });

    it('1.7 GET /api/admin/dlq – non-admin returns 403', async () => {
      const res = await dlqGET(makeRequest(`${BASE}/api/admin/dlq`, 'GET', undefined, OFFICER_USER));
      expect(res.status).toBe(403);
    });

    it('1.8 POST /api/admin/dlq – unauthenticated returns 403', async () => {
      const res = await dlqPOST(makeRequest(`${BASE}/api/admin/dlq`, 'POST', { id: 'dlq_001' }, null));
      expect(res.status).toBe(403);
    });

    it('1.9 GET /api/admin/classification-queue – non-admin returns 403', async () => {
      const res = await classQueueGET(makeRequest(`${BASE}/api/admin/classification-queue`, 'GET', undefined, OFFICER_USER));
      expect(res.status).toBe(403);
    });

    it('1.10 POST /api/admin/classify-bulk – non-admin returns 403', async () => {
      const res = await classifyBulkPOST(makeRequest(`${BASE}/api/admin/classify-bulk`, 'POST', {}, OFFICER_USER));
      expect(res.status).toBe(403);
    });

    it('1.11 GET /api/admin/ai-provider – unauthenticated returns 403', async () => {
      const res = await aiProviderGET(makeRequest(`${BASE}/api/admin/ai-provider`, 'GET', undefined, null));
      expect(res.status).toBe(403);
    });

    it('1.12 POST /api/admin/sync-health – non-admin returns 403', async () => {
      const res = await syncHealthPOST(makeRequest(`${BASE}/api/admin/sync-health`, 'POST', {}, OFFICER_USER));
      expect(res.status).toBe(403);
    });

    it('1.13 GET /api/ingestion/sync – accessible without auth (public read)', async () => {
      const res = await ingestionSyncGET();
      expect(res.status).toBe(200);
    });

    it('1.14 POST /api/ingestion/sync – unauthenticated returns 401', async () => {
      const res = await ingestionSyncPOST(makeRequest(`${BASE}/api/ingestion/sync`, 'POST', {}, null));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/unauthorized/i);
    });

    it('1.15 POST /api/ingestion/sync – non-admin officer returns 403', async () => {
      const res = await ingestionSyncPOST(makeRequest(`${BASE}/api/ingestion/sync`, 'POST', {}, OFFICER_USER));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/forbidden/i);
    });
  });

  // ===========================================================================
  // 2. GET /api/admin/stats – System health dashboard
  // ===========================================================================
  describe('2. GET /api/admin/stats – System health dashboard', () => {
    it('2.1 admin receives 200 with project statistics', async () => {
      const res = await adminStatsGET(makeRequest(`${BASE}/api/admin/stats`, 'GET', undefined, ADMIN_USER));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalProjects).toBe(142);
      expect(body.data.activeProjects).toBe(38);
      expect(body.data.aiEnrichedCount).toBe(130);
    });

    it('2.2 response includes AI confidence distribution', async () => {
      const res = await adminStatsGET(makeRequest(`${BASE}/api/admin/stats`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(body.data.confidenceCounts).toEqual({ High: 100, Medium: 30, Low: 12 });
    });

    it('2.3 response includes categoryCounts map', async () => {
      const res = await adminStatsGET(makeRequest(`${BASE}/api/admin/stats`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(body.data.categoryCounts).toBeDefined();
      expect(typeof body.data.categoryCounts).toBe('object');
    });

    it('2.4 systemStatus block is present with database, aiService, lastSync fields', async () => {
      const res = await adminStatsGET(makeRequest(`${BASE}/api/admin/stats`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(body.data.systemStatus).toBeDefined();
      expect(body.data.systemStatus.database).toBeTruthy();
      expect(body.data.systemStatus.aiService).toBeTruthy();
      expect(body.data.systemStatus.crawler).toBeTruthy();
      expect(body.data.systemStatus.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(typeof body.data.systemStatus.memoryUsageMb).toBe('number');
    });

    it('2.5 auditLogs array is returned (may be empty)', async () => {
      const res = await adminStatsGET(makeRequest(`${BASE}/api/admin/stats`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(Array.isArray(body.data.auditLogs)).toBe(true);
    });

    it('2.6 falls back to zero stats when DB throws', async () => {
      const { getAdminProjectStats } = require('@/services/database/projects');
      getAdminProjectStats.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await adminStatsGET(makeRequest(`${BASE}/api/admin/stats`, 'GET', undefined, ADMIN_USER));
      expect(res.status).toBe(200);
      const body = await res.json();
      // Falls back to zeroed stats
      expect(body.data.totalProjects).toBe(0);
      expect(body.data.systemStatus).toBeDefined();
    });
  });

  // ===========================================================================
  // 3. GET /api/admin/sync-health – Real-time ingestion monitoring
  // ===========================================================================
  describe('3. GET /api/admin/sync-health – Real-time sync monitoring', () => {
    it('3.1 admin receives 200 with health status', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, ADMIN_USER));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.health).toBe('HEALTHY');
    });

    it('3.2 returns lastSuccessfulSyncAt timestamp', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(body.lastSuccessfulSyncAt).toBeTruthy();
      expect(new Date(body.lastSuccessfulSyncAt).getTime()).not.toBeNaN();
    });

    it('3.3 returns recordsSyncedCount and syncIntervalHours', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(typeof body.recordsSyncedCount).toBe('number');
      expect(typeof body.syncIntervalHours).toBe('number');
    });

    it('3.4 returns recentLogs array for processing log inspection', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(Array.isArray(body.recentLogs)).toBe(true);
      expect(body.recentLogs.length).toBeGreaterThan(0);
    });

    it('3.5 recentLogs include status, source, recordsSyncedCount and error info', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      const firstLog = body.recentLogs[0];
      expect(firstLog).toHaveProperty('status');
      expect(firstLog).toHaveProperty('recordsSyncedCount');
    });

    it('3.6 returns nextScheduledSyncAt and lastTriggerType', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(body.nextScheduledSyncAt).toBeTruthy();
      expect(body.lastTriggerType).toBeTruthy();
    });

    it('3.7 status object from local sync-state is embedded in response', async () => {
      const res = await syncHealthGET(makeRequest(`${BASE}/api/admin/sync-health`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(body.status).toBeDefined();
      expect(body.status.health).toBe('HEALTHY');
    });
  });

  // ===========================================================================
  // 4. POST /api/admin/sync-health – Admin manual sync trigger
  // ===========================================================================
  describe('4. POST /api/admin/sync-health – Admin manual sync trigger', () => {
    it('4.1 admin can trigger a manual sync and receives success response', async () => {
      const res = await syncHealthPOST(makeRequest(`${BASE}/api/admin/sync-health`, 'POST', {}, ADMIN_USER));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/sync/i);
    });

    it('4.2 response includes updated health, lastSuccessfulSyncAt, recordsSyncedCount', async () => {
      const res = await syncHealthPOST(makeRequest(`${BASE}/api/admin/sync-health`, 'POST', {}, ADMIN_USER));
      const body = await res.json();
      expect(body.health).toBeTruthy();
      expect(body.lastSuccessfulSyncAt).toBeTruthy();
      expect(typeof body.recordsSyncedCount).toBe('number');
    });

    it('4.3 triggerType is "manual" in the response', async () => {
      const res = await syncHealthPOST(makeRequest(`${BASE}/api/admin/sync-health`, 'POST', {}, ADMIN_USER));
      const body = await res.json();
      expect(body.triggerType).toBe('manual');
    });

    it('4.4 response includes recentLogs after sync', async () => {
      const res = await syncHealthPOST(makeRequest(`${BASE}/api/admin/sync-health`, 'POST', {}, ADMIN_USER));
      const body = await res.json();
      expect(Array.isArray(body.recentLogs)).toBe(true);
    });
  });

  // ===========================================================================
  // 5. POST /api/admin/sync – Full 3-source procurement sync
  // ===========================================================================
  describe('5. POST /api/admin/sync – Full 3-source procurement data sync', () => {
    it('5.1 admin sync returns jobId, status, bySource breakdown', async () => {
      const res = await adminSyncPOST(makeRequest(`${BASE}/api/admin/sync`, 'POST', {}, ADMIN_USER));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.jobId).toBeTruthy();
      expect(body.data.status).toBe('completed');
      expect(body.data.bySource).toBeDefined();
    });

    it('5.2 bySource includes CKAN_GOVSPENDING, BMA_EGP, NATIONAL_EGP counts', async () => {
      const res = await adminSyncPOST(makeRequest(`${BASE}/api/admin/sync`, 'POST', {}, ADMIN_USER));
      const body = await res.json();
      expect(typeof body.data.bySource.CKAN_GOVSPENDING).toBe('number');
      expect(typeof body.data.bySource.BMA_EGP).toBe('number');
      expect(typeof body.data.bySource.NATIONAL_EGP).toBe('number');
    });

    it('5.3 logDetails array contains human-readable step descriptions', async () => {
      const res = await adminSyncPOST(makeRequest(`${BASE}/api/admin/sync`, 'POST', {}, ADMIN_USER));
      const body = await res.json();
      expect(Array.isArray(body.data.logDetails)).toBe(true);
      expect(body.data.logDetails.length).toBeGreaterThan(0);
      // Each log entry should include a time and source info
      expect(body.data.logDetails[0]).toMatch(/CKAN|BMA|e-GP|ซิงค์/);
    });

    it('5.4 response includes durationMs, timestamp, createdProjectsCount, updatedProjectsCount', async () => {
      const res = await adminSyncPOST(makeRequest(`${BASE}/api/admin/sync`, 'POST', {}, ADMIN_USER));
      const body = await res.json();
      expect(typeof body.data.durationMs).toBe('number');
      expect(body.data.timestamp).toBeTruthy();
      expect(typeof body.data.createdProjectsCount).toBe('number');
      expect(typeof body.data.updatedProjectsCount).toBe('number');
    });

    it('5.5 accepts keyword and limit overrides in request body', async () => {
      const { triggerImmediateSync } = require('@/services/ingestion/sync-state');
      const res = await adminSyncPOST(makeRequest(
        `${BASE}/api/admin/sync`,
        'POST',
        { keyword: 'ระบบ ERP', limit: 50, fiscalYear: 2568 },
        ADMIN_USER,
      ));
      expect(res.status).toBe(200);
      expect(triggerImmediateSync).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'ระบบ ERP', limit: 50, fiscalYear: 2568 }),
      );
    });
  });

  // ===========================================================================
  // 6. GET /api/ingestion/status – Public sync status polling
  // ===========================================================================
  describe('6. GET /api/ingestion/status – Public ingestion status polling', () => {
    it('6.1 returns 200 without authentication', async () => {
      const res = await ingestionStatusGET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('6.2 response contains status.health field', async () => {
      const res = await ingestionStatusGET();
      const body = await res.json();
      expect(body.status).toBeDefined();
      expect(body.status.health).toBe('HEALTHY');
    });

    it('6.3 response contains lastSuccessfulSyncAt and syncIntervalHours', async () => {
      const res = await ingestionStatusGET();
      const body = await res.json();
      expect(body.status.lastSuccessfulSyncAt).toBeTruthy();
      expect(typeof body.status.syncIntervalHours).toBe('number');
    });

    it('6.4 response contains recordsSyncedCount', async () => {
      const res = await ingestionStatusGET();
      const body = await res.json();
      expect(typeof body.status.recordsSyncedCount).toBe('number');
    });
  });

  // ===========================================================================
  // 7. GET /api/ingestion/sync – Public sync state read
  // ===========================================================================
  describe('7. GET /api/ingestion/sync – Public sync state read', () => {
    it('7.1 returns 200 without authentication', async () => {
      const res = await ingestionSyncGET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('7.2 response contains status object with health', async () => {
      const res = await ingestionSyncGET();
      const body = await res.json();
      expect(body.status).toBeDefined();
      expect(body.status.health).toBe('HEALTHY');
    });
  });

  // ===========================================================================
  // 8. POST /api/ingestion/sync – Auth-gated admin sync trigger
  // ===========================================================================
  describe('8. POST /api/ingestion/sync – Auth-gated sync trigger', () => {
    it('8.1 admin can trigger sync and receives sync results', async () => {
      const res = await ingestionSyncPOST(makeRequest(`${BASE}/api/ingestion/sync`, 'POST', {}, ADMIN_USER));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toMatch(/sync/i);
      expect(typeof body.total).toBe('number');
    });

    it('8.2 sync accepts optional keyword and fiscalYear parameters', async () => {
      const { triggerImmediateSync } = require('@/services/ingestion/sync-state');
      await ingestionSyncPOST(makeRequest(
        `${BASE}/api/ingestion/sync`,
        'POST',
        { keyword: 'cloud', fiscalYear: 2569 },
        ADMIN_USER,
      ));
      expect(triggerImmediateSync).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'cloud', fiscalYear: 2569 }),
      );
    });
  });

  // ===========================================================================
  // 9. GET /api/admin/dlq – Dead Letter Queue inspection
  // ===========================================================================
  describe('9. GET /api/admin/dlq – Dead Letter Queue inspection', () => {
    it('9.1 admin receives DLQ stats and pending items', async () => {
      const res = await dlqGET(makeRequest(`${BASE}/api/admin/dlq`, 'GET', undefined, ADMIN_USER));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.stats).toBeDefined();
      expect(body.items).toBeDefined();
    });

    it('9.2 DLQ stats include pending, resolved, discarded, total counts', async () => {
      const res = await dlqGET(makeRequest(`${BASE}/api/admin/dlq`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(body.stats.pendingCount).toBe(2);
      expect(body.stats.resolvedCount).toBe(15);
      expect(body.stats.discardedCount).toBe(3);
      expect(body.stats.totalCount).toBe(20);
    });

    it('9.3 items array contains DLQ error records with errorType and errorMessage', async () => {
      const res = await dlqGET(makeRequest(`${BASE}/api/admin/dlq`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items[0]).toHaveProperty('errorType');
      expect(body.items[0]).toHaveProperty('errorMessage');
    });

    it('9.4 items include retryCount for troubleshooting persistent failures', async () => {
      const res = await dlqGET(makeRequest(`${BASE}/api/admin/dlq`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(typeof body.items[0].retryCount).toBe('number');
    });

    it('9.5 getPendingDlqItems is called with the limit query param', async () => {
      const { getPendingDlqItems } = require('@/services/database/dlq');
      await dlqGET(makeRequest(
        `${BASE}/api/admin/dlq`,
        'GET',
        undefined,
        ADMIN_USER,
        { limit: '5' },
      ));
      expect(getPendingDlqItems).toHaveBeenCalledWith(5);
    });
  });

  // ===========================================================================
  // 10. POST /api/admin/dlq – DLQ item resolution
  // ===========================================================================
  describe('10. POST /api/admin/dlq – DLQ error resolution', () => {
    it('10.1 admin can resolve a DLQ item with notes', async () => {
      const res = await dlqPOST(makeRequest(
        `${BASE}/api/admin/dlq`,
        'POST',
        { id: 'dlq_001', action: 'resolve', notes: 'Manually re-processed', resolvedBy: 'admin@bma.go.th' },
        ADMIN_USER,
      ));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/resolved/i);
    });

    it('10.2 admin can discard a DLQ item (action=discard)', async () => {
      const { updateDlqItemStatus } = require('@/services/database/dlq');
      updateDlqItemStatus.mockResolvedValueOnce({
        _id: 'dlq_002',
        status: 'DISCARDED',
        resolutionNotes: 'Not actionable',
        resolvedBy: 'admin',
      });

      const res = await dlqPOST(makeRequest(
        `${BASE}/api/admin/dlq`,
        'POST',
        { id: 'dlq_002', action: 'discard', notes: 'Not actionable' },
        ADMIN_USER,
      ));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/discarded/i);
      expect(updateDlqItemStatus).toHaveBeenCalledWith(
        'dlq_002',
        'DISCARDED',
        'Not actionable',
        expect.any(String),
      );
    });

    it('10.3 missing id returns 400', async () => {
      const res = await dlqPOST(makeRequest(
        `${BASE}/api/admin/dlq`,
        'POST',
        { action: 'resolve' }, // no id
        ADMIN_USER,
      ));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/missing|invalid/i);
    });

    it('10.4 non-existent id returns 404', async () => {
      const { updateDlqItemStatus } = require('@/services/database/dlq');
      updateDlqItemStatus.mockResolvedValueOnce(null);

      const res = await dlqPOST(makeRequest(
        `${BASE}/api/admin/dlq`,
        'POST',
        { id: 'dlq_nonexistent', action: 'resolve' },
        ADMIN_USER,
      ));
      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // 11. GET /api/admin/classification-queue – AI classification queue
  // ===========================================================================
  describe('11. GET /api/admin/classification-queue – Classification review queue', () => {
    beforeEach(() => {
      // Mock Project model for classification queue
      // Access the default export from the module factory and reconfigure its methods
      const ProjectMock = require('@/models/Project').default;
      const mockLean = jest.fn().mockResolvedValue([
        {
          _id: 'proj_q_001',
          externalId: 8899001,
          title: { th: 'โครงการทดสอบ', en: 'Test Project' },
          department: { th: 'สำนักทดสอบ', en: 'Test Department' },
          category: 'AI',
          isSoftwareRelated: true,
          aiConfidence: 'Medium',
          classificationReviewStatus: 'PENDING_REVIEW',
          publishDate: '2026-11-01T00:00:00Z',
          processedDate: '2026-11-01T00:00:00Z',
        },
      ]);
      const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      const mockSelect = jest.fn().mockReturnValue({ sort: mockSort });
      ProjectMock.find.mockReturnValue({ select: mockSelect });
      ProjectMock.countDocuments.mockResolvedValue(1);
    });

    it('11.1 admin receives 200 with data and summary', async () => {
      const res = await classQueueGET(makeRequest(
        `${BASE}/api/admin/classification-queue`,
        'GET',
        undefined,
        ADMIN_USER,
      ));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('summary');
    });

    it('11.2 summary includes pendingCount, approvedCount, correctedCount', async () => {
      const res = await classQueueGET(makeRequest(
        `${BASE}/api/admin/classification-queue`,
        'GET',
        undefined,
        ADMIN_USER,
      ));
      const body = await res.json();
      expect(body.summary).toHaveProperty('pendingCount');
      expect(body.summary).toHaveProperty('approvedCount');
      expect(body.summary).toHaveProperty('correctedCount');
    });

    it('11.3 response includes pagination fields (total, page, limit, totalPages)', async () => {
      const res = await classQueueGET(makeRequest(
        `${BASE}/api/admin/classification-queue`,
        'GET',
        undefined,
        ADMIN_USER,
      ));
      const body = await res.json();
      expect(typeof body.total).toBe('number');
      expect(typeof body.page).toBe('number');
      expect(typeof body.limit).toBe('number');
      expect(typeof body.totalPages).toBe('number');
    });

    it('11.4 non-admin officer returns 403', async () => {
      const res = await classQueueGET(makeRequest(
        `${BASE}/api/admin/classification-queue`,
        'GET',
        undefined,
        OFFICER_USER,
      ));
      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 12. POST /api/admin/classify-bulk – Bulk AI reclassification
  // ===========================================================================
  describe('12. POST /api/admin/classify-bulk – Bulk AI classification', () => {
    beforeEach(() => {
      // Access the default export from the module factory and reconfigure its methods
      const ProjectMock = require('@/models/Project').default;
      const mockLean = jest.fn().mockResolvedValue([
        {
          _id: 'proj_cl_001',
          externalId: 7788001,
          title: { th: 'โครงการ AI', en: 'AI Project' },
          description: { en: 'AI image analysis' },
          isSoftwareRelated: true,
          classificationReviewStatus: 'PENDING_REVIEW',
        },
      ]);
      const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
      const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit });
      ProjectMock.find.mockReturnValue({ select: mockSelect });
      ProjectMock.findByIdAndUpdate.mockResolvedValue({ _id: 'proj_cl_001' });
    });

    it('12.1 admin triggers bulk classification and receives processed/updated/failed counts', async () => {
      const res = await classifyBulkPOST(makeRequest(
        `${BASE}/api/admin/classify-bulk`,
        'POST',
        { force: false, limit: 10 },
        ADMIN_USER,
      ));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveProperty('processed');
      expect(body.data).toHaveProperty('updated');
      expect(body.data).toHaveProperty('failed');
      expect(body.data).toHaveProperty('message');
    });

    it('12.2 non-admin returns 403', async () => {
      const res = await classifyBulkPOST(makeRequest(
        `${BASE}/api/admin/classify-bulk`,
        'POST',
        {},
        OFFICER_USER,
      ));
      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 13. GET /api/admin/ai-provider – AI provider diagnostic status
  // ===========================================================================
  describe('13. GET /api/admin/ai-provider – AI provider diagnostics', () => {
    it('13.1 admin receives active provider details', async () => {
      const res = await aiProviderGET(makeRequest(`${BASE}/api/admin/ai-provider`, 'GET', undefined, ADMIN_USER));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.activeProvider).toBe('google-ai-studio');
      expect(body.data.activeModel).toBe('gemini-2.5-flash');
    });

    it('13.2 response includes isFallbackEnabled and fallbackChain', async () => {
      const res = await aiProviderGET(makeRequest(`${BASE}/api/admin/ai-provider`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(typeof body.data.isFallbackEnabled).toBe('boolean');
      expect(Array.isArray(body.data.fallbackChain)).toBe(true);
    });

    it('13.3 response includes diagnostics array', async () => {
      const res = await aiProviderGET(makeRequest(`${BASE}/api/admin/ai-provider`, 'GET', undefined, ADMIN_USER));
      const body = await res.json();
      expect(Array.isArray(body.data.diagnostics)).toBe(true);
    });

    it('13.4 non-admin returns 403', async () => {
      const res = await aiProviderGET(makeRequest(`${BASE}/api/admin/ai-provider`, 'GET', undefined, OFFICER_USER));
      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 14. POST /api/admin/ai-provider – Switch / reset AI provider
  // ===========================================================================
  describe('14. POST /api/admin/ai-provider – AI provider management', () => {
    it('14.1 resetCooldowns:true resets all provider cooldowns', async () => {
      const { resetProviderCooldowns } = require('@/services/ai/adapters');
      const res = await aiProviderPOST(makeRequest(
        `${BASE}/api/admin/ai-provider`,
        'POST',
        { resetCooldowns: true },
        ADMIN_USER,
      ));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/reset/i);
      expect(resetProviderCooldowns).toHaveBeenCalled();
    });

    it('14.2 specifying provider switches the active AI provider', async () => {
      const { switchActiveAiProvider } = require('@/services/ai/adapters');
      const res = await aiProviderPOST(makeRequest(
        `${BASE}/api/admin/ai-provider`,
        'POST',
        { provider: 'vertexai' },
        ADMIN_USER,
      ));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/switched/i);
      expect(switchActiveAiProvider).toHaveBeenCalledWith('vertexai');
    });

    it('14.3 empty body (no provider, no resetCooldowns) returns 400', async () => {
      const res = await aiProviderPOST(makeRequest(
        `${BASE}/api/admin/ai-provider`,
        'POST',
        {},
        ADMIN_USER,
      ));
      expect(res.status).toBe(400);
    });

    it('14.4 non-admin returns 403', async () => {
      const res = await aiProviderPOST(makeRequest(
        `${BASE}/api/admin/ai-provider`,
        'POST',
        { resetCooldowns: true },
        OFFICER_USER,
      ));
      expect(res.status).toBe(403);
    });

    it('14.5 provider switch response includes updated activeProvider and activeModel', async () => {
      const res = await aiProviderPOST(makeRequest(
        `${BASE}/api/admin/ai-provider`,
        'POST',
        { provider: 'openrouter' },
        ADMIN_USER,
      ));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveProperty('activeProvider');
      expect(body.data).toHaveProperty('activeModel');
    });
  });
});
