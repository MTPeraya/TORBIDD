/**
 * @jest-environment node
 */
// =============================================================================
// tests/e2e/admin-review-tor-and-classification.test.ts
// End-to-End Tests — Admin Review Workflows, Manual TOR Corrections & Classification Overrides
//
// Verifies that system administrators can:
//   1. Access restricted review and override routes (enforcing auth & admin role guards)
//   2. Inspect the AI classification review queue with status-based filtering (UC-10)
//   3. Override software / non-software classifications (UC-10 / UC-4):
//      - Override false-positive: software -> non-software (isSoftwareRelated: false)
//      - Override false-negative: non-software -> software (isSoftwareRelated: true)
//      - Correct software category (e.g. Website -> AI, ERP, Mobile App, Cloud)
//      - Assign classificationReviewStatus ('APPROVED' | 'CORRECTED')
//      - Record administrative review notes and reviewer metadata (reviewedBy, reviewedAt)
//      - Support both primary Project model and fallback ProcurementProject model
//   4. Inspect project classification detail via GET /api/projects/:id/classification
//   5. Manually correct AI-extracted TOR text fields via PUT /api/projects/:id:
//      - Project Scope of Work (scope.th and scope.en itemized bullet arrays)
//      - Bidder Qualifications (qualifications.th and qualifications.en clause arrays)
//      - Project Title (title.th and title.en)
//      - Project Description (description.th and description.en)
//      - Procurement metadata (budget, fiscalYear, category, aiConfidence)
//   6. Verify that Opportunity Detail View (GET /api/projects/:id) reflects the
//      corrected TOR text fields and updated classification state immediately
//   7. Validate boundary conditions and error handling:
//      - 400 Bad Request on invalid category, status, negative budget, empty title
//      - 403 Forbidden on non-admin / unauthenticated requests
//      - 404 Not Found on non-existent project IDs
//   8. Complete end-to-end review lifecycle: from PENDING_REVIEW ingestion,
//      through manual TOR correction, to classification override and verified queue transition.
// =============================================================================

import { NextRequest } from 'next/server';
import { signSession } from '@/lib/auth';
import { AUTH_COOKIE_NAME } from '@/lib/auth-constants';

// Route handlers under test
import {
  PATCH as classificationPATCH,
  GET as classificationGET,
} from '@/app/api/projects/[id]/classification/route';
import {
  GET as projectGET,
  PUT as projectPUT,
} from '@/app/api/projects/[id]/route';
import { GET as classQueueGET } from '@/app/api/admin/classification-queue/route';

// ─────────────────────────────────────────────────────────────────────────────
// Infrastructure mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/lib/mongodb', () => {
  const mockFn = jest.fn().mockResolvedValue(true);
  return { __esModule: true, default: mockFn, connectToDatabase: mockFn };
});

jest.mock('@/models/Project', () => {
  const findChain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  };
  return {
    __esModule: true,
    default: {
      find: jest.fn().mockReturnValue(findChain),
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      findByIdAndUpdate: jest.fn().mockResolvedValue(null),
      countDocuments: jest.fn().mockResolvedValue(0),
    },
  };
});

jest.mock('@/models/ProcurementProject', () => {
  const findChain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  };
  return {
    __esModule: true,
    default: {
      find: jest.fn().mockReturnValue(findChain),
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      countDocuments: jest.fn().mockResolvedValue(0),
    },
  };
});

import Project from '@/models/Project';
import ProcurementProject from '@/models/ProcurementProject';

const mockProjectModel = Project as any;
const mockProcurementProjectModel = ProcurementProject as any;
const MockProject = Project as any;
const MockProcurementProject = ProcurementProject as any;

// Mock database services
jest.mock('@/services/database/projects', () => ({
  getProjectById: jest.fn().mockResolvedValue(null),
  getProjectByExternalId: jest.fn().mockResolvedValue(null),
  updateProject: jest.fn().mockImplementation((id, data) => {
    return Promise.resolve({
      _id: 'proj_mock_001',
      externalId: typeof id === 'number' ? id : 6701001,
      ...data,
      updatedAt: new Date(),
    });
  }),
  deleteProject: jest.fn().mockResolvedValue(true),
  getAdminProjectStats: jest.fn().mockResolvedValue({
    totalProjects: 10,
    totalBudget: 50_000_000,
    activeProjects: 5,
    aiEnrichedCount: 8,
  }),
}));

jest.mock('@/services/database/procurement', () => ({
  getProjectWithDocuments: jest.fn().mockResolvedValue(null),
  getDocumentsByProjectId: jest.fn().mockResolvedValue([]),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Auth session users
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: 'admin_rev_01',
  email: 'admin.tor@bma.go.th',
  name: 'ผู้ดูแลระบบพิจารณา TOR',
  org: 'สำนักยุทธศาสตร์และประเมินผล',
  role: 'admin',
  picture: '',
};

const OFFICER_USER = {
  id: 'officer_rev_01',
  email: 'officer.tor@bma.go.th',
  name: 'เจ้าหน้าที่พิจารณา',
  org: 'สำนักการแพทย์',
  role: 'BMA Officer',
  picture: '',
};

const BASE = 'http://localhost:3000';

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
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Helper to wrap params as Promise for Next.js 15 route signature
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_PROJECT = {
  _id: '67a1b2c3d4e5f6a7b8c9d0e1',
  externalId: 67119538991,
  title: {
    th: 'โครงการจัดซื้อระบบปัญญาประดิษฐ์เพื่อการคัดกรองสุขภาพผู้สูงอายุ',
    en: 'AI System for Elderly Healthcare Screening Project',
  },
  department: {
    th: 'สำนักการแพทย์',
    en: 'Medical Services Department',
  },
  budget: 18500000,
  fiscalYear: 2568,
  publishDate: new Date('2026-11-01T00:00:00Z'),
  deadline: new Date('2026-12-01T00:00:00Z'),
  category: 'AI',
  procurementType: 'e-Bidding',
  description: {
    th: 'ระบบปัญญาประดิษฐ์ตรวจจับความเสี่ยงสุขภาพผ่านภาพถ่ายรังสีทรวงอก',
    en: 'AI system for detecting health risks via chest X-rays',
  },
  scope: {
    th: [
      '1. ออกแบบและพัฒนาโมเดล AI วิเคราะห์ภาพทางการแพทย์',
      '2. เชื่อมต่อระบบกับฐานข้อมูลเวชระเบียนโรงพยาบาล กทม.',
      '3. ฝึกอบรมแพทย์และบุคลากรทางการแพทย์',
    ],
    en: [
      '1. Design and develop AI models for medical imaging analysis',
      '2. Integrate system with BMA hospital EHR database',
      '3. Train physicians and medical staff',
    ],
  },
  qualifications: {
    th: [
      '1. นิติบุคคลผู้เสนอราคาต้องมีทุนจดทะเบียนไม่น้อยกว่า 10,000,000 บาท',
      '2. มีประสบการณ์ติดตั้งระบบ AI ด้านการแพทย์กับหน่วยงานรัฐอย่างน้อย 1 สัญญา',
    ],
    en: [
      '1. Registered entity with capital not less than 10,000,000 THB',
      '2. Prior medical AI installation experience with government agencies',
    ],
  },
  isSoftwareRelated: true,
  aiConfidence: 'High',
  classificationReviewStatus: 'PENDING_REVIEW',
  classificationReviewedBy: undefined,
  classificationReviewedAt: undefined,
  classificationReviewNote: undefined,
};

// =============================================================================
// Test Suites
// =============================================================================

describe('E2E: Admin Review Workflows — Manual TOR Corrections & Classification Overrides', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Access Control & Role Guards
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Access Control & Role Guards', () => {
    it('1.1 PATCH /api/projects/:id/classification — unauthenticated request returns 403', async () => {
      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'AI',
          isSoftwareRelated: true,
          classificationReviewStatus: 'APPROVED',
        }, null),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/forbidden/i);
    });

    it('1.2 PATCH /api/projects/:id/classification — non-admin officer role returns 403', async () => {
      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'AI',
          isSoftwareRelated: true,
          classificationReviewStatus: 'APPROVED',
        }, OFFICER_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(403);
    });

    it('1.3 GET /api/projects/:id/classification — unauthenticated request returns 403', async () => {
      const res = await classificationGET(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'GET', undefined, null),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(403);
    });

    it('1.4 GET /api/projects/:id/classification — non-admin officer role returns 403', async () => {
      const res = await classificationGET(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'GET', undefined, OFFICER_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(403);
    });

    it('1.5 PUT /api/projects/:id — unauthenticated request returns 403', async () => {
      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          title: { th: 'แก้ไขชื่อ', en: 'Updated Title' },
        }, null),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/forbidden|admin access required/i);
    });

    it('1.6 PUT /api/projects/:id — non-admin officer role returns 403', async () => {
      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          title: { th: 'แก้ไขชื่อ', en: 'Updated Title' },
        }, OFFICER_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(403);
    });

    it('1.7 GET /api/admin/classification-queue — non-admin officer returns 403', async () => {
      const res = await classQueueGET(
        makeRequest(`${BASE}/api/admin/classification-queue`, 'GET', undefined, OFFICER_USER),
      );
      expect(res.status).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Classification Review Queue Inspection
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Classification Review Queue Inspection (UC-10)', () => {
    beforeEach(() => {
      const mockLean = jest.fn().mockResolvedValue([
        { ...SAMPLE_PROJECT, classificationReviewStatus: 'PENDING_REVIEW' },
      ]);
      const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      const mockSelect = jest.fn().mockReturnValue({ sort: mockSort });
      mockProjectModel.find.mockReturnValue({ select: mockSelect });
      mockProjectModel.countDocuments.mockResolvedValue(1);
    });

    it('2.1 admin inspects pending review queue and receives status 200 with queue data', async () => {
      const res = await classQueueGET(
        makeRequest(`${BASE}/api/admin/classification-queue`, 'GET', undefined, ADMIN_USER, {
          status: 'PENDING_REVIEW',
          page: '1',
          limit: '20',
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0].classificationReviewStatus).toBe('PENDING_REVIEW');
    });

    it('2.2 queue response includes pagination metadata (total, page, limit, totalPages)', async () => {
      const res = await classQueueGET(
        makeRequest(`${BASE}/api/admin/classification-queue`, 'GET', undefined, ADMIN_USER),
      );
      const body = await res.json();
      expect(body.total).toBe(1);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(body.totalPages).toBe(1);
    });

    it('2.3 queue response includes summary counts for all three review states', async () => {
      const res = await classQueueGET(
        makeRequest(`${BASE}/api/admin/classification-queue`, 'GET', undefined, ADMIN_USER),
      );
      const body = await res.json();
      expect(body.summary).toBeDefined();
      expect(typeof body.summary.pendingCount).toBe('number');
      expect(typeof body.summary.approvedCount).toBe('number');
      expect(typeof body.summary.correctedCount).toBe('number');
    });

    it('2.4 queue supports status filtering by APPROVED, CORRECTED, or all', async () => {
      for (const filterStatus of ['APPROVED', 'CORRECTED', 'all']) {
        const res = await classQueueGET(
          makeRequest(`${BASE}/api/admin/classification-queue`, 'GET', undefined, ADMIN_USER, {
            status: filterStatus,
          }),
        );
        expect(res.status).toBe(200);
      }
    });

    it('2.5 invalid status query parameter returns 400 Bad Request', async () => {
      const res = await classQueueGET(
        makeRequest(`${BASE}/api/admin/classification-queue`, 'GET', undefined, ADMIN_USER, {
          status: 'INVALID_STATUS',
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Classification Overrides: Software to Non-Software (False-Positive Correction)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Classification Overrides: Software -> Non-Software (UC-10 / UC-4)', () => {
    it('3.1 admin overrides a software project to non-software (isSoftwareRelated: false)', async () => {
      const updatedDoc = {
        ...SAMPLE_PROJECT,
        category: 'Information System',
        isSoftwareRelated: false,
        classificationReviewStatus: 'CORRECTED',
        classificationReviewNote: 'Admin confirmed non-software construction/hardware tender (UC-4)',
        classificationReviewedBy: ADMIN_USER.id,
        classificationReviewedAt: new Date(),
      };
      mockProjectModel.findOneAndUpdate.mockResolvedValueOnce(updatedDoc);

      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'Information System',
          isSoftwareRelated: false,
          classificationReviewStatus: 'CORRECTED',
          classificationReviewNote: 'Admin confirmed non-software construction/hardware tender (UC-4)',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.isSoftwareRelated).toBe(false);
      expect(body.data.classificationReviewStatus).toBe('CORRECTED');
      expect(body.data.classificationReviewNote).toBe('Admin confirmed non-software construction/hardware tender (UC-4)');
      expect(body.data.classificationReviewedBy).toBe(ADMIN_USER.id);
      expect(body.data.classificationReviewedAt).toBeDefined();
    });

    it('3.2 override correctly targets numeric externalId in filter', async () => {
      mockProjectModel.findOneAndUpdate.mockResolvedValueOnce({
        ...SAMPLE_PROJECT,
        isSoftwareRelated: false,
        classificationReviewStatus: 'CORRECTED',
      });

      await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'Information System',
          isSoftwareRelated: false,
          classificationReviewStatus: 'CORRECTED',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(mockProjectModel.findOneAndUpdate).toHaveBeenCalledWith(
        { externalId: 67119538991 },
        expect.objectContaining({
          $set: expect.objectContaining({
            isSoftwareRelated: false,
            classificationReviewStatus: 'CORRECTED',
          }),
        }),
        expect.anything(),
      );
    });

    it('3.3 override correctly targets MongoDB hex _id in filter', async () => {
      const hexId = '67a1b2c3d4e5f6a7b8c9d0e1';
      mockProjectModel.findOneAndUpdate.mockResolvedValueOnce({
        ...SAMPLE_PROJECT,
        _id: hexId,
        isSoftwareRelated: false,
        classificationReviewStatus: 'CORRECTED',
      });

      await classificationPATCH(
        makeRequest(`${BASE}/api/projects/${hexId}/classification`, 'PATCH', {
          category: 'Website',
          isSoftwareRelated: false,
          classificationReviewStatus: 'CORRECTED',
        }, ADMIN_USER),
        makeParams(hexId),
      );

      expect(mockProjectModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: hexId },
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Classification Overrides: Non-Software to Software-Related & Category Correction
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Classification Overrides: Non-Software -> Software & Category Correction', () => {
    it('4.1 admin overrides false-negative to software (isSoftwareRelated: true) and approves', async () => {
      const approvedDoc = {
        ...SAMPLE_PROJECT,
        category: 'Mobile App',
        isSoftwareRelated: true,
        classificationReviewStatus: 'APPROVED',
        classificationReviewNote: 'Verified genuine mobile health application',
        classificationReviewedBy: ADMIN_USER.id,
        classificationReviewedAt: new Date(),
      };
      MockProject.findOneAndUpdate.mockResolvedValueOnce(approvedDoc);

      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'Mobile App',
          isSoftwareRelated: true,
          classificationReviewStatus: 'APPROVED',
          classificationReviewNote: 'Verified genuine mobile health application',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.isSoftwareRelated).toBe(true);
      expect(body.data.category).toBe('Mobile App');
      expect(body.data.classificationReviewStatus).toBe('APPROVED');
      expect(body.data.classificationReviewNote).toBe('Verified genuine mobile health application');
    });

    it('4.2 admin corrects category to AI and marks status CORRECTED', async () => {
      const correctedDoc = {
        ...SAMPLE_PROJECT,
        category: 'AI',
        isSoftwareRelated: true,
        classificationReviewStatus: 'CORRECTED',
        classificationReviewNote: 'Corrected category from Website to AI (machine learning model)',
        classificationReviewedBy: ADMIN_USER.id,
      };
      MockProject.findOneAndUpdate.mockResolvedValueOnce(correctedDoc);

      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'AI',
          isSoftwareRelated: true,
          classificationReviewStatus: 'CORRECTED',
          classificationReviewNote: 'Corrected category from Website to AI (machine learning model)',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.category).toBe('AI');
      expect(body.data.classificationReviewStatus).toBe('CORRECTED');
    });

    it('4.3 fallback to ProcurementProject when Project collection record is absent', async () => {
      // Primary Project returns null (not found)
      MockProject.findOneAndUpdate.mockResolvedValueOnce(null);

      // ProcurementProject fallback returns updated document
      const mockProcDoc = {
        _id: 'proc_doc_001',
        externalProjectId: '67119538991',
        software_category: 'Cloud',
        is_software: true,
        admin_reviewed: true,
        classified_by: 'admin',
        classified_at: new Date(),
        classification_reason: 'Admin fallback review on ProcurementProject',
      };
      MockProcurementProject.findOneAndUpdate.mockResolvedValueOnce(mockProcDoc);

      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'Cloud',
          isSoftwareRelated: true,
          classificationReviewStatus: 'CORRECTED',
          classificationReviewNote: 'Admin fallback review on ProcurementProject',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.category).toBe('Cloud');
      expect(body.data.isSoftwareRelated).toBe(true);
      expect(MockProcurementProject.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Validation and Error Handling on Classification Override
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Validation & Error Handling on Classification Override', () => {
    it('5.1 invalid category enum returns 400 Bad Request with validation details', async () => {
      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'Space Exploration System', // Invalid category
          isSoftwareRelated: true,
          classificationReviewStatus: 'APPROVED',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid request body/i);
      expect(json.details).toBeDefined();
    });

    it('5.2 invalid classificationReviewStatus returns 400 Bad Request', async () => {
      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'AI',
          isSoftwareRelated: true,
          classificationReviewStatus: 'UNKNOWN_STATUS', // Only APPROVED | CORRECTED allowed
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(400);
    });

    it('5.3 missing required field isSoftwareRelated returns 400', async () => {
      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'Website',
          classificationReviewStatus: 'APPROVED',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(400);
    });

    it('5.4 note exceeding 500 characters returns 400', async () => {
      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'Database',
          isSoftwareRelated: true,
          classificationReviewStatus: 'APPROVED',
          classificationReviewNote: 'A'.repeat(501),
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(400);
    });

    it('5.5 non-existent project returns 404 Not Found', async () => {
      MockProject.findOneAndUpdate.mockResolvedValueOnce(null);
      MockProcurementProject.findOneAndUpdate.mockResolvedValueOnce(null);

      const res = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/99999999999/classification`, 'PATCH', {
          category: 'AI',
          isSoftwareRelated: true,
          classificationReviewStatus: 'APPROVED',
        }, ADMIN_USER),
        makeParams('99999999999'),
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toMatch(/project not found/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Inspection of Classification Detail (GET /api/projects/:id/classification)
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Inspection of Classification Detail (GET /api/projects/:id/classification)', () => {
    it('6.1 admin inspects classification details of a project and receives 200', async () => {
      MockProject.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          externalId: 67119538991,
          title: SAMPLE_PROJECT.title,
          category: 'AI',
          isSoftwareRelated: true,
          aiConfidence: 'High',
          classificationReviewStatus: 'APPROVED',
          classificationReviewedBy: ADMIN_USER.id,
          classificationReviewedAt: new Date('2026-11-10T12:00:00Z'),
          classificationReviewNote: 'AI medical diagnostic system confirmed',
        }),
      });

      const res = await classificationGET(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'GET', undefined, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.externalId).toBe(67119538991);
      expect(body.data.category).toBe('AI');
      expect(body.data.isSoftwareRelated).toBe(true);
      expect(body.data.classificationReviewStatus).toBe('APPROVED');
      expect(body.data.classificationReviewNote).toBe('AI medical diagnostic system confirmed');
    });

    it('6.2 fallback inspection against ProcurementProject works when Project is not found', async () => {
      MockProject.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });
      MockProcurementProject.findOne.mockResolvedValueOnce({
        _id: 'proc_002',
        externalProjectId: '67119538991',
        projectName: 'Smart Healthcare Data Platform',
        software_category: 'Data Analytics',
        is_software: true,
        ai_confidence: 'High',
        admin_reviewed: true,
        classified_by: 'admin',
        classified_at: new Date(),
        classification_reason: 'Confirmed data analytics platform',
      });

      const res = await classificationGET(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'GET', undefined, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.category).toBe('Data Analytics');
      expect(body.data.isSoftwareRelated).toBe(true);
      expect(body.data.classificationReviewStatus).toBe('APPROVED');
    });

    it('6.3 returns 404 when project does not exist in either collection', async () => {
      MockProject.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });
      MockProcurementProject.findOne.mockResolvedValueOnce(null);

      const res = await classificationGET(
        makeRequest(`${BASE}/api/projects/88888888888/classification`, 'GET', undefined, ADMIN_USER),
        makeParams('88888888888'),
      );

      expect(res.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Manual Correction of AI-Extracted TOR Text Fields (PUT /api/projects/:id)
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Manual Correction of AI-Extracted TOR Text Fields (PUT /api/projects/:id)', () => {
    it('7.1 admin manually corrects AI-extracted TOR Scope of Work (scope.th and scope.en)', async () => {
      const correctedScope = {
        th: [
          '1. ปรับปรุงข้อกำหนด: พัฒนาและติดตั้งโมเดล AI วิเคราะห์ภาพรังสี 50,000 ภาพ/ปี',
          '2. จัดทำ API Gateway เชื่อมต่อระบบโรงพยาบาลในสังกัด กทม. ทั้ง 11 แห่ง',
          '3. จัดฝึกอบรมเชิงลึกแก่รังสีแพทย์และเจ้าหน้าที่เทคนิค 100 คน',
          '4. เพิ่มการรับประกันและบำรุงรักษาระบบ (SLA 99.9%) ต่อเนื่อง 2 ปี',
        ],
        en: [
          '1. Corrected spec: Deploy AI radiology model for 50,000 images/year',
          '2. Establish API Gateway integration across all 11 BMA hospitals',
          '3. Provide in-depth training for 100 radiologists and technical staff',
          '4. Guarantee 2-year system maintenance with 99.9% SLA',
        ],
      };

      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          scope: correctedScope,
        }, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.scope.th).toEqual(correctedScope.th);
      expect(body.data.scope.en).toEqual(correctedScope.en);
    });

    it('7.2 admin manually corrects AI-extracted Bidder Qualifications (qualifications.th and qualifications.en)', async () => {
      const correctedQuals = {
        th: [
          '1. ผู้เสนอราคาต้องเป็นนิติบุคคลจดทะเบียนในไทย มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 15,000,000 บาท',
          '2. มีผลงานติดตั้งระบบปัญญาประดิษฐ์ทางการแพทย์กับโรงพยาบาลรัฐหรือเอกชน วงเงินไม่น้อยกว่า 5,000,000 บาท',
          '3. มีผู้เชี่ยวชาญด้าน Machine Learning / Medical Imaging ได้รับการรับรองอย่างน้อย 3 คน',
          '4. ผ่านการรับรองมาตรฐาน ISO/IEC 29110 หรือ CMMI Level 3 ขึ้นไป',
        ],
        en: [
          '1. Registered Thai entity with paid-up capital of at least 15,000,000 THB',
          '2. Verified medical AI installation record with hospital valued >= 5,000,000 THB',
          '3. At least 3 certified ML / Medical Imaging specialists on staff',
          '4. ISO/IEC 29110 or CMMI Level 3+ certification',
        ],
      };

      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          qualifications: correctedQuals,
        }, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.qualifications.th).toEqual(correctedQuals.th);
      expect(body.data.qualifications.en).toEqual(correctedQuals.en);
    });

    it('7.3 admin manually corrects AI-extracted Title and Description (bilingual)', async () => {
      const correctedTitle = {
        th: 'โครงการจัดหาและติดตั้งระบบ AI วิเคราะห์ภาพทางการแพทย์และคัดกรองโรค (ฉบับแก้ไข)',
        en: 'Procurement and Deployment of AI Medical Imaging and Disease Screening System (Revised)',
      };
      const correctedDesc = {
        th: 'ระบบปัญญาประดิษฐ์เพื่อช่วยวินิจฉัยภาพถ่ายทางรังสีอัตโนมัติ สำหรับโรงพยาบาลสังกัดสำนักการแพทย์ กรุงเทพมหานคร',
        en: 'Automated AI radiological diagnosis assistance system for hospitals under BMA Medical Services Dept',
      };

      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          title: correctedTitle,
          description: correctedDesc,
        }, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.title.th).toBe(correctedTitle.th);
      expect(body.data.title.en).toBe(correctedTitle.en);
      expect(body.data.description.th).toBe(correctedDesc.th);
      expect(body.data.description.en).toBe(correctedDesc.en);
    });

    it('7.4 admin atomically updates all AI-extracted TOR text fields together with budget and category', async () => {
      const fullUpdatePayload = {
        title: {
          th: 'โครงการพัฒนาระบบ AI เวชสารสนเทศบูรณาการ',
          en: 'Integrated Health Informatics AI System Development',
        },
        description: {
          th: 'แพลตฟอร์ม AI วิเคราะห์ข้อมูลสุขภาพประชากร กทม.',
          en: 'BMA Population Health Data Analytics AI Platform',
        },
        scope: {
          th: ['ข้อกำหนดที่ 1: พัฒนา AI pipeline', 'ข้อกำหนดที่ 2: ติดตั้งบนคลาวด์ กทม.'],
          en: ['Spec 1: Develop AI pipeline', 'Spec 2: Deploy to BMA cloud'],
        },
        qualifications: {
          th: ['คุณสมบัติ 1: ทุนจดทะเบียน 20 ล้านบาท', 'คุณสมบัติ 2: มีผลงานคลาวด์'],
          en: ['Qual 1: 20M THB Capital', 'Qual 2: Cloud project record'],
        },
        category: 'AI',
        budget: 22000000,
        fiscalYear: 2568,
        aiConfidence: 'High',
        isSoftwareRelated: true,
        classificationReviewStatus: 'APPROVED',
      };

      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', fullUpdatePayload, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.title.th).toBe(fullUpdatePayload.title.th);
      expect(body.data.budget).toBe(22000000);
      expect(body.data.category).toBe('AI');
      expect(body.data.scope.th).toEqual(fullUpdatePayload.scope.th);
      expect(body.data.qualifications.th).toEqual(fullUpdatePayload.qualifications.th);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Detail View Consistency after TOR Text Corrections (GET /api/projects/:id)
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Opportunity Detail Consistency after TOR Corrections (GET /api/projects/:id)', () => {
    it('8.1 detail view returns the manually corrected Scope and Qualifications bullet points', async () => {
      const dbProjects = require('@/services/database/projects');
      const updatedProject = {
        ...SAMPLE_PROJECT,
        title: {
          th: 'ระบบปัญญาประดิษฐ์ทางการแพทย์ กทม. (อนุมัติแล้ว)',
          en: 'BMA Medical AI System (Approved)',
        },
        scope: {
          th: ['1. แก้ไขขอบเขตงาน: ติดตั้ง AI ใน 11 โรงพยาบาล', '2. บำรุงรักษา 3 ปี'],
          en: ['1. Corrected Scope: Deploy AI in 11 hospitals', '2. 3-year maintenance'],
        },
        qualifications: {
          th: ['1. แก้ไขคุณสมบัติ: ทุนจดทะเบียน 15 ล้านบาทขึ้นไป'],
          en: ['1. Corrected Qual: Capital >= 15M THB'],
        },
        classificationReviewStatus: 'APPROVED',
      };
      dbProjects.getProjectByExternalId.mockResolvedValueOnce(updatedProject);

      const res = await projectGET(
        makeRequest(`${BASE}/api/projects/67119538991`, 'GET', undefined, ADMIN_USER),
        makeParams('67119538991'),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.title.th).toBe('ระบบปัญญาประดิษฐ์ทางการแพทย์ กทม. (อนุมัติแล้ว)');
      expect(body.data.scope.th).toEqual(['1. แก้ไขขอบเขตงาน: ติดตั้ง AI ใน 11 โรงพยาบาล', '2. บำรุงรักษา 3 ปี']);
      expect(body.data.qualifications.th).toEqual(['1. แก้ไขคุณสมบัติ: ทุนจดทะเบียน 15 ล้านบาทขึ้นไป']);
      expect(body.data.classificationReviewStatus).toBe('APPROVED');
    });

    it('8.2 returns 404 when project does not exist', async () => {
      const dbProjects = require('@/services/database/projects');
      dbProjects.getProjectByExternalId.mockResolvedValueOnce(null);
      dbProjects.getProjectById.mockResolvedValueOnce(null);

      const res = await projectGET(
        makeRequest(`${BASE}/api/projects/99999999999`, 'GET', undefined, ADMIN_USER),
        makeParams('99999999999'),
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/project not found/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Validation on Manual TOR Text Field Corrections (PUT /api/projects/:id)
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. Validation on Manual TOR Corrections (PUT /api/projects/:id)', () => {
    it('9.1 empty string in title returns 400 validation error', async () => {
      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          title: { th: '', en: '' }, // empty title invalid
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid update data/i);
      expect(json.details).toBeDefined();
    });

    it('9.2 negative budget value returns 400 validation error', async () => {
      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          budget: -500000, // Negative budget invalid
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(400);
    });

    it('9.3 invalid category enum value returns 400 validation error', async () => {
      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          category: 'Supercomputer Array', // Invalid enum
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(400);
    });

    it('9.4 non-array scope returns 400 validation error', async () => {
      const res = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          scope: 'Just a single string instead of { th: [], en: [] }',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(res.status).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Complete End-to-End Review Lifecycle (State Transition & Persistence)
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Complete End-to-End Review Lifecycle', () => {
    it('10.1 executes full review lifecycle: pending queue -> manual TOR correction -> classification override -> verified detail', async () => {
      const dbProjects = require('@/services/database/projects');

      // Step A: Inspect project in pending review queue
      const mockLean = jest.fn().mockResolvedValue([
        { ...SAMPLE_PROJECT, classificationReviewStatus: 'PENDING_REVIEW' },
      ]);
      const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      const mockSelect = jest.fn().mockReturnValue({ sort: mockSort });
      MockProject.find.mockReturnValue({ select: mockSelect });
      MockProject.countDocuments.mockResolvedValue(1);

      const queueRes = await classQueueGET(
        makeRequest(`${BASE}/api/admin/classification-queue`, 'GET', undefined, ADMIN_USER, {
          status: 'PENDING_REVIEW',
        }),
      );
      expect(queueRes.status).toBe(200);
      const queueBody = await queueRes.json();
      expect(queueBody.data[0].classificationReviewStatus).toBe('PENDING_REVIEW');

      // Step B: Admin manually corrects AI-extracted TOR text fields (Scope & Qualifications)
      const correctedScope = {
        th: ['1. ปรับปรุง: พัฒนาระบบ AI เชื่อมต่อ 11 รพ.', '2. จัดการข้อมูลเวชระเบียนแบบเข้ารหัส'],
        en: ['1. Updated: Deploy AI connecting 11 hospitals', '2. Encrypted medical record management'],
      };
      const correctedQuals = {
        th: ['1. นิติบุคคลไทย ทุนไม่น้อยกว่า 20,000,000 บาท', '2. มี ISO 27001 ด้านความปลอดภัยข้อมูล'],
        en: ['1. Thai entity with capital >= 20M THB', '2. ISO 27001 data security certified'],
      };

      const putRes = await projectPUT(
        makeRequest(`${BASE}/api/projects/67119538991`, 'PUT', {
          scope: correctedScope,
          qualifications: correctedQuals,
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(putRes.status).toBe(200);
      const putBody = await putRes.json();
      expect(putBody.data.scope.th).toEqual(correctedScope.th);
      expect(putBody.data.qualifications.th).toEqual(correctedQuals.th);

      // Step C: Admin overrides project classification to CORRECTED with notes
      MockProject.findOneAndUpdate.mockResolvedValueOnce({
        ...SAMPLE_PROJECT,
        category: 'AI',
        isSoftwareRelated: true,
        classificationReviewStatus: 'CORRECTED',
        classificationReviewNote: 'Admin confirmed high-confidence AI health platform with refined TOR scope',
        classificationReviewedBy: ADMIN_USER.id,
        classificationReviewedAt: new Date(),
      });

      const patchRes = await classificationPATCH(
        makeRequest(`${BASE}/api/projects/67119538991/classification`, 'PATCH', {
          category: 'AI',
          isSoftwareRelated: true,
          classificationReviewStatus: 'CORRECTED',
          classificationReviewNote: 'Admin confirmed high-confidence AI health platform with refined TOR scope',
        }, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json();
      expect(patchBody.data.classificationReviewStatus).toBe('CORRECTED');
      expect(patchBody.data.isSoftwareRelated).toBe(true);

      // Step D: Verify Opportunity Detail reflects both the corrected TOR and review state
      dbProjects.getProjectByExternalId.mockResolvedValueOnce({
        ...SAMPLE_PROJECT,
        scope: correctedScope,
        qualifications: correctedQuals,
        classificationReviewStatus: 'CORRECTED',
        classificationReviewNote: 'Admin confirmed high-confidence AI health platform with refined TOR scope',
        classificationReviewedBy: ADMIN_USER.id,
      });

      const detailRes = await projectGET(
        makeRequest(`${BASE}/api/projects/67119538991`, 'GET', undefined, ADMIN_USER),
        makeParams('67119538991'),
      );
      expect(detailRes.status).toBe(200);
      const detailBody = await detailRes.json();
      expect(detailBody.data.scope.th).toEqual(correctedScope.th);
      expect(detailBody.data.qualifications.th).toEqual(correctedQuals.th);
      expect(detailBody.data.classificationReviewStatus).toBe('CORRECTED');
    });
  });
});
