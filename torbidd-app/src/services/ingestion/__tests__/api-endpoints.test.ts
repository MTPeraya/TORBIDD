/**
 * @jest-environment node
 */
// =============================================================================
// services/ingestion/__tests__/api-endpoints.test.ts
// Tests for Route Handlers:
// - POST /api/ingestion/discover
// - POST /api/ingestion/projects/[projectId]/documents
// - GET /api/projects
// - GET /api/projects/[id]
// =============================================================================

import { NextRequest } from 'next/server';
import { POST as discoverHandler } from '@/app/api/ingestion/discover/route';
import { POST as documentsHandler } from '@/app/api/ingestion/projects/[projectId]/documents/route';
import { GET as projectsHandler } from '@/app/api/projects/route';
import { GET as projectDetailHandler } from '@/app/api/projects/[id]/route';
import { IngestionService } from '@/services/ingestion/ingestion.service';
import * as procurementDb from '@/services/database/procurement';

jest.mock('@/services/ingestion/ingestion.service');
jest.mock('@/services/database/procurement');
jest.mock('@/services/database/projects');

describe('Ingestion API Route Handlers', () => {
  const MOCK_PROJECT_ID = '67119538991';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/ingestion/discover ──────────────────────────────────────────
  describe('POST /api/ingestion/discover', () => {
    it('should validate input and return discovered projects', async () => {
      const mockResult = {
        total: 1,
        page: 1,
        limit: 10,
        offset: 0,
        upsertedCount: 1,
        modifiedCount: 0,
        projects: [
          {
            externalProjectId: MOCK_PROJECT_ID,
            projectName: 'โครงการพัฒนาระบบคลังข้อมูล',
            agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
            fiscalYear: 2568,
            source: 'CKAN_GOVSPENDING',
            sourceUrl: 'https://process5.gprocurement.go.th/...',
          },
        ],
      };

      (IngestionService.prototype.discoverProjects as jest.Mock).mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/ingestion/discover', {
        method: 'POST',
        body: JSON.stringify({ keyword: 'ระบบ', fiscalYear: 2568, page: 1, limit: 10 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await discoverHandler(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.total).toBe(1);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].externalProjectId).toBe(MOCK_PROJECT_ID);
    });

    it('should return 400 for invalid input format', async () => {
      const request = new NextRequest('http://localhost:3000/api/ingestion/discover', {
        method: 'POST',
        body: JSON.stringify({ fiscalYear: 1800 }), // fiscal year < 2500 is invalid
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await discoverHandler(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('Invalid input parameters');
    });

    it('should return 503 if GOVSPENDING_API_KEY is not configured', async () => {
      (IngestionService.prototype.discoverProjects as jest.Mock).mockRejectedValue(
        new Error('GOVSPENDING_API_KEY is not configured. Please set GOVSPENDING_API_KEY in your environment variables.'),
      );

      const request = new NextRequest('http://localhost:3000/api/ingestion/discover', {
        method: 'POST',
        body: JSON.stringify({ keyword: 'AI' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await discoverHandler(request);
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.error).toBe('Configuration Error');
    });
  });

  // ─── POST /api/ingestion/projects/[projectId]/documents ────────────────────
  describe('POST /api/ingestion/projects/[projectId]/documents', () => {
    it('should validate 11-digit project ID and ingest documents successfully', async () => {
      const mockResult = {
        projectId: '65f123456789abcdef012345',
        externalProjectId: MOCK_PROJECT_ID,
        documentsFound: 1,
        alreadyIngested: false,
        documents: [
          {
            externalProjectId: MOCK_PROJECT_ID,
            documentType: 'ATTACH_TOR',
            fileName: 'Attach_TOR_1.pdf',
            filePath: `storage/documents/${MOCK_PROJECT_ID}/Attach_TOR_1.pdf`,
            status: 'PROCESSED',
          },
        ],
      };

      (IngestionService.prototype.ingestProjectDocuments as jest.Mock).mockResolvedValue(mockResult);

      const request = new NextRequest(
        `http://localhost:3000/api/ingestion/projects/${MOCK_PROJECT_ID}/documents`,
        { method: 'POST' },
      );

      const response = await documentsHandler(request, {
        params: Promise.resolve({ projectId: MOCK_PROJECT_ID }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.documentsFound).toBe(1);
      expect(body.documents[0].fileName).toBe('Attach_TOR_1.pdf');
    });

    it('should reject invalid project ID with HTTP 400', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/ingestion/projects/bad_id/documents',
        { method: 'POST' },
      );

      const response = await documentsHandler(request, {
        params: Promise.resolve({ projectId: 'bad_id' }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid Project ID');
    });

    it('should return 404 when project has no downloadable archive on e-GP', async () => {
      (IngestionService.prototype.ingestProjectDocuments as jest.Mock).mockRejectedValue(
        new Error('e-GP has no document metadata available for project 67119538991'),
      );

      const request = new NextRequest(
        `http://localhost:3000/api/ingestion/projects/${MOCK_PROJECT_ID}/documents`,
        { method: 'POST' },
      );

      const response = await documentsHandler(request, {
        params: Promise.resolve({ projectId: MOCK_PROJECT_ID }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Archive Not Found');
    });
  });

  // ─── GET /api/projects ─────────────────────────────────────────────────────
  describe('GET /api/projects', () => {
    it('should return discovered procurement projects when queried with source=CKAN_GOVSPENDING', async () => {
      const mockProjects = [
        {
          externalProjectId: MOCK_PROJECT_ID,
          projectName: 'โครงการจัดซื้อโปรแกรม',
          agencyName: 'กรุงเทพมหานคร',
          fiscalYear: 2568,
          source: 'CKAN_GOVSPENDING',
        },
      ];

      (procurementDb.getProcurementProjects as jest.Mock).mockResolvedValue({
        projects: mockProjects,
        total: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/projects?source=CKAN_GOVSPENDING');
      const response = await projectsHandler(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.total).toBe(1);
      expect(body.data[0].externalProjectId).toBe(MOCK_PROJECT_ID);
    });
  });

  // ─── GET /api/projects/[id] ────────────────────────────────────────────────
  describe('GET /api/projects/[id]', () => {
    it('should return project metadata along with its associated documents', async () => {
      const mockProject = {
        _id: '65f123456789abcdef012345',
        externalProjectId: MOCK_PROJECT_ID,
        projectName: 'โครงการพัฒนาแพลตฟอร์มสารสนเทศ',
        agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
        fiscalYear: 2568,
      };

      const mockDocuments = [
        {
          _id: 'doc123',
          externalProjectId: MOCK_PROJECT_ID,
          documentType: 'ATTACH_TOR',
          fileName: 'Attach_TOR_1.pdf',
          filePath: `storage/documents/${MOCK_PROJECT_ID}/Attach_TOR_1.pdf`,
          status: 'PROCESSED',
        },
      ];

      (procurementDb.getProjectWithDocuments as jest.Mock).mockResolvedValue({
        project: mockProject,
        documents: mockDocuments,
      });

      const request = new NextRequest(`http://localhost:3000/api/projects/${MOCK_PROJECT_ID}`);
      const response = await projectDetailHandler(request, {
        params: Promise.resolve({ id: MOCK_PROJECT_ID }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.externalProjectId).toBe(MOCK_PROJECT_ID);
      expect(body.data.documents).toHaveLength(1);
      expect(body.data.documents[0].fileName).toBe('Attach_TOR_1.pdf');
    });
  });
});
