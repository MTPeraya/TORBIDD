/**
 * @jest-environment node
 */
// =============================================================================
// services/ingestion/__tests__/ingestion-pipeline.test.ts
// Tests: 11. Duplicate project, 12. Duplicate TOR document, and end-to-end pipeline
// =============================================================================

import { zipSync, strToU8 } from 'fflate';
import { IngestionService } from '../ingestion.service';
import { GovSpendingClient } from '../clients/govspending-client';
import { EgpClient } from '../clients/egp-client';
import { DocumentExtractor } from '../document-extractor';
import * as procurementDb from '@/services/database/procurement';

// Mock database operations to run cleanly without live MongoDB connection
jest.mock('@/services/database/procurement');

describe('IngestionService Pipeline & Idempotency', () => {
  const MOCK_PROJECT_ID = '67119538991';
  const VALID_PDF_BYTES = strToU8('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── 11. Duplicate Project (Idempotency) ──────────────────────────────────
  it('11. should handle duplicate project discovery idempotently without creating duplicates', async () => {
    const mockDiscoveredProjects = [
      {
        externalProjectId: MOCK_PROJECT_ID,
        projectName: 'โครงการจ้างพัฒนาระบบ AI สำหรับวิเคราะห์ข้อมูล',
        agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
        fiscalYear: 2568,
        source: 'CKAN_GOVSPENDING',
        sourceUrl: 'https://process5.gprocurement.go.th/...',
      },
    ];

    const mockGovClient = {
      searchProjects: jest.fn().mockResolvedValue({
        total: 1,
        page: 1,
        limit: 10,
        offset: 0,
        projects: mockDiscoveredProjects,
      }),
    } as unknown as GovSpendingClient;

    // First discovery run: 1 inserted
    (procurementDb.upsertDiscoveredProjects as jest.Mock).mockResolvedValueOnce({
      upsertedCount: 1,
      modifiedCount: 0,
      matchedCount: 0,
    });

    const service = new IngestionService({ govSpendingClient: mockGovClient });

    const run1 = await service.discoverProjects({ keyword: 'AI', fiscalYear: 2568 });
    expect(run1.projects).toHaveLength(1);
    expect(run1.upsertedCount).toBe(1);
    expect(procurementDb.upsertDiscoveredProjects).toHaveBeenCalledTimes(1);

    // Second discovery run with identical project: 0 inserted, 1 matched/modified
    (procurementDb.upsertDiscoveredProjects as jest.Mock).mockResolvedValueOnce({
      upsertedCount: 0,
      modifiedCount: 1,
      matchedCount: 1,
    });

    const run2 = await service.discoverProjects({ keyword: 'AI', fiscalYear: 2568 });
    expect(run2.projects).toHaveLength(1);
    expect(run2.upsertedCount).toBe(0);
    expect(run2.modifiedCount).toBe(1);
    expect(procurementDb.upsertDiscoveredProjects).toHaveBeenCalledTimes(2);
  });

  // ─── 12. Duplicate TOR Document (Idempotency) ─────────────────────────────
  it('12. should detect already downloaded TOR document and skip redundant download', async () => {
    const existingDocRecord = {
      projectId: '65f123456789abcdef012345',
      externalProjectId: MOCK_PROJECT_ID,
      documentType: 'ATTACH_TOR' as const,
      fileName: 'Attach_TOR_1.pdf',
      filePath: `storage/documents/${MOCK_PROJECT_ID}/Attach_TOR_1.pdf`,
      storageReference: `/app/storage/documents/${MOCK_PROJECT_ID}/Attach_TOR_1.pdf`,
      source: 'NATIONAL_EGP',
      sourceUrl: 'https://process5.gprocurement.go.th/...',
      fileSize: 1024,
      mimeType: 'application/pdf',
      downloadedAt: new Date(),
      status: 'PROCESSED' as const,
    };

    // Simulate DB returning existing document for this project
    (procurementDb.getDocumentsByProjectId as jest.Mock).mockResolvedValue([existingDocRecord]);

    const mockEgpClient = {
      assertProjectId: jest.fn(),
      fetchProjectZip: jest.fn(),
    } as unknown as EgpClient;

    const mockExtractor = {
      extractZip: jest.fn(),
      persistDocumentsToDisk: jest.fn(),
    } as unknown as DocumentExtractor;

    const service = new IngestionService({
      egpClient: mockEgpClient,
      documentExtractor: mockExtractor,
    });

    const result = await service.ingestProjectDocuments(MOCK_PROJECT_ID);

    expect(result.alreadyIngested).toBe(true);
    expect(result.documentsFound).toBe(1);
    expect(result.documents[0].fileName).toBe('Attach_TOR_1.pdf');

    // Crucial check: Neither e-GP nor extractor were called again!
    expect(mockEgpClient.fetchProjectZip).not.toHaveBeenCalled();
    expect(mockExtractor.extractZip).not.toHaveBeenCalled();
  });

  // ─── Full End-to-End Flow ─────────────────────────────────────────────────
  it('should execute end-to-end: fetch ZIP, extract ATTACH_TOR, and persist document', async () => {
    // 1. Initial state: no documents exist in DB
    (procurementDb.getDocumentsByProjectId as jest.Mock).mockResolvedValue([]);
    (procurementDb.getProcurementProjectByExternalId as jest.Mock).mockResolvedValue({
      _id: '65f123456789abcdef012345',
      externalProjectId: MOCK_PROJECT_ID,
      projectName: 'Test Project',
    });

    const zipData = zipSync({
      'Attach_TOR_1.pdf': VALID_PDF_BYTES,
    });

    const mockEgpClient = {
      assertProjectId: jest.fn(),
      fetchProjectZip: jest.fn().mockResolvedValue({
        metadata: {
          projectId: MOCK_PROJECT_ID,
          zipId: 'zip12345',
          archiveName: `${MOCK_PROJECT_ID}.zip`,
        },
        zipBuffer: Buffer.from(zipData),
        contentLength: zipData.length,
      }),
    } as unknown as EgpClient;

    const mockExtractor = new DocumentExtractor({ storagePath: '/tmp/torbidd-test-e2e' });
    jest.spyOn(mockExtractor, 'persistDocumentsToDisk').mockResolvedValue([
      {
        document: {
          fileName: 'Attach_TOR_1.pdf',
          mimeType: 'application/pdf',
          content: Buffer.from(VALID_PDF_BYTES),
          documentType: 'ATTACH_TOR',
          sourceUrl: 'https://example.com/test',
          fileSize: VALID_PDF_BYTES.length,
        },
        relativePath: `storage/documents/${MOCK_PROJECT_ID}/Attach_TOR_1.pdf`,
        absolutePath: `/tmp/storage/documents/${MOCK_PROJECT_ID}/Attach_TOR_1.pdf`,
      },
    ]);

    (procurementDb.saveProcurementDocument as jest.Mock).mockResolvedValue({
      document: {
        _id: 'doc123',
        externalProjectId: MOCK_PROJECT_ID,
        fileName: 'Attach_TOR_1.pdf',
        documentType: 'ATTACH_TOR',
        status: 'PROCESSED',
      },
      isNew: true,
    });

    const service = new IngestionService({
      egpClient: mockEgpClient,
      documentExtractor: mockExtractor,
    });

    const result = await service.ingestProjectDocuments(MOCK_PROJECT_ID);

    expect(result.alreadyIngested).toBe(false);
    expect(result.documentsFound).toBe(1);
    expect(result.documents[0].fileName).toBe('Attach_TOR_1.pdf');
    expect(procurementDb.saveProcurementDocument).toHaveBeenCalledTimes(1);
  });
});
