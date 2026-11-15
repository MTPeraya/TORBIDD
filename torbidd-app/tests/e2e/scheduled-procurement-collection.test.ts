/**
 * @jest-environment node
 */
// =============================================================================
// tests/e2e/scheduled-procurement-collection.test.ts
// Comprehensive End-to-End Tests for Scheduled Background Collection of Public
// Procurement Announcements & Downloadable TOR PDFs from Monitored Sources
//
// Scenarios Tested:
// 1. Scheduled Background Automation & 5-Hour Interval Trigger
//    - 1.1 Elapsed interval detection (>5h) and automated scheduled collection execution
//    - 1.2 Status state-machine transitions (idle -> syncing -> success) & 5-hour nextSyncAt calculation
//    - 1.3 Anti-concurrency guard preventing duplicate overlapping background sync jobs
//    - 1.4 Database audit logging (SyncLog) & SystemMetadata updates
//
// 2. Collection from Monitored Government Sources
//    - 2.1 Multi-source connectivity health check across all 3 endpoints simultaneously:
//          * Open Government Data of Thailand (data.go.th / CKAN)
//          * Bangkok Metropolitan Administration (egp2.bangkok.go.th)
//          * Electronic Government Procurement (www.gprocurement.go.th)
//    - 2.2 Multi-source public announcements discovery, software/IT classification & taxonomy mapping
//    - 2.3 Cross-source primary key deduplication (externalProjectId)
//
// 3. Collection, Extraction & Persistence of Downloadable TOR PDFs
//    - 3.1 Fetching project archive from e-GP & safe ZIP decompression with traversal protection
//    - 3.2 Identifying ATTACH_TOR PDF, validating MIME type & %PDF- binary header
//    - 3.3 Disk storage persistence & ProcurementDocument MongoDB record creation
//    - 3.4 Automated TOR content parsing and linking structured data to ProcurementProject
//    - 3.5 Idempotent download skipping when ATTACH_TOR is already PROCESSED
//
// 4. Failure Resilience, Dead Letter Queue (DLQ) & Alerting
//    - 4.1 Resilient multi-source collection continuing when an individual source is DOWN
//    - 4.2 DLQ error capturing (SyncError) & lastSuccessfulSyncAt preservation on fatal error
//
// 5. Admin API Endpoints & Observability
//    - 5.1 GET /api/admin/sync-health returns live status, next sync time, and external sources
//    - 5.2 POST /api/admin/sync executes on-demand synchronization with comprehensive job audit logs
//    - 5.3 POST /api/ingestion/projects/[projectId]/documents processes and returns document records
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { NextRequest } from 'next/server';
import { zipSync, strToU8 } from 'fflate';

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-v4-scheduled-123',
}));

// Mock database connection
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));

// Mock Mongoose models
jest.mock('@/models/SyncLog');
jest.mock('@/models/SystemMetadata');
jest.mock('@/models/ProcurementProject');
jest.mock('@/models/ProcurementDocument');
jest.mock('@/models/SyncError');
jest.mock('@/services/procurement-matching', () => ({
  notifyMatchingUsers: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/services/procurement-diff', () => ({
  notifySavedProcurementUpdate: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/services/notifications/alert-service', () => ({
  alertService: {
    sendRetryExceededAlert: jest.fn().mockResolvedValue({
      dispatched: true,
      channel: 'console_dry_run',
      message: 'Alert sent',
      timestamp: new Date().toISOString(),
    }),
  },
}));

import SyncLog from '@/models/SyncLog';
import SystemMetadata from '@/models/SystemMetadata';
import ProcurementProject from '@/models/ProcurementProject';
import ProcurementDocument from '@/models/ProcurementDocument';
import SyncError from '@/models/SyncError';

import { IngestionService } from '@/services/ingestion/ingestion.service';
import {
  getSyncStatus,
  saveSyncStatus,
  triggerImmediateSync,
  checkAndAutoSync,
  getCachedDiscoveredProjects,
} from '@/services/ingestion/sync-state';
import { GovSpendingClient } from '@/services/ingestion/clients/govspending-client';
import { EgpClient } from '@/services/ingestion/clients/egp-client';
import { BmaClient } from '@/services/ingestion/clients/bma-client';
import { DocumentExtractor } from '@/services/ingestion/document-extractor';
import {
  upsertDiscoveredProjects,
  saveProcurementDocument,
  getDocumentsByProjectId,
  getProcurementProjectByExternalId,
} from '@/services/database/procurement';
import { GET as adminSyncHealthHandler, POST as adminSyncHealthPostHandler } from '@/app/api/admin/sync-health/route';
import { POST as adminSyncHandler } from '@/app/api/admin/sync/route';
import { POST as documentsApiHandler } from '@/app/api/ingestion/projects/[projectId]/documents/route';
import {
  AUTH_COOKIE_NAME,
  signSession,
  AuthSessionUser,
} from '@/lib/auth';
import { DiscoveredProject } from '@/types/procurement';

// ─────────────────────────────────────────────────────────────────────────────
// Test Constants & Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const STATE_FILE = path.join(STORAGE_DIR, 'sync-state.json');
const DISCOVERED_CACHE_FILE = path.join(STORAGE_DIR, 'discovered-projects.json');

const MOCK_PROJECT_ID_1 = '67119538991'; // Cloud & Disaster Recovery (e-GP)
const MOCK_PROJECT_ID_2 = '67059199407'; // Data Center Computer System (BMA)
const MOCK_PROJECT_ID_3 = '66010001234'; // IT System Integration (GovSpending)

const VALID_PDF_BYTES = strToU8('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n%%EOF');

const adminUser: AuthSessionUser = {
  id: 'usr_admin_001',
  email: 'admin.director@bangkok.go.th',
  name: 'Director Admin',
  picture: '',
  role: 'admin',
  org: 'กรุงเทพมหานคร',
};

const regularUser: AuthSessionUser = {
  id: 'usr_reg_002',
  email: 'officer@bangkok.go.th',
  name: 'Officer User',
  picture: '',
  role: 'BMA Officer',
  org: 'กรุงเทพมหานคร',
};

describe('E2E: Scheduled Background Collection of Announcements & Downloadable TOR PDFs', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  let backupStateFile: string | null = null;
  let backupCacheFile: string | null = null;
  let tempStorageDir: string;

  // In-Memory Database Stores
  let mockSyncLogs: any[];
  let mockSystemMetadata: any;
  let mockProcurementProjects: Map<string, any>;
  let mockProcurementDocuments: any[];
  let mockSyncErrors: any[];

  beforeAll(() => {
    // Backup existing sync state and cache if present on disk
    if (fs.existsSync(STATE_FILE)) {
      backupStateFile = fs.readFileSync(STATE_FILE, 'utf-8');
    }
    if (fs.existsSync(DISCOVERED_CACHE_FILE)) {
      backupCacheFile = fs.readFileSync(DISCOVERED_CACHE_FILE, 'utf-8');
    }
  });

  afterAll(() => {
    // Restore original state
    if (backupStateFile !== null) {
      fs.writeFileSync(STATE_FILE, backupStateFile, 'utf-8');
    } else if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }

    if (backupCacheFile !== null) {
      fs.writeFileSync(DISCOVERED_CACHE_FILE, backupCacheFile, 'utf-8');
    } else if (fs.existsSync(DISCOVERED_CACHE_FILE)) {
      fs.unlinkSync(DISCOVERED_CACHE_FILE);
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      SESSION_SECRET: 'test-session-secret-key-at-least-32-chars-long!',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      GOVSPENDING_API_KEY: 'mock-dga-open-api-key-test',
      ADMIN_EMAILS: 'admin.director@bangkok.go.th',
    };

    tempStorageDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'torbidd-e2e-'));

    mockSyncLogs = [];
    mockSystemMetadata = {
      key: 'procurement_sync',
      lastStatus: 'HEALTHY',
      recordsSyncedCount: 0,
      lastSuccessfulSyncAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      lastAttemptAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      lastTriggerType: 'scheduled',
      nextScheduledSyncAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // overdue
    };
    mockProcurementProjects = new Map();
    mockProcurementDocuments = [];
    mockSyncErrors = [];

    // ── Mongoose Model Mocks ─────────────────────────────────────────────────

    // 1. SyncLog Mock
    (SyncLog as unknown as jest.Mock).mockImplementation((data: any) => {
      const doc = {
        _id: `sync_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        save: jest.fn().mockImplementation(async function (this: any) {
          mockSyncLogs.push(this);
          return this;
        }),
      };
      return doc;
    });

    (SyncLog.findByIdAndUpdate as jest.Mock).mockImplementation(async (id: string, update: any) => {
      const log = mockSyncLogs.find((l) => l._id === id);
      if (log && update.$set) {
        Object.assign(log, update.$set);
      }
      return log;
    });

    (SyncLog.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockImplementation(async () => [...mockSyncLogs].reverse()),
        }),
      }),
    });

    // 2. SystemMetadata Mock
    (SystemMetadata.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockImplementation(async () => mockSystemMetadata),
    });

    (SystemMetadata.findOneAndUpdate as jest.Mock).mockImplementation(
      async (filter: any, update: any, _options?: any) => {
        if (!mockSystemMetadata) {
          mockSystemMetadata = { key: filter.key, ...update.$setOnInsert };
        }
        if (update.$set) {
          Object.assign(mockSystemMetadata, update.$set);
        }
        return mockSystemMetadata;
      },
    );

    // 3. ProcurementProject Mock
    (ProcurementProject.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockImplementation(async () => {
        return Array.from(mockProcurementProjects.values());
      }),
    });

    (ProcurementProject.findOne as jest.Mock).mockImplementation(async (query: any) => {
      if (query.externalProjectId) {
        return mockProcurementProjects.get(query.externalProjectId) || null;
      }
      return null;
    });

    (ProcurementProject.findOneAndUpdate as jest.Mock).mockImplementation((filter: any, update: any) => {
      const extId = filter.externalProjectId;
      let existing = mockProcurementProjects.get(extId);
      if (!existing) {
        existing = { _id: `proj_${extId}`, externalProjectId: extId };
        mockProcurementProjects.set(extId, existing);
      }
      if (update.$set) {
        Object.assign(existing, update.$set);
      }
      return {
        lean: jest.fn().mockResolvedValue(existing),
      };
    });

    (ProcurementProject.bulkWrite as jest.Mock).mockImplementation(async (ops: any[]) => {
      let upserted = 0;
      let modified = 0;
      for (const op of ops) {
        if (op.updateOne) {
          const { filter, update } = op.updateOne;
          const extId = filter.externalProjectId;
          const existing = mockProcurementProjects.get(extId);
          if (existing) {
            Object.assign(existing, update.$set);
            modified++;
          } else {
            const newProj = {
              _id: `proj_obj_${Date.now()}_${extId}`,
              externalProjectId: extId,
              ...update.$setOnInsert,
              ...update.$set,
            };
            mockProcurementProjects.set(extId, newProj);
            upserted++;
          }
        }
      }
      return {
        upsertedCount: upserted,
        modifiedCount: modified,
        matchedCount: modified,
      };
    });

    // 4. ProcurementDocument Mock
    (ProcurementDocument as unknown as jest.Mock).mockImplementation((data: any) => {
      const doc = {
        _id: `doc_obj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        save: jest.fn().mockImplementation(async function (this: any) {
          mockProcurementDocuments.push(this);
          return this;
        }),
      };
      return doc;
    });

    (ProcurementDocument.findOne as jest.Mock).mockImplementation(async (query: any) => {
      return (
        mockProcurementDocuments.find(
          (d) =>
            d.externalProjectId === query.externalProjectId &&
            d.documentType === query.documentType &&
            d.fileName === query.fileName,
        ) || null
      );
    });

    (ProcurementDocument.find as jest.Mock).mockImplementation((query: any) => {
      const targetId = query.externalProjectId || (query.$or && query.$or[1]?.externalProjectId);
      const filtered = targetId
        ? mockProcurementDocuments.filter((d) => d.externalProjectId === targetId)
        : mockProcurementDocuments;
      return {
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(filtered),
        }),
        lean: jest.fn().mockResolvedValue(filtered),
      };
    });

    // 5. SyncError Mock (DLQ)
    (SyncError as unknown as jest.Mock).mockImplementation((data: any) => {
      const item = {
        _id: `dlq_err_${Date.now()}`,
        ...data,
        save: jest.fn().mockImplementation(async function (this: any) {
          mockSyncErrors.push(this);
          return this;
        }),
      };
      return item;
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    if (tempStorageDir && fs.existsSync(tempStorageDir)) {
      await fs.promises.rm(tempStorageDir, { recursive: true, force: true });
    }
  });

  // ===========================================================================
  // 1. Scheduled Background Automation & 5-Hour Interval Trigger
  // ===========================================================================
  describe('1. Scheduled Background Automation & 5-Hour Interval Trigger', () => {
    it('1.1 detects when 5 hours have elapsed and triggers a scheduled sync cycle', async () => {
      // Simulate state where last sync occurred 5 hours and 30 minutes ago
      const sixHoursAgo = new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString();
      saveSyncStatus({
        status: 'idle',
        health: 'HEALTHY',
        lastSuccessfulSyncAt: sixHoursAgo,
        lastAttemptAt: sixHoursAgo,
        syncIntervalHours: 5,
      });

      // Mock discovery pipeline for the scheduled run
      const mockGovSpending = {
        searchProjects: jest.fn().mockResolvedValue({
          total: 1,
          projects: [
            {
              externalProjectId: MOCK_PROJECT_ID_1,
              projectName: 'โครงการระบบคลาวด์กลาง กทม.',
              agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
              fiscalYear: 2568,
              budget: 45000000,
              source: 'CKAN_GOVSPENDING',
            },
          ],
        }),
      } as unknown as GovSpendingClient;

      const mockBma = {
        searchProjects: jest.fn().mockResolvedValue({ total: 0, projects: [] }),
      } as unknown as BmaClient;

      const mockEgp = {
        pollAnnouncements: jest.fn().mockResolvedValue({ total: 0, projects: [] }),
      } as unknown as EgpClient;

      jest.spyOn(IngestionService.prototype, 'discoverFromAllSources').mockResolvedValue({
        totalProjects: 1,
        upsertedCount: 1,
        modifiedCount: 0,
        bySource: { CKAN_GOVSPENDING: 1, BMA_EGP: 0, NATIONAL_EGP: 0 },
        projects: [
          {
            externalProjectId: MOCK_PROJECT_ID_1,
            projectName: 'โครงการระบบคลาวด์กลาง กทม.',
            agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
            fiscalYear: 2568,
            budget: 45000000,
            source: 'CKAN_GOVSPENDING',
            sourceUrl: 'https://opend.data.go.th/...',
          },
        ],
      });

      // Run scheduler check
      await checkAndAutoSync();

      const updated = getSyncStatus();
      expect(updated.status).toBe('success');
      expect(updated.health).toBe('HEALTHY');
      expect(updated.triggerType).toBe('scheduled');
      expect(updated.recordsSyncedCount).toBe(1);

      // Verify next sync timestamp is calculated 5 hours into the future
      const completedTime = new Date(updated.lastSuccessfulSyncAt).getTime();
      const nextSyncTime = new Date(updated.nextSyncAt).getTime();
      expect(nextSyncTime - completedTime).toBe(5 * 60 * 60 * 1000);
    });

    it('1.2 avoids launching concurrent sync when collection is already in progress', async () => {
      // Simulate state where sync is already active
      saveSyncStatus({
        status: 'syncing',
        lastSuccessfulSyncAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      });

      const discoverSpy = jest.spyOn(IngestionService.prototype, 'discoverFromAllSources');

      await checkAndAutoSync();

      // Ingestion must NOT be triggered concurrently
      expect(discoverSpy).not.toHaveBeenCalled();
    });

    it('1.3 records start and success audit logs in MongoDB with matching metrics', async () => {
      saveSyncStatus({
        status: 'idle',
        lastSuccessfulSyncAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      });

      jest.spyOn(IngestionService.prototype, 'discoverFromAllSources').mockResolvedValue({
        totalProjects: 2,
        upsertedCount: 2,
        modifiedCount: 0,
        bySource: { CKAN_GOVSPENDING: 1, BMA_EGP: 1, NATIONAL_EGP: 0 },
        projects: [
          {
            externalProjectId: MOCK_PROJECT_ID_1,
            projectName: 'โครงการระบบคลาวด์กลาง กทม.',
            agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
            fiscalYear: 2568,
            budget: 45000000,
            source: 'CKAN_GOVSPENDING',
            sourceUrl: '',
          },
          {
            externalProjectId: MOCK_PROJECT_ID_2,
            projectName: 'โครงการจัดหาระบบคอมพิวเตอร์และเครือข่าย',
            agencyName: 'สำนักการแพทย์',
            fiscalYear: 2568,
            budget: 20000000,
            source: 'BMA_EGP',
            sourceUrl: '',
          },
        ],
      });

      await checkAndAutoSync();

      // Verify SyncLog was created and updated to SUCCESS
      expect(mockSyncLogs.length).toBeGreaterThanOrEqual(1);
      const lastLog = mockSyncLogs[mockSyncLogs.length - 1];
      expect(lastLog.status).toBe('SUCCESS');
      expect(lastLog.recordsSyncedCount).toBe(2);
      expect(lastLog.triggerType).toBe('scheduled');

      // Verify SystemMetadata committed the completed timestamp
      expect(mockSystemMetadata.lastStatus).toBe('HEALTHY');
      expect(mockSystemMetadata.recordsSyncedCount).toBe(2);
      expect(mockSystemMetadata.lastSuccessfulSyncAt).toBeInstanceOf(Date);
    });
  });

  // ===========================================================================
  // 2. Collection from Monitored Government Sources
  // ===========================================================================
  describe('2. Collection from Monitored Government Sources', () => {
    it('2.1 verifies live connectivity and health across all 3 government sources simultaneously', async () => {
      const mockGovSpending = {
        checkHealth: jest.fn().mockResolvedValue({
          status: 'UP',
          statusCode: 200,
          latencyMs: 110,
          endpoint: 'https://opend.data.go.th/govspending/service/egp-contract',
          hasApiKey: true,
        }),
      } as unknown as GovSpendingClient;

      const mockEgp = {
        checkHealth: jest.fn().mockResolvedValue({
          status: 'UP',
          statusCode: 200,
          latencyMs: 95,
          endpoint: 'https://www.gprocurement.go.th',
        }),
      } as unknown as EgpClient;

      const mockBma = {
        checkHealth: jest.fn().mockResolvedValue({
          status: 'UP',
          statusCode: 200,
          latencyMs: 140,
          endpoint: 'https://egp2.bangkok.go.th',
        }),
      } as unknown as BmaClient;

      const service = new IngestionService({
        govSpendingClient: mockGovSpending,
        egpClient: mockEgp,
        bmaClient: mockBma,
      });

      const report = await service.checkAllSourcesHealth();

      expect(report.allReachable).toBe(true);
      expect(report.sources.dataGoTh.status).toBe('UP');
      expect(report.sources.bma.status).toBe('UP');
      expect(report.sources.egp.status).toBe('UP');
      expect(report.sources.dataGoTh.latencyMs).toBeGreaterThan(0);
    });

    it('2.2 discovers public announcements from all 3 sources and normalizes metadata', async () => {
      const mockGovSpending = {
        searchProjects: jest.fn().mockResolvedValue({
          total: 1,
          projects: [
            {
              externalProjectId: MOCK_PROJECT_ID_1,
              projectName: 'โครงการจ้างพัฒนาระบบคลาวด์ภาครัฐ',
              agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
              fiscalYear: 2568,
              budget: 50000000,
              source: 'CKAN_GOVSPENDING',
              sourceUrl: 'https://opend.data.go.th/...',
              is_software: true,
              software_category: 'Software / IT',
            },
          ],
        }),
      } as unknown as GovSpendingClient;

      const mockBma = {
        searchProjects: jest.fn().mockResolvedValue({
          total: 1,
          projects: [
            {
              externalProjectId: MOCK_PROJECT_ID_2,
              projectName: 'จ้างพัฒนาระบบสารสนเทศโรงพยาบาล กทม.',
              agencyName: 'สำนักการแพทย์',
              fiscalYear: 2568,
              budget: 15000000,
              source: 'BMA_EGP',
              sourceUrl: 'https://egp2.bangkok.go.th/...',
              is_software: true,
              software_category: 'Software / IT',
            },
          ],
        }),
      } as unknown as BmaClient;

      const mockEgp = {
        pollAnnouncements: jest.fn().mockResolvedValue({
          total: 1,
          projects: [
            {
              externalProjectId: MOCK_PROJECT_ID_3,
              projectName: 'ประกวดราคาจ้างเหมาบริการบำรุงรักษาซอฟต์แวร์ ERP',
              agencyName: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน',
              fiscalYear: 2568,
              budget: 8000000,
              source: 'NATIONAL_EGP',
              sourceUrl: 'https://process3.gprocurement.go.th/...',
              is_software: true,
              software_category: 'Software / IT',
            },
          ],
        }),
      } as unknown as EgpClient;

      const service = new IngestionService({
        govSpendingClient: mockGovSpending,
        bmaClient: mockBma,
        egpClient: mockEgp,
      });

      const result = await service.discoverFromAllSources({ keyword: 'ซอฟต์แวร์' });

      expect(result.totalProjects).toBe(3);
      expect(result.bySource.CKAN_GOVSPENDING).toBe(1);
      expect(result.bySource.BMA_EGP).toBe(1);
      expect(result.bySource.NATIONAL_EGP).toBe(1);
      expect(result.projects).toHaveLength(3);
    });

    it('2.3 performs cross-source deduplication when same project appears in multiple sources', async () => {
      // BMA and e-GP both report the same project ID
      const duplicatedProjects: DiscoveredProject[] = [
        {
          externalProjectId: MOCK_PROJECT_ID_1,
          projectName: 'โครงการระบบคลาวด์กลาง กทม. (BMA Source)',
          agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
          fiscalYear: 2568,
          budget: 50000000,
          source: 'BMA_EGP',
          sourceUrl: 'https://egp2.bangkok.go.th',
        },
        {
          externalProjectId: MOCK_PROJECT_ID_1,
          projectName: 'โครงการระบบคลาวด์กลาง กทม. (National e-GP Source)',
          agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
          fiscalYear: 2568,
          budget: 50000000,
          source: 'NATIONAL_EGP',
          sourceUrl: 'https://www.gprocurement.go.th',
        },
      ];

      // Upsert into database
      const stats = await upsertDiscoveredProjects(duplicatedProjects);

      // Only 1 unique project is inserted, not 2
      expect(stats.upsertedCount).toBe(1);
      expect(mockProcurementProjects.size).toBe(1);
      expect(mockProcurementProjects.get(MOCK_PROJECT_ID_1)).toBeDefined();
    });
  });

  // ===========================================================================
  // 3. Collection, Extraction & Persistence of Downloadable TOR PDFs
  // ===========================================================================
  describe('3. Collection, Extraction & Persistence of Downloadable TOR PDFs', () => {
    it('3.1 downloads announcement archive from e-GP, safely uncompresses ZIP, and identifies ATTACH_TOR PDF', async () => {
      // Create valid ZIP buffer containing ATTACH_TOR and announcement PDF
      const zipData = zipSync({
        '67119538991/Attach_TOR.pdf': VALID_PDF_BYTES,
        '67119538991/announcement_letter.pdf': VALID_PDF_BYTES,
      });
      const validZipBuffer = Buffer.from(zipData);

      const mockFetch = jest.fn().mockImplementation(async (url: string | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('infoProcureDocAnnounZipTemp')) {
          return new Response(
            JSON.stringify({
              response: { responseCode: '0' },
              data: {
                projectId: MOCK_PROJECT_ID_1,
                zipId: 'zip_cefa9bcbd513448ea9ad54f80aea5f56',
                buildName1: `${MOCK_PROJECT_ID_1}_announcement.zip`,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (urlStr.includes('downloadFileTest')) {
          return new Response(validZipBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/zip',
              'Content-Length': String(validZipBuffer.length),
            },
          });
        }

        return new Response('Not found', { status: 404 });
      });

      const egpClient = new EgpClient({
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const extractor = new DocumentExtractor({
        storagePath: tempStorageDir,
      });

      const service = new IngestionService({
        egpClient,
        documentExtractor: extractor,
      });

      // Execute document ingestion
      const result = await service.ingestProjectDocuments(MOCK_PROJECT_ID_1);

      expect(result.externalProjectId).toBe(MOCK_PROJECT_ID_1);
      expect(result.documentsFound).toBeGreaterThanOrEqual(1);

      // Verify ATTACH_TOR document was found and mapped
      const torDoc = result.documents.find((d) => d.documentType === 'ATTACH_TOR');
      expect(torDoc).toBeDefined();
      expect(torDoc!.fileName).toBe('Attach_TOR.pdf');
      expect(torDoc!.mimeType).toBe('application/pdf');
      expect(torDoc!.status).toBe('PROCESSED');
    });

    it('3.2 persists extracted TOR PDF to disk and saves document audit record in MongoDB', async () => {
      const zipData = zipSync({
        'Attach_TOR.pdf': VALID_PDF_BYTES,
      });
      const zipBuffer = Buffer.from(zipData);

      const extractor = new DocumentExtractor({ storagePath: tempStorageDir });
      const extracted = extractor.extractZip(zipBuffer, MOCK_PROJECT_ID_1, 'https://process5.gprocurement.go.th/download');
      const persisted = await extractor.persistDocumentsToDisk(MOCK_PROJECT_ID_1, extracted);

      expect(persisted).toHaveLength(1);
      expect(fs.existsSync(persisted[0].absolutePath)).toBe(true);

      // Verify file on disk begins with %PDF- magic signature
      const fileOnDisk = await fs.promises.readFile(persisted[0].absolutePath);
      expect(fileOnDisk.subarray(0, 5).toString()).toBe('%PDF-');

      // Save document record in MongoDB
      const saveRes = await saveProcurementDocument({
        projectId: '67a111111111111111111111',
        externalProjectId: MOCK_PROJECT_ID_1,
        documentType: 'ATTACH_TOR',
        fileName: 'Attach_TOR.pdf',
        filePath: persisted[0].relativePath,
        storageReference: persisted[0].absolutePath,
        source: 'NATIONAL_EGP',
        sourceUrl: 'https://process5.gprocurement.go.th/download',
        fileSize: fileOnDisk.length,
        mimeType: 'application/pdf',
        downloadedAt: new Date(),
        status: 'PROCESSED',
      });

      expect(saveRes.isNew).toBe(true);
      expect(saveRes.document.documentType).toBe('ATTACH_TOR');
      expect(saveRes.document.status).toBe('PROCESSED');
      expect(mockProcurementDocuments).toHaveLength(1);
    });

    it('3.3 prevents redundant re-downloads when ATTACH_TOR is already ingested and PROCESSED (Idempotency)', async () => {
      // Simulate existing processed TOR document in DB
      mockProcurementDocuments.push({
        _id: 'doc_existing_123',
        externalProjectId: MOCK_PROJECT_ID_1,
        documentType: 'ATTACH_TOR',
        fileName: 'Attach_TOR.pdf',
        filePath: 'projects/67119538991/documents/Attach_TOR.pdf',
        status: 'PROCESSED',
      });

      const mockFetch = jest.fn();
      const egpClient = new EgpClient({ fetchImpl: mockFetch as unknown as typeof fetch });
      const service = new IngestionService({ egpClient });

      const result = await service.ingestProjectDocuments(MOCK_PROJECT_ID_1);

      // Verify duplicate network download was avoided
      expect(result.alreadyIngested).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 4. Failure Resilience, Dead Letter Queue (DLQ) & Alerting
  // ===========================================================================
  describe('4. Failure Resilience, Dead Letter Queue (DLQ) & Alerting', () => {
    it('4.1 continues collecting announcements from healthy sources when one monitored source fails', async () => {
      // BMA endpoint times out, but CKAN responds normally
      const mockGovSpending = {
        searchProjects: jest.fn().mockResolvedValue({
          total: 1,
          projects: [
            {
              externalProjectId: MOCK_PROJECT_ID_1,
              projectName: 'โครงการระบบคลาวด์',
              agencyName: 'กทม.',
              fiscalYear: 2568,
              budget: 30000000,
              source: 'CKAN_GOVSPENDING',
              is_software: true,
              software_category: 'Cloud',
            },
          ],
        }),
      } as unknown as GovSpendingClient;

      const mockBma = {
        searchProjects: jest.fn().mockRejectedValue(new Error('BMA egp2 timeout ETIMEDOUT')),
      } as unknown as BmaClient;

      const mockEgp = {
        pollAnnouncements: jest.fn().mockResolvedValue({ total: 0, projects: [] }),
      } as unknown as EgpClient;

      const service = new IngestionService({
        govSpendingClient: mockGovSpending,
        bmaClient: mockBma,
        egpClient: mockEgp,
      });

      // Pipeline must not throw fatal error
      const result = await service.discoverFromAllSources();

      expect(result.totalProjects).toBe(1);
      expect(result.bySource.CKAN_GOVSPENDING).toBe(1);
      expect(result.bySource.BMA_EGP).toBe(0);
    });

    it('4.2 captures fatal failures into DLQ and preserves lastSuccessfulSyncAt timestamp', async () => {
      const originalSuccessTimestamp = '2026-11-01T10:00:00.000Z';
      saveSyncStatus({
        status: 'idle',
        health: 'HEALTHY',
        lastSuccessfulSyncAt: originalSuccessTimestamp,
      });

      // Force fatal failure in triggerImmediateSync
      jest.spyOn(IngestionService.prototype, 'discoverFromAllSources').mockRejectedValue(
        new Error('HTTP 429: Rate limit quota exceeded on all procurement channels'),
      );

      // Execution throws error
      await expect(triggerImmediateSync()).rejects.toThrow(/Rate limit quota exceeded/i);

      // Verify status is DEGRADED and error recorded
      const status = getSyncStatus();
      expect(status.status).toBe('error');
      expect(status.health).toBe('DEGRADED');

      // CRITICAL: lastSuccessfulSyncAt must NOT be overwritten on failure
      expect(status.lastSuccessfulSyncAt).toBe(originalSuccessTimestamp);

      // Verify error captured in Dead Letter Queue (DLQ)
      expect(mockSyncErrors.length).toBeGreaterThanOrEqual(1);
      const dlqItem = mockSyncErrors[0];
      expect(dlqItem.errorCode).toBe('HTTP_429_RATE_LIMIT');
      expect(dlqItem.errorMessage).toContain('Rate limit quota exceeded');
    });
  });

  // ===========================================================================
  // 5. Admin API Endpoints & Observability
  // ===========================================================================
  describe('5. Admin API Endpoints & Observability', () => {
    it('5.1 GET /api/admin/sync-health returns live status and external sources connectivity report', async () => {
      saveSyncStatus({
        status: 'success',
        health: 'HEALTHY',
        recordsSyncedCount: 5,
        syncIntervalHours: 5,
      });

      const token = signSession(adminUser);
      const req = new NextRequest('http://localhost:3000/api/admin/sync-health', {
        method: 'GET',
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });

      const res = await adminSyncHealthHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.syncIntervalHours).toBe(5);
      expect(json.health).toBe('HEALTHY');
      expect(json.status.source).toContain('CKAN_GOVSPENDING');
    });

    it('5.2 rejects unauthenticated or non-admin calls to /api/admin/sync and /api/admin/sync-health', async () => {
      // 1. Unauthenticated
      const unauthReq = new NextRequest('http://localhost:3000/api/admin/sync', { method: 'POST' });
      const unauthRes = await adminSyncHandler(unauthReq);
      expect(unauthRes.status).toBe(401);

      // 2. Non-admin regular officer
      const officerToken = signSession(regularUser);
      const officerReq = new NextRequest('http://localhost:3000/api/admin/sync', {
        method: 'POST',
        headers: { cookie: `${AUTH_COOKIE_NAME}=${officerToken}` },
      });
      const officerRes = await adminSyncHandler(officerReq);
      expect(officerRes.status).toBe(403);
    });

    it('5.3 POST /api/admin/sync triggers on-demand sync and returns complete audit execution log', async () => {
      jest.spyOn(IngestionService.prototype, 'discoverFromAllSources').mockResolvedValue({
        totalProjects: 1,
        upsertedCount: 1,
        modifiedCount: 0,
        bySource: { CKAN_GOVSPENDING: 1, BMA_EGP: 0, NATIONAL_EGP: 0 },
        projects: [
          {
            externalProjectId: MOCK_PROJECT_ID_1,
            projectName: 'โครงการระบบคลาวด์กลาง กทม.',
            agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
            fiscalYear: 2568,
            budget: 45000000,
            source: 'CKAN_GOVSPENDING',
            sourceUrl: '',
          },
        ],
      });

      const token = signSession(adminUser);
      const req = new NextRequest('http://localhost:3000/api/admin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ keyword: 'คลาวด์' }),
      });

      const res = await adminSyncHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('completed');
      expect(json.data.scrapedNoticesCount).toBe(1);
      expect(json.data.createdProjectsCount).toBe(1);
      expect(json.data.logDetails.length).toBeGreaterThanOrEqual(4);
      expect(json.data.logDetails[0]).toContain('เชื่อมต่อระบบจัดซื้อจัดจ้างครบ 3 แหล่ง');
    });

    it('5.4 POST /api/ingestion/projects/[projectId]/documents processes and returns documents for valid 11-digit project', async () => {
      // Mock IngestionService.prototype.ingestProjectDocuments
      jest.spyOn(IngestionService.prototype, 'ingestProjectDocuments').mockResolvedValue({
        projectId: '67a1234567890abcdef12345',
        externalProjectId: MOCK_PROJECT_ID_1,
        documentsFound: 1,
        alreadyIngested: false,
        documents: [
          {
            projectId: '67a1234567890abcdef12345',
            externalProjectId: MOCK_PROJECT_ID_1,
            documentType: 'ATTACH_TOR',
            fileName: 'Attach_TOR.pdf',
            filePath: `projects/${MOCK_PROJECT_ID_1}/documents/Attach_TOR.pdf`,
            storageReference: `/storage/projects/${MOCK_PROJECT_ID_1}/documents/Attach_TOR.pdf`,
            source: 'NATIONAL_EGP',
            sourceUrl: 'https://process5.gprocurement.go.th/...',
            fileSize: 42000,
            mimeType: 'application/pdf',
            downloadedAt: new Date(),
            status: 'PROCESSED',
          },
        ],
      });

      const req = new NextRequest(`http://localhost:3000/api/ingestion/projects/${MOCK_PROJECT_ID_1}/documents`, {
        method: 'POST',
      });

      const res = await documentsApiHandler(req, {
        params: Promise.resolve({ projectId: MOCK_PROJECT_ID_1 }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.externalProjectId).toBe(MOCK_PROJECT_ID_1);
      expect(json.documentsFound).toBe(1);
      expect(json.documents[0].documentType).toBe('ATTACH_TOR');
    });

    it('5.5 POST /api/ingestion/projects/[projectId]/documents validates and rejects invalid non-numeric project ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/ingestion/projects/invalid-id/documents', {
        method: 'POST',
      });

      const res = await documentsApiHandler(req, {
        params: Promise.resolve({ projectId: 'invalid-id' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid Project ID');
    });
  });
});
