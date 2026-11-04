/**
 * @jest-environment node
 */
// =============================================================================
// app/api/admin/__tests__/admin-routes.integration.test.ts
// Integration tests for /api/admin/* endpoints with real signed tokens & Zod validation
// =============================================================================

import { NextRequest } from 'next/server';
import { setupTestDatabase } from '@/test/db-handler';
import { signSession, AUTH_COOKIE_NAME, AuthSessionUser } from '@/lib/auth';

// Route Handlers
import { GET as getStatsHandler } from '../stats/route';
import { GET as getDlqHandler, POST as postDlqHandler } from '../dlq/route';
import { GET as getClassificationQueueHandler } from '../classification-queue/route';
import { POST as postClassifyBulkHandler } from '../classify-bulk/route';
import { GET as getSyncHealthHandler } from '../sync-health/route';
import { GET as getAiProviderHandler, POST as postAiProviderHandler } from '../ai-provider/route';
import { POST as postSyncHandler } from '../sync/route';

import { IngestionService } from '@/services/ingestion/ingestion.service';
import { DiscoveredProject } from '@/types/procurement';

// Mongoose Models
import SyncError from '@/models/SyncError';
import SyncLog from '@/models/SyncLog';
import Project from '@/models/Project';

describe('/api/admin/* Route Handlers Integration', () => {
  setupTestDatabase();

  const originalEnv = process.env;

  const adminUser: AuthSessionUser = {
    id: 'admin_test_01',
    email: 'admin@bma.go.th',
    name: 'Admin Chief',
    picture: 'https://lh3.googleusercontent.com/admin.jpg',
    role: 'admin',
    org: 'BMA Admin Office',
  };

  const regularUser: AuthSessionUser = {
    id: 'user_test_02',
    email: 'contractor@bidding.com',
    name: 'Regular Contractor',
    picture: 'https://lh3.googleusercontent.com/user.jpg',
    role: 'user',
    org: 'Contractor Co.',
  };

  let adminToken: string;
  let userToken: string;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SESSION_SECRET: 'test_admin_session_secret_32bytes_long!',
      ADMIN_EMAILS: 'admin@bma.go.th',
    };
    adminToken = signSession(adminUser);
    userToken = signSession(regularUser);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // Helper to build authenticated admin NextRequest
  function createAdminRequest(
    url: string,
    options: {
      method?: string;
      body?: unknown;
      token?: string;
    } = {},
  ): NextRequest {
    const token = options.token !== undefined ? options.token : adminToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
    }

    return new NextRequest(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  // ─── 1. GET /api/admin/stats ───────────────────────────────────────────────
  describe('GET /api/admin/stats', () => {
    it('returns 403 Forbidden when unauthenticated', async () => {
      const req = createAdminRequest('http://localhost:3000/api/admin/stats', {
        token: '',
      });
      const res = await getStatsHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns 403 Forbidden when authenticated as standard user', async () => {
      const req = createAdminRequest('http://localhost:3000/api/admin/stats', {
        token: userToken,
      });
      const res = await getStatsHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns 200 with stats and database audit logs for authenticated admin', async () => {
      // Seed a sync log in database
      await SyncLog.create({
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        status: 'SUCCESS',
        triggerType: 'manual',
        source: 'CKAN_GOVSPENDING',
        recordsSyncedCount: 15,
        durationMs: 1200,
      });

      const req = createAdminRequest('http://localhost:3000/api/admin/stats');
      const res = await getStatsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.auditLogs).toBeDefined();
      expect(json.data.auditLogs.length).toBeGreaterThanOrEqual(1);
      expect(json.data.auditLogs[0].action).toBe('MANUAL_SYNC');
    });
  });

  // ─── 2. /api/admin/dlq (Dead Letter Queue) ─────────────────────────────────
  describe('/api/admin/dlq', () => {
    it('returns 403 Forbidden for non-admin on GET /api/admin/dlq', async () => {
      const req = createAdminRequest('http://localhost:3000/api/admin/dlq', {
        token: userToken,
      });
      const res = await getDlqHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns 200 with DLQ stats and items from database on GET', async () => {
      await SyncError.create({
        errorCode: 'ERR_TIMEOUT',
        errorMessage: 'Connection timed out',
        source: 'BMA_EGP',
        status: 'PENDING',
        retryCount: 3,
      });

      const req = createAdminRequest('http://localhost:3000/api/admin/dlq?limit=10');
      const res = await getDlqHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.stats.pendingCount).toBe(1);
      expect(json.items).toHaveLength(1);
      expect(json.items[0].errorCode).toBe('ERR_TIMEOUT');
    });

    it('returns 400 on POST when DLQ item id is missing', async () => {
      const req = createAdminRequest('http://localhost:3000/api/admin/dlq', {
        method: 'POST',
        body: { action: 'resolve' }, // missing id
      });
      const res = await postDlqHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toMatch(/Missing or invalid DLQ item ID/i);
    });

    it('updates DLQ item status to RESOLVED in database on POST', async () => {
      const doc = await SyncError.create({
        errorCode: 'ERR_429',
        errorMessage: 'Rate limit hit',
        source: 'CKAN',
        status: 'PENDING',
        retryCount: 1,
      });

      const req = createAdminRequest('http://localhost:3000/api/admin/dlq', {
        method: 'POST',
        body: {
          id: String(doc._id),
          action: 'resolve',
          notes: 'Resolved by admin replay',
          resolvedBy: 'Admin Chief',
        },
      });

      const res = await postDlqHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.item.status).toBe('RESOLVED');

      // Verify in DB
      const updated = await SyncError.findById(doc._id);
      expect(updated?.status).toBe('RESOLVED');
    });
  });

  // ─── 3. GET /api/admin/classification-queue (Zod validation) ───────────────
  describe('GET /api/admin/classification-queue (Zod validation)', () => {
    it('returns 403 Forbidden for non-admin user', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/classification-queue',
        { token: userToken },
      );
      const res = await getClassificationQueueHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns 400 when query parameter fails Zod validation (invalid status)', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/classification-queue?status=INVALID_STATUS',
      );
      const res = await getClassificationQueueHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe('Invalid query parameters');
    });

    it('returns 400 when page parameter is less than 1', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/classification-queue?page=-1',
      );
      const res = await getClassificationQueueHandler(req);
      expect(res.status).toBe(400);
    });

    it('returns 200 with queue items from database on valid query', async () => {
      await Project.create({
        externalId: 77701,
        title: { th: 'โครงการพัฒนาระบบคลัง', en: 'Warehouse System' },
        department: { th: 'สำนักการคลัง', en: 'Finance Bureau' },
        budget: 4500000,
        publishDate: new Date('2026-03-01'),
        deadline: new Date('2026-06-01'),
        category: 'Information System',
        procurementType: 'e-Bidding',
        description: { th: 'รายละเอียด', en: 'Details' },
        scope: { th: ['งานพัฒนาระบบ'], en: ['Development'] },
        qualifications: { th: ['มีใบอนุญาต'], en: ['Licensed'] },
        historicalAvg: 4300000,
        isSoftwareRelated: true,
        classificationReviewStatus: 'PENDING_REVIEW',
      });

      const req = createAdminRequest(
        'http://localhost:3000/api/admin/classification-queue?status=PENDING_REVIEW&page=1&limit=10',
      );
      const res = await getClassificationQueueHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.total).toBe(1);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].externalId).toBe(77701);
    });
  });

  // ─── 4. POST /api/admin/classify-bulk (Zod validation) ─────────────────────
  describe('POST /api/admin/classify-bulk (Zod validation)', () => {
    it('returns 403 Forbidden for non-admin user', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/classify-bulk',
        { method: 'POST', body: { force: true }, token: userToken },
      );
      const res = await postClassifyBulkHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns 400 when body fails Zod validation (limit exceeds 500)', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/classify-bulk',
        { method: 'POST', body: { limit: 9999 } },
      );
      const res = await postClassifyBulkHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe('Invalid request body');
      expect(json.details.fieldErrors.limit).toBeDefined();
    });

    it('returns 200 with message when no projects are pending review', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/classify-bulk',
        { method: 'POST', body: { force: false, limit: 10 } },
      );
      const res = await postClassifyBulkHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.processed).toBe(0);
      expect(json.data.message).toBe('No projects to classify');
    });
  });

  // ─── 5. GET /api/admin/sync-health ─────────────────────────────────────────
  describe('GET /api/admin/sync-health', () => {
    it('returns 403 Forbidden for non-admin user', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/sync-health',
        { token: userToken },
      );
      const res = await getSyncHealthHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns 200 with sync health information for admin user', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/sync-health',
      );
      const res = await getSyncHealthHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.health).toBeDefined();
    });
  });

  // ─── 6. GET & POST /api/admin/ai-provider ──────────────────────────────────
  describe('/api/admin/ai-provider', () => {
    it('returns 403 Forbidden on GET for non-admin user', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/ai-provider',
        { token: userToken },
      );
      const res = await getAiProviderHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns 200 on GET with provider diagnostic data for admin user', async () => {
      const req = createAdminRequest(
        'http://localhost:3000/api/admin/ai-provider',
      );
      const res = await getAiProviderHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.activeProvider).toBeDefined();
      expect(json.data.fallbackChain).toBeDefined();
    });

    it('returns 200 on POST when resetting provider cooldowns or switching provider', async () => {
      const resetReq = createAdminRequest(
        'http://localhost:3000/api/admin/ai-provider',
        { method: 'POST', body: { resetCooldowns: true } },
      );
      const resetRes = await postAiProviderHandler(resetReq);
      expect(resetRes.status).toBe(200);

      const resetJson = await resetRes.json();
      expect(resetJson.success).toBe(true);

      const switchReq = createAdminRequest(
        'http://localhost:3000/api/admin/ai-provider',
        { method: 'POST', body: { provider: 'vertexai' } },
      );
      const switchRes = await postAiProviderHandler(switchReq);
      expect(switchRes.status).toBe(200);

      const switchJson = await switchRes.json();
      expect(switchJson.success).toBe(true);
      expect(switchJson.data.activeProvider).toBeDefined();
    });
  });

  // ─── 7. POST /api/admin/sync ───────────────────────────────────────────────
  describe('POST /api/admin/sync', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const req = createAdminRequest('http://localhost:3000/api/admin/sync', {
        method: 'POST',
        token: '',
      });
      const res = await postSyncHandler(req);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden when authenticated as standard user', async () => {
      const req = createAdminRequest('http://localhost:3000/api/admin/sync', {
        method: 'POST',
        token: userToken,
      });
      const res = await postSyncHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns 200 and triggers immediate sync for admin user', async () => {
      jest
        .spyOn(IngestionService.prototype, 'discoverFromAllSources')
        .mockResolvedValueOnce({
          totalProjects: 6,
          upsertedCount: 4,
          modifiedCount: 2,
          bySource: {
            CKAN_GOVSPENDING: 2,
            BMA_EGP: 2,
            NATIONAL_EGP: 2,
          },
          projects: [
            {
              externalProjectId: '679901',
              projectName: 'Sync Test Project',
              agencyName: 'BMA',
              fiscalYear: 2568,
              source: 'BMA_EGP',
              sourceUrl: 'https://egp2.bangkok.go.th',
            },
          ] as unknown as DiscoveredProject[],
        });

      const req = createAdminRequest('http://localhost:3000/api/admin/sync', {
        method: 'POST',
        body: { keyword: 'ทดสอบ', limit: 5 },
      });
      const res = await postSyncHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('completed');
      expect(json.data.jobId).toBeDefined();
      expect(json.data.logDetails.length).toBeGreaterThan(0);
    });
  });
});
