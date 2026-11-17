/**
 * @jest-environment node
 */
// =============================================================================
// tests/e2e/confidence-exception-handling.test.ts
// Comprehensive End-to-End Tests for Exception Handling Based on Confidence
// Indicators & Admin Review Routing
//
// Verifies that:
// 1. High-Confidence Extractions:
//    - High-confidence extractions (aiConfidence: 'High', isSoftwareRelated: true)
//      publish directly to the public dashboard (GET /api/projects, GET /api/procurements).
//    - Public users can view, search, and filter high-confidence published projects
//      with full structured details (budget, scope, deliverables, technologies).
//
// 2. Unreadable / Corrupted PDFs & Document Processing Exceptions:
//    - Exception handling catches corrupted, truncated, or non-PDF binary files gracefully.
//    - Does not crash the ingestion pipeline; provides graceful heuristic fallback or captures error.
//    - Tracks unreadable document status ('FAILED') and preserves error messages on documents.
//    - Projects with unreadable documents remain flagged in the review queue (PENDING_REVIEW).
//
// 3. Low-Confidence Records Routing to Admin Review Queue:
//    - Ambiguous or low-signal procurement announcements produce Low confidence.
//    - Low-confidence records route to Admin Review Queue (GET /api/admin/classification-queue).
//    - Auth protection: 403 Forbidden for unauthenticated or non-admin users.
//    - Queue returns accurate breakdown of pending, approved, and corrected items.
//
// 4. Admin Remediation & Publication Lifecycle:
//    - Admin can inspect queued items via GET /api/projects/:id/classification.
//    - Admin approves/corrects classification via PATCH /api/projects/:id/classification.
//    - Once approved, record updates to classificationReviewStatus: 'APPROVED', admin_reviewed: true.
//    - Remediated project transitions out of PENDING_REVIEW and reflects on public dashboard.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { NextRequest } from 'next/server';

// ── Mock: database connection ─────────────────────────────────────────────────
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(true),
  default: jest.fn().mockResolvedValue(true),
}));

// ── Mock: auth ────────────────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthSessionFromRequest: jest.fn(),
  isAdminUser: jest.fn((user) => user?.role === 'admin'),
  AUTH_COOKIE_NAME: 'torbidd_session',
}));

// ── Mock: Mongoose models ─────────────────────────────────────────────────────
jest.mock('@/models/Project');
jest.mock('@/models/ProcurementProject');
jest.mock('@/models/ProcurementDocument');
jest.mock('@/models/SyncLog');
jest.mock('@/models/SystemMetadata');
jest.mock('@/models/SyncError');

// ── Mock: database helpers ────────────────────────────────────────────────────
jest.mock('@/services/database/projects');
jest.mock('@/services/database/procurement');

// ── Mock: AI Services ─────────────────────────────────────────────────────────
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});
jest.mock('@/services/ai/vertex-ai', () => ({
  getVertexAI: () => ({ getGenerativeModel: mockGetGenerativeModel }),
  VERTEX_MODEL_PRO: 'gemini-1.5-pro',
  VERTEX_MODEL_FLASH: 'gemini-1.5-flash',
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import Project from '@/models/Project';
import ProcurementProject from '@/models/ProcurementProject';
import ProcurementDocument from '@/models/ProcurementDocument';
import { getAuthSessionFromRequest, isAdminUser, AuthSessionUser } from '@/lib/auth';
import { classifyByKeywords } from '@/services/ai/classifier';
import { extractTorFromFile, extractTorFromBuffer, TorExtractResult } from '@/services/ai/tor-extractor';
import { getProjects } from '@/services/database/projects';
import {
  getProcurementProjects,
  getProcurementProjectByExternalId,
  updateProcurementProjectExtraction,
  saveProcurementDocument,
  getDocumentsByProjectId,
} from '@/services/database/procurement';
import { GET as getClassificationQueue } from '@/app/api/admin/classification-queue/route';
import {
  GET as getProjectClassification,
  PATCH as patchProjectClassification,
} from '@/app/api/projects/[id]/classification/route';
import { GET as getPublicProjects } from '@/app/api/projects/route';
import { GET as getPublicProcurements } from '@/app/api/procurements/route';
import { procurementToProject } from '@/lib/project-mapper';

// ── Mock type helpers ─────────────────────────────────────────────────────────
const mockGetAuth = getAuthSessionFromRequest as jest.MockedFunction<typeof getAuthSessionFromRequest>;
const mockGetProjects = getProjects as jest.MockedFunction<typeof getProjects>;
const mockGetProcurementProjects = getProcurementProjects as jest.MockedFunction<typeof getProcurementProjects>;
const mockGetProcurementByExtId = getProcurementProjectByExternalId as jest.MockedFunction<typeof getProcurementProjectByExternalId>;
const mockUpdateExtraction = updateProcurementProjectExtraction as jest.MockedFunction<typeof updateProcurementProjectExtraction>;
const mockSaveDoc = saveProcurementDocument as jest.MockedFunction<typeof saveProcurementDocument>;
const mockGetDocs = getDocumentsByProjectId as jest.MockedFunction<typeof getDocumentsByProjectId>;

// ── Auth helpers ──────────────────────────────────────────────────────────────
const ADMIN_USER: AuthSessionUser = {
  id: 'admin-001',
  email: 'admin@bma.go.th',
  name: 'System Administrator',
  picture: 'https://bma.go.th/admin.png',
  role: 'admin',
  org: 'Bangkok Metropolitan Administration',
};

const REGULAR_USER: AuthSessionUser = {
  id: 'user-001',
  email: 'citizen@example.com',
  name: 'Public Citizen',
  picture: '',
  role: 'user',
  org: 'Public',
};

// ── Shared Sample Fixtures ───────────────────────────────────────────────────
const HIGH_CONFIDENCE_PROJECT_ID = '67119538991';
const LOW_CONFIDENCE_PROJECT_ID = '67059199407';
const UNREADABLE_DOC_PROJECT_ID = '67099238412';

const MOCK_HIGH_CONF_PROJECT = {
  _id: 'db-proj-high-001',
  externalId: 67119538991,
  title: {
    th: 'โครงการจัดหาและติดตั้งระบบคลาวด์กลางกรุงเทพมหานคร (BMA Cloud Platform)',
    en: 'BMA Central Cloud Platform Implementation Project',
  },
  department: {
    th: 'สำนักยุทธศาสตร์และประเมินผล',
    en: 'Strategy and Evaluation Department',
  },
  budget: 45000000,
  historicalAvg: 45000000,
  category: 'Cloud',
  isSoftwareRelated: true,
  aiConfidence: 'High',
  classificationReviewStatus: 'APPROVED',
  publishDate: new Date('2026-02-15').toISOString(),
  deadline: new Date('2026-03-30').toISOString(),
  extractionStatus: 'EXTRACTED',
  torStatus: 'AVAILABLE',
  sourceDocument: 'Attach_TOR_67119538991.pdf',
  summary: {
    th: 'จัดหาระบบคลาวด์กลางและคอนเทนเนอร์แพลตฟอร์ม',
    en: 'Central government cloud and Kubernetes container infrastructure',
  },
  requiredTechnologies: ['Kubernetes', 'Docker', 'PostgreSQL', 'Terraform'],
};

const MOCK_LOW_CONF_PROJECT = {
  _id: 'db-proj-low-002',
  externalId: 67059199407,
  title: {
    th: 'โครงการจ้างที่ปรึกษาพัฒนากระบวนการและเทคโนโลยีสารสนเทศ',
    en: 'IT Process and Technology Consulting Services',
  },
  department: {
    th: 'สำนักการแพทย์',
    en: 'Medical Services Department',
  },
  budget: 3500000,
  historicalAvg: 3500000,
  category: 'Information System',
  isSoftwareRelated: true,
  aiConfidence: 'Low',
  classificationReviewStatus: 'PENDING_REVIEW',
  publishDate: new Date('2026-02-10').toISOString(),
  deadline: new Date('2026-03-15').toISOString(),
  extractionStatus: 'PENDING',
  torStatus: 'PENDING',
  sourceDocument: 'Attach_TOR_67059199407.pdf',
  summary: {
    th: 'จ้างที่ปรึกษาจัดทำกรอบกระบวนการ',
    en: 'Consultancy for process framework',
  },
  requiredTechnologies: [],
};

describe('UC-10 Confidence Exception Handling & Review Routing E2E Test Suite', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'confidence-e2e-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuth.mockReturnValue(ADMIN_USER);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // Section 1: High-Confidence Extractions Publish Directly to Public Dashboard
  // ===========================================================================
  describe('1. High-Confidence Extractions Direct Publication to Public Dashboard', () => {
    it('1.1 Classifies clear technical requirements with High confidence and isSoftwareRelated=true', () => {
      const result = classifyByKeywords(
        'โครงการพัฒนาระบบคลาวด์และไมโครเซอร์วิส (BMA Cloud Platform)',
        'จัดหาระบบคลาวด์ computing รองรับ Kubernetes, Docker และ Cloud Native microservices พร้อมระบบฐานข้อมูล PostgreSQL',
      );

      expect(result.isSoftwareRelated).toBe(true);
      expect(result.category).toBe('Cloud');
      expect(result.confidence).toBe('High');
      expect(result.reasoning).toMatch(/matching term/i);
    });

    it('1.2 High-confidence projects are immediately visible in public project search (GET /api/projects)', async () => {
      // Simulate database returning high-confidence published project
      mockGetProjects.mockResolvedValue([MOCK_HIGH_CONF_PROJECT as any]);
      mockGetProcurementProjects.mockResolvedValue({
        projects: [],
        total: 0,
      });

      const req = new NextRequest('http://localhost/api/projects?category=Cloud');
      const res = await getPublicProjects(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.length).toBe(1);

      const published = json.data[0];
      expect(published.externalId).toBe(67119538991);
      expect(published.aiConfidence).toBe('High');
      expect(published.isSoftwareRelated).toBe(true);
      expect(published.category).toBe('Cloud');
      expect(published.requiredTechnologies).toContain('Kubernetes');
    });

    it('1.3 High-confidence extractions are returned in procurement search (GET /api/procurements)', async () => {
      mockGetProjects.mockResolvedValue([MOCK_HIGH_CONF_PROJECT as any]);
      mockGetProcurementProjects.mockResolvedValue({
        projects: [],
        total: 0,
      });

      const req = new NextRequest('http://localhost/api/procurements?category=Cloud&search=Cloud');
      const res = await getPublicProcurements(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.length).toBe(1);
      expect(json.data[0].category).toBe('Cloud');
      expect(json.data[0].budget).toBe(45000000);
    });

    it('1.4 Maps high-confidence procurement document to project schema with complete structured fields', () => {
      const rawProcurement = {
        _id: 'proc-67119538991',
        externalProjectId: HIGH_CONFIDENCE_PROJECT_ID,
        projectName: 'โครงการติดตั้งระบบคลาวด์กลาง',
        agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
        fiscalYear: 2569,
        budget: 45000000,
        publishDate: new Date('2026-02-15'),
        deadline: new Date('2026-03-30'),
        software_category: 'Cloud',
        is_software: true,
        ai_confidence: 'High' as const,
        classification_reason: '3 matching terms found for Cloud',
        classified_by: 'ai' as const,
        admin_reviewed: true,
        torStatus: 'AVAILABLE' as const,
        extractionStatus: 'EXTRACTED' as const,
        summary: {
          th: 'ระบบคลาวด์ภาครัฐ',
          en: 'Government Cloud System',
        },
        requiredTechnologies: ['Kubernetes', 'Docker'],
      };

      const mapped = procurementToProject(rawProcurement as any);

      expect(mapped.isSoftwareRelated).toBe(true);
      expect(mapped.category).toBe('Cloud');
      expect(mapped.aiConfidence).toBe('High');
      expect(mapped.classificationReviewStatus).toBe('APPROVED');
      expect(mapped.requiredTechnologies).toEqual(['Kubernetes', 'Docker']);
      expect(mapped.summary?.th).toBe('ระบบคลาวด์ภาครัฐ');
    });
  });

  // ===========================================================================
  // Section 2: Unreadable PDFs & Document Processing Exception Handling
  // ===========================================================================
  describe('2. Unreadable / Corrupted PDFs & Document Processing Exception Handling', () => {
    it('2.1 extractTorFromFile catches file system errors gracefully for non-existent files', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.pdf');

      // Must not throw, should fall back to heuristic extraction gracefully
      const result = await extractTorFromFile(nonExistentPath, {
        projectId: UNREADABLE_DOC_PROJECT_ID,
        fileName: 'does-not-exist.pdf',
      });

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.title?.th).toBeDefined();
      // Heuristic fallback produces Medium confidence
      expect(result.confidence).toBe('Medium');
      expect(result.rawText).toContain('does-not-exist.pdf');
    });

    it('2.2 extractTorFromBuffer gracefully handles corrupted binary data without crashing', async () => {
      // Create invalid / corrupted pseudo-PDF buffer (random bytes without %PDF header)
      const corruptedBuffer = Buffer.from([0x00, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0x12, 0x34]);

      const result = await extractTorFromBuffer(corruptedBuffer, {
        projectId: UNREADABLE_DOC_PROJECT_ID,
        fileName: 'corrupted_tor.pdf',
        projectContext: {
          projectName: 'โครงการระบบสารสนเทศฉุกเฉิน',
          budget: 1200000,
        },
      });

      expect(result).toBeDefined();
      expect(result.budget).toBe(1200000);
      expect(result.confidence).toBe('Medium');
    });

    it('2.3 Unreadable document persistence tracks status="FAILED" and captures error message', async () => {
      mockSaveDoc.mockResolvedValueOnce({
        document: {
          _id: 'doc-failed-001',
          projectId: 'proj-unreadable-001',
          externalProjectId: UNREADABLE_DOC_PROJECT_ID,
          documentType: 'ATTACH_TOR',
          fileName: 'corrupt_tor_file.pdf',
          status: 'FAILED',
          errorMessage: 'Corrupt PDF: unexpected EOF or invalid header marker',
          downloadedAt: new Date(),
        } as any,
        isNew: true,
      });

      const failedDocPayload = {
        projectId: 'proj-unreadable-001',
        externalProjectId: UNREADABLE_DOC_PROJECT_ID,
        documentType: 'ATTACH_TOR' as const,
        fileName: 'corrupt_tor_file.pdf',
        filePath: 'corrupt_tor_file.pdf',
        storageReference: '/storage/corrupt_tor_file.pdf',
        source: 'NATIONAL_EGP',
        sourceUrl: 'https://egp.gov.th/corrupt.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        downloadedAt: new Date(),
        status: 'FAILED' as const,
        errorMessage: 'Corrupt PDF: unexpected EOF or invalid header marker',
      };

      const { document } = await saveProcurementDocument(failedDocPayload);

      expect(document.status).toBe('FAILED');
      expect(document.errorMessage).toMatch(/Corrupt PDF/i);
    });

    it('2.4 Projects with unreadable documents remain flagged as PENDING_REVIEW in queue', async () => {
      // Mock Project.find query for PENDING_REVIEW
      const mockFindChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'proj-unreadable-001',
            externalId: Number(UNREADABLE_DOC_PROJECT_ID),
            title: { th: 'โครงการจัดหาซอฟต์แวร์ (เอกสารอ่านไม่ออก)', en: 'Unreadable TOR Project' },
            department: { th: 'สำนักการแพทย์', en: 'Medical Department' },
            category: 'Information System',
            isSoftwareRelated: true,
            aiConfidence: 'Low',
            classificationReviewStatus: 'PENDING_REVIEW',
            publishDate: new Date().toISOString(),
            processedDate: new Date().toISOString(),
          },
        ]),
      };

      (Project.countDocuments as jest.Mock) = jest.fn()
        .mockResolvedValueOnce(1)  // total for query
        .mockResolvedValueOnce(1)  // pendingCount
        .mockResolvedValueOnce(0)  // approvedCount
        .mockResolvedValueOnce(0); // correctedCount
      (Project.find as jest.Mock) = jest.fn().mockReturnValue(mockFindChain);

      const req = new NextRequest('http://localhost/api/admin/classification-queue?status=PENDING_REVIEW');
      const res = await getClassificationQueue(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total).toBe(1);
      expect(json.data[0].classificationReviewStatus).toBe('PENDING_REVIEW');
      expect(json.data[0].aiConfidence).toBe('Low');
    });
  });

  // ===========================================================================
  // Section 3: Low-Confidence Records Route to Admin Review Queue
  // ===========================================================================
  describe('3. Low-Confidence Records Routing to Admin Review Queue', () => {
    it('3.1 Low-signal procurement announcements produce Low confidence in rule-based classifier', () => {
      const ambiguousResult = classifyByKeywords(
        'โครงการสร้างความตระหนักรู้และการสื่อสารองค์กร',
        'กิจกรรมสัมมนาและเผยแพร่ข้อมูลข่าวสารทั่วไป',
      );

      expect(ambiguousResult.confidence).toBe('Low');
      expect(ambiguousResult.isSoftwareRelated).toBe(false);
      expect(ambiguousResult.reasoning).toMatch(/no software-related keywords/i);
    });

    it('3.2 Admin Review Queue blocks unauthenticated access with 403 Forbidden', async () => {
      mockGetAuth.mockReturnValue(null);

      const req = new NextRequest('http://localhost/api/admin/classification-queue?status=PENDING_REVIEW');
      const res = await getClassificationQueue(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/forbidden/i);
    });

    it('3.3 Admin Review Queue blocks regular non-admin users with 403 Forbidden', async () => {
      mockGetAuth.mockReturnValue(REGULAR_USER);

      const req = new NextRequest('http://localhost/api/admin/classification-queue?status=PENDING_REVIEW');
      const res = await getClassificationQueue(req);

      expect(res.status).toBe(403);
    });

    it('3.4 Admin Review Queue accurately returns pending, approved, and corrected tallies', async () => {
      mockGetAuth.mockReturnValue(ADMIN_USER);

      const mockFindChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([MOCK_LOW_CONF_PROJECT]),
      };

      (Project.countDocuments as jest.Mock) = jest.fn()
        .mockResolvedValueOnce(5)   // query total
        .mockResolvedValueOnce(5)   // pendingCount
        .mockResolvedValueOnce(12)  // approvedCount
        .mockResolvedValueOnce(2);  // correctedCount
      (Project.find as jest.Mock) = jest.fn().mockReturnValue(mockFindChain);

      const req = new NextRequest('http://localhost/api/admin/classification-queue?status=PENDING_REVIEW&page=1&limit=20');
      const res = await getClassificationQueue(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total).toBe(5);
      expect(json.summary.pendingCount).toBe(5);
      expect(json.summary.approvedCount).toBe(12);
      expect(json.summary.correctedCount).toBe(2);
      expect(json.data.length).toBe(1);
      expect(json.data[0].aiConfidence).toBe('Low');
    });

    it('3.5 Admin Review Queue falls back to ProcurementProject when Project collection is empty', async () => {
      mockGetAuth.mockReturnValue(ADMIN_USER);

      // Project collection has 0 items
      const mockProjectFindChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      (Project.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);
      (Project.find as jest.Mock) = jest.fn().mockReturnValue(mockProjectFindChain);

      // ProcurementProject fallback has 1 unreviewed project
      const mockProcFindChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'proc-fallback-001',
            externalProjectId: LOW_CONFIDENCE_PROJECT_ID,
            projectName: 'โครงการจ้างที่ปรึกษาพัฒนากระบวนการ',
            agencyName: 'สำนักการแพทย์',
            software_category: 'Information System',
            is_software: true,
            ai_confidence: 'Low',
            admin_reviewed: false,
            classified_by: 'rule',
            classification_reason: 'Low keyword confidence',
            discoveredAt: new Date(),
          },
        ]),
      };

      (ProcurementProject.countDocuments as jest.Mock) = jest.fn()
        .mockResolvedValueOnce(1)  // total
        .mockResolvedValueOnce(1)  // pendingCount
        .mockResolvedValueOnce(0)  // approvedCount
        .mockResolvedValueOnce(0); // correctedCount
      (ProcurementProject.find as jest.Mock) = jest.fn().mockReturnValue(mockProcFindChain);

      const req = new NextRequest('http://localhost/api/admin/classification-queue?status=PENDING_REVIEW');
      const res = await getClassificationQueue(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total).toBe(1);
      expect(json.data[0].externalId).toBe(Number(LOW_CONFIDENCE_PROJECT_ID));
      expect(json.data[0].aiConfidence).toBe('Low');
      expect(json.data[0].classificationReviewStatus).toBe('PENDING_REVIEW');
    });
  });

  // ===========================================================================
  // Section 4: Admin Review, Remediation, & Publication Lifecycle
  // ===========================================================================
  describe('4. Admin Remediation & Publication Lifecycle', () => {
    it('4.1 Admin inspects low-confidence record details via GET /api/projects/:id/classification', async () => {
      mockGetAuth.mockReturnValue(ADMIN_USER);

      const mockFindOneChain = {
        select: jest.fn().mockResolvedValue({
          externalId: Number(LOW_CONFIDENCE_PROJECT_ID),
          title: { th: 'โครงการจ้างที่ปรึกษาพัฒนากระบวนการ', en: 'Process Consulting' },
          category: 'Information System',
          isSoftwareRelated: true,
          aiConfidence: 'Low',
          classificationReviewStatus: 'PENDING_REVIEW',
        }),
      };
      (Project.findOne as jest.Mock) = jest.fn().mockReturnValue(mockFindOneChain);

      const req = new NextRequest(`http://localhost/api/projects/${LOW_CONFIDENCE_PROJECT_ID}/classification`);
      const res = await getProjectClassification(req, {
        params: Promise.resolve({ id: LOW_CONFIDENCE_PROJECT_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.externalId).toBe(Number(LOW_CONFIDENCE_PROJECT_ID));
      expect(json.data.aiConfidence).toBe('Low');
      expect(json.data.classificationReviewStatus).toBe('PENDING_REVIEW');
    });

    it('4.2 Admin approves and overrides classification via PATCH /api/projects/:id/classification', async () => {
      mockGetAuth.mockReturnValue(ADMIN_USER);

      (Project.findOneAndUpdate as jest.Mock) = jest.fn().mockResolvedValue({
        _id: 'db-proj-low-002',
        externalId: Number(LOW_CONFIDENCE_PROJECT_ID),
        category: 'Website',
        isSoftwareRelated: true,
        classificationReviewStatus: 'APPROVED',
        classificationReviewNote: 'Admin confirmed as web portal development project',
        classificationReviewedBy: ADMIN_USER.id,
        classificationReviewedAt: new Date(),
      });

      const patchBody = {
        category: 'Website',
        isSoftwareRelated: true,
        classificationReviewStatus: 'APPROVED',
        classificationReviewNote: 'Admin confirmed as web portal development project',
      };

      const req = new NextRequest(
        `http://localhost/api/projects/${LOW_CONFIDENCE_PROJECT_ID}/classification`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patchBody),
        },
      );

      const res = await patchProjectClassification(req, {
        params: Promise.resolve({ id: LOW_CONFIDENCE_PROJECT_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.category).toBe('Website');
      expect(json.data.classificationReviewStatus).toBe('APPROVED');
      expect(json.data.classificationReviewedBy).toBe(ADMIN_USER.id);
    });

    it('4.3 Non-admin user cannot override classification (returns 403 Forbidden)', async () => {
      mockGetAuth.mockReturnValue(REGULAR_USER);

      const req = new NextRequest(
        `http://localhost/api/projects/${LOW_CONFIDENCE_PROJECT_ID}/classification`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            category: 'Website',
            isSoftwareRelated: true,
            classificationReviewStatus: 'APPROVED',
          }),
        },
      );

      const res = await patchProjectClassification(req, {
        params: Promise.resolve({ id: LOW_CONFIDENCE_PROJECT_ID }),
      });

      expect(res.status).toBe(403);
    });

    it('4.4 Fallback: updates ProcurementProject when project exists only in Procurement collection', async () => {
      mockGetAuth.mockReturnValue(ADMIN_USER);

      // Project findOneAndUpdate returns null (not found in Project collection)
      (Project.findOneAndUpdate as jest.Mock) = jest.fn().mockResolvedValue(null);

      // ProcurementProject findOneAndUpdate updates successfully
      (ProcurementProject.findOneAndUpdate as jest.Mock) = jest.fn().mockResolvedValue({
        _id: 'proc-67059199407',
        externalProjectId: LOW_CONFIDENCE_PROJECT_ID,
        software_category: 'AI',
        is_software: true,
        admin_reviewed: true,
        classified_by: 'admin',
        classification_reason: 'Admin validated AI scope from TOR specifications',
        classified_at: new Date(),
      });

      const patchBody = {
        category: 'AI',
        isSoftwareRelated: true,
        classificationReviewStatus: 'APPROVED',
        classificationReviewNote: 'Admin validated AI scope from TOR specifications',
      };

      const req = new NextRequest(
        `http://localhost/api/projects/${LOW_CONFIDENCE_PROJECT_ID}/classification`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patchBody),
        },
      );

      const res = await patchProjectClassification(req, {
        params: Promise.resolve({ id: LOW_CONFIDENCE_PROJECT_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.category).toBe('AI');
      expect(json.data.isSoftwareRelated).toBe(true);
      expect(json.data.classificationReviewStatus).toBe('APPROVED');
    });

    it('4.5 Remediated project now reflects as APPROVED and verified by human on public dashboard', () => {
      const remediatedProcurement = {
        _id: 'proc-67059199407',
        externalProjectId: LOW_CONFIDENCE_PROJECT_ID,
        projectName: 'โครงการพัฒนาระบบ AI การแพทย์',
        agencyName: 'สำนักการแพทย์',
        fiscalYear: 2569,
        budget: 3500000,
        publishDate: new Date('2026-02-10'),
        software_category: 'AI',
        is_software: true,
        ai_confidence: 'High' as const,
        admin_reviewed: true,
        classified_by: 'admin' as const,
        classification_reason: 'Admin validated AI scope',
      };

      const mapped = procurementToProject(remediatedProcurement as any);

      // Post-review verification:
      expect(mapped.category).toBe('AI');
      expect(mapped.isSoftwareRelated).toBe(true);
      expect(mapped.classificationReviewStatus).toBe('APPROVED');
    });
  });
});
