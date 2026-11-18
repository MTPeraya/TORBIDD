/**
 * @jest-environment node
 */
// =============================================================================
// services/ingestion/__tests__/bma-egp-ingestion.integration.test.ts
// Integration tests for BMA & e-GP Ingestion Pipeline:
// Data Ingestion -> Normalization -> Database Persistence -> Deduplication
// =============================================================================

import { setupTestDatabase } from '@/test/db-handler';
import { IngestionService } from '../ingestion.service';
import { BmaClient } from '../clients/bma-client';
import { EgpClient } from '../clients/egp-client';
import { GovSpendingClient } from '../clients/govspending-client';
import { TransformationAdapter } from '@/services/transformation/transformation-adapter';
import {
  upsertDiscoveredProjects,
  checkProjectDeduplication,
  generateProjectContentHash,
} from '@/services/database/procurement';
import ProcurementProject from '@/models/ProcurementProject';
import { DiscoveredProject } from '@/types/procurement';

describe('Ingestion Pipeline & Multi-Source Integration (BMA & e-GP)', () => {
  // Boots ephemeral MongoMemoryServer and cleans collections after each test
  setupTestDatabase();

  // ─── Mock Fixtures ─────────────────────────────────────────────────────────

  const MOCK_BMA_PROJECT_ID = '68019001234';
  const MOCK_BMA_GUID = 'bma-guid-001';
  const MOCK_EGP_PROJECT_ID = '68059888888';

  const mockBmaApiResponse = {
    totalCount: 2,
    data: [
      {
        projectNumber: MOCK_BMA_PROJECT_ID,
        projectId: MOCK_BMA_GUID,
        projectName: 'จ้างพัฒนาระบบคลาวด์และจัดการข้อมูลขนาดใหญ่ กทม.',
        masterOrgDepartmentName: 'สำนักยุทธศาสตร์และประเมินผล',
        projectBudget: 15000000,
        budgetYear: 2568,
        masterMethodIdName: 'e-bidding',
        masterGoodsIdName: 'จ้างพัฒนาระบบ',
      },
      {
        projectNumber: '68019009999',
        projectId: 'bma-guid-food',
        projectName: 'จัดซื้อวัตถุดิบประกอบอาหารกลางวันนักเรียน',
        masterOrgDepartmentName: 'สำนักการศึกษา',
        projectBudget: 2500000,
        budgetYear: 2568,
      },
    ],
  };

  const mockBmaAnnouncements = {
    data: [
      {
        id: 'ann-bma-01',
        masterAnnounceTypeName: 'ร่างขอบเขตของงาน (TOR)',
        projectAnnouncementPath: '/docs/2568/bma_cloud_tor.pdf',
        projectAnnouncementPublishDate: '2025-01-20T09:00:00.000Z',
      },
    ],
  };

  const mockBmaContracts = {
    data: [
      {
        projectContractBidderName: 'บริษัท คลาวด์ไทย อินโนเวชั่น จำกัด',
        projectContractContractBudget: 14850000,
        projectContractContractDate: '2025-02-15T00:00:00.000Z',
      },
    ],
  };

  const mockBmaDetail = {
    masterMethodIdName: 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',
    masterContractAvailableName: 'จัดทำสัญญาแล้ว',
  };

  const mockEgpRssXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>e-GP Procurement Announcements</title>
    <link>https://www.gprocurement.go.th</link>
    <item>
      <title><![CDATA[ประกวดราคาซื้อระบบบริหารจัดการฐานข้อมูลและซอฟต์แวร์ประมวลผล (Project ID: ${MOCK_EGP_PROJECT_ID})]]></title>
      <link><![CDATA[https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${MOCK_EGP_PROJECT_ID}]]></link>
      <description><![CDATA[หน่วยงาน: กรมสรรพากร งบประมาณ: 12,000,000 บาท]]></description>
      <pubDate><![CDATA[Tue, 14 Jan 2025 10:00:00 +0700]]></pubDate>
    </item>
    <item>
      <title><![CDATA[จ้างปรับปรุงถนนคอนกรีตเสริมเหล็ก (Project ID: 68059999999)]]></title>
      <link><![CDATA[https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=68059999999]]></link>
      <description><![CDATA[หน่วยงาน: กรมทางหลวงชนบท งบประมาณ: 5,000,000 บาท]]></description>
      <pubDate><![CDATA[Wed, 15 Jan 2025 11:00:00 +0700]]></pubDate>
    </item>
  </channel>
</rss>`;

  // Mock CKAN to return empty so tests focus strictly on BMA & e-GP
  function createMockGovSpendingClient(): GovSpendingClient {
    return {
      searchProjects: jest.fn().mockResolvedValue({ total: 0, projects: [] }),
      checkHealth: jest.fn().mockResolvedValue({ status: 'UP', latencyMs: 50 }),
    } as unknown as GovSpendingClient;
  }

  // ─── A. Data Ingestion Tests ───────────────────────────────────────────────
  describe('A. Data Ingestion (BMA & e-GP Clients)', () => {
    describe('BMA e-Procurement Ingestion', () => {
      it('fetches and enriches BMA projects with announcements and contract details', async () => {
        const mockFetch = jest.fn().mockImplementation(async (url: string) => {
          if (url.includes('GetProjectFromFilter')) {
            return new Response(JSON.stringify(mockBmaApiResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if (url.includes('GetAnnouncementDetailInProject')) {
            return new Response(JSON.stringify(mockBmaAnnouncements), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if (url.includes('GetProjectContractInProject')) {
            return new Response(JSON.stringify(mockBmaContracts), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if (url.includes('GetProjectDetail')) {
            return new Response(JSON.stringify(mockBmaDetail), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response('Not found', { status: 404 });
        });

        const client = new BmaClient({ fetchImpl: mockFetch as unknown as typeof fetch });
        const result = await client.searchProjects({ keyword: 'คลาวด์' });

        expect(result.projects).toHaveLength(2);
        expect(result.projects[0].externalProjectId).toBe(MOCK_BMA_PROJECT_ID);

        // Test enrichment
        const enriched = await client.enrichProject(result.projects[0]);
        expect(enriched.torStatus).toBe('AVAILABLE');
        expect(enriched.winnerName).toBe('บริษัท คลาวด์ไทย อินโนเวชั่น จำกัด');
        expect(enriched.contractPrice).toBe(14850000);
        expect(enriched.status).toBe('จัดทำสัญญาแล้ว');
        expect(enriched.sourceUrl).toContain('bma_cloud_tor.pdf');
      });

      it('handles empty BMA search response gracefully', async () => {
        const mockFetch = jest.fn().mockResolvedValue(
          new Response(JSON.stringify({ totalCount: 0, data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

        const client = new BmaClient({ fetchImpl: mockFetch as unknown as typeof fetch });
        const result = await client.searchProjects({ keyword: 'ไม่มีโครงการ' });

        expect(result.total).toBe(0);
        expect(result.projects).toEqual([]);
      });

      it('handles malformed BMA JSON data without throwing exceptions', async () => {
        const mockFetch = jest.fn().mockResolvedValue(
          new Response(JSON.stringify({ data: [{ corruptKey: 123 }, null, undefined] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

        const client = new BmaClient({ fetchImpl: mockFetch as unknown as typeof fetch });
        const result = await client.searchProjects();

        // Items without valid ID/name should be filtered out safely
        expect(result.projects).toEqual([]);
      });

      it('handles BMA API HTTP failure with fallback', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('BMA Gateway Timeout 504'));

        const client = new BmaClient({ fetchImpl: mockFetch as unknown as typeof fetch });
        const result = await client.searchProjects();

        expect(result.total).toBe(0);
        expect(result.projects).toEqual([]);
      });
    });

    describe('e-GP Announcements RSS Ingestion', () => {
      it('fetches and parses e-GP RSS announcements into discovered project records', async () => {
        const mockFetch = jest.fn().mockResolvedValue(
          new Response(mockEgpRssXml, {
            status: 200,
            headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
          }),
        );

        const client = new EgpClient({ fetchImpl: mockFetch as unknown as typeof fetch });
        const result = await client.pollAnnouncements();

        expect(result.total).toBe(2);
        expect(result.projects[0].externalProjectId).toBe(MOCK_EGP_PROJECT_ID);
        expect(result.projects[0].budget).toBe(12000000);
        expect(result.projects[0].source).toBe('NATIONAL_EGP');
        expect(result.projects[0].fiscalYear).toBe(2568);
        expect(result.projects[0].agencyName).toBe('กรมบัญชีกลาง');
      });

      it('handles empty e-GP RSS channel gracefully', async () => {
        const emptyXml = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`;
        const mockFetch = jest.fn().mockResolvedValue(
          new Response(emptyXml, {
            status: 200,
            headers: { 'Content-Type': 'application/rss+xml' },
          }),
        );

        const client = new EgpClient({ fetchImpl: mockFetch as unknown as typeof fetch });
        const result = await client.pollAnnouncements();

        expect(result.total).toBe(0);
        expect(result.projects).toEqual([]);
      });

      it('handles malformed e-GP XML without crashing', async () => {
        const brokenXml = `<rss><channel><item><title>Broken Item without closing tags`;
        const mockFetch = jest.fn().mockResolvedValue(
          new Response(brokenXml, { status: 200, headers: { 'Content-Type': 'text/xml' } }),
        );

        const client = new EgpClient({ fetchImpl: mockFetch as unknown as typeof fetch });
        const result = await client.pollAnnouncements();

        expect(result.total).toBe(0);
        expect(result.projects).toEqual([]);
      });

      it('handles e-GP network failure gracefully', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('Connection reset by peer'));

        const client = new EgpClient({ fetchImpl: mockFetch as unknown as typeof fetch });
        const result = await client.pollAnnouncements();

        expect(result.total).toBe(0);
        expect(result.projects).toEqual([]);
      });
    });
  });

  // ─── B. Data Normalization Tests ───────────────────────────────────────────
  describe('B. Data Normalization (Field Mapping, Types & Source Identifiers)', () => {
    const adapter = new TransformationAdapter();

    it('normalizes BMA project payload into canonical schema', () => {
      const bmaRaw = {
        project_id: MOCK_BMA_PROJECT_ID,
        project_name: 'จ้างพัฒนาระบบคลาวด์และจัดการข้อมูลขนาดใหญ่ กทม.',
        dept_name: 'สำนักยุทธศาสตร์และประเมินผล',
        year: 2568,
        budget: '15,000,000.00 บาท',
        contract_price: '14,850,000 บาท',
        publish_date: '2025-01-20T09:00:00.000Z',
        source: 'BMA_EGP',
        source_url: 'https://egp2.bangkok.go.th/project-detail?id=123',
        transaction_sub_type_name: 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',
      };

      const result = adapter.transform(bmaRaw);

      expect(result.status).toBe('VALID');
      expect(result.data).toBeDefined();
      expect(result.data?.externalProjectId).toBe(MOCK_BMA_PROJECT_ID);
      expect(result.data?.agencyName).toBe('สำนักยุทธศาสตร์และประเมินผล');
      expect(result.data?.budget).toBe(15000000);
      expect(result.data?.contractPrice).toBe(14850000);
      expect(result.data?.fiscalYear).toBe(2568);
      expect(result.data?.source).toBe('BMA_EGP');
      expect(result.data?.publishDate).toBe('2025-01-20T09:00:00.000Z');
      expect(result.data?.contentHash).toHaveLength(64);
    });

    it('normalizes e-GP procurement announcement payload into canonical schema', () => {
      const egpRaw = {
        project_id: MOCK_EGP_PROJECT_ID,
        project_name: 'ประกวดราคาซื้อระบบบริหารจัดการฐานข้อมูลและซอฟต์แวร์ประมวลผล',
        dept_name: 'กรมสรรพากร',
        year: '2568',
        price: '12,000,000',
        publish_date: '14 ม.ค. 2568', // Thai Buddhist Era format
        source: 'NATIONAL_EGP',
        source_url: 'https://process5.gprocurement.go.th/egp',
        procurement_type: 'ประกาศจัดซื้อจัดจ้าง e-GP',
      };

      const result = adapter.transform(egpRaw);

      expect(result.status).toBe('VALID');
      expect(result.data).toBeDefined();
      expect(result.data?.externalProjectId).toBe(MOCK_EGP_PROJECT_ID);
      expect(result.data?.budget).toBe(12000000);
      expect(result.data?.fiscalYear).toBe(2568);
      expect(result.data?.source).toBe('NATIONAL_EGP');
      expect(result.data?.publishDate).toBeDefined();
      expect(result.data?.contentHash).toHaveLength(64);
    });

    it('handles missing values and defaults appropriately (with warning flags)', () => {
      const minimalRaw = {
        project_id: '68000011111',
        project_name: 'โครงการระบบสารสนเทศ',
        // missing budget, dept, year
      };

      const result = adapter.transform(minimalRaw);

      // Successfully normalized into schema, flagged for missing/zero budget
      expect(result.status).toBe('FLAGGED');
      expect(result.data).toBeDefined();
      expect(result.data?.budget).toBe(0);
      expect(result.data?.agencyName).toBe('กรุงเทพมหานคร / หน่วยงานภาครัฐ');
      expect(result.data?.fiscalYear).toBeGreaterThanOrEqual(2500); // Defaults to current Thai year
      expect(result.flags.some((f) => f.includes('Budget is 0 THB'))).toBe(true);
    });

    it('rejects invalid payloads missing critical identifiers', () => {
      const invalidRaw = {
        // missing project_id and project_name
        budget: 500000,
      };

      const result = adapter.transform(invalidRaw);
      expect(result.status).toBe('REJECTED');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ─── C. Database Persistence Tests ─────────────────────────────────────────
  describe('C. Database Persistence (Isolated In-Memory MongoDB)', () => {
    it('persists normalized BMA project with complete attributes into database', async () => {
      const bmaProject: DiscoveredProject = {
        externalProjectId: MOCK_BMA_PROJECT_ID,
        projectName: 'จ้างพัฒนาระบบคลาวด์และจัดการข้อมูลขนาดใหญ่ กทม.',
        agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
        fiscalYear: 2568,
        source: 'BMA_EGP',
        sourceUrl: 'https://egp2.bangkok.go.th/notice/001',
        budget: 15000000,
        contractPrice: 14850000,
        winnerName: 'บริษัท คลาวด์ไทย อินโนเวชั่น จำกัด',
        procurementType: 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',
        publishDate: new Date('2025-01-20T09:00:00.000Z'),
        deadline: new Date('2025-02-28T16:30:00.000Z'),
        status: 'จัดทำสัญญาแล้ว',
        torStatus: 'AVAILABLE',
        is_software: true,
        software_category: 'Cloud',
      };

      const { upsertedCount } = await upsertDiscoveredProjects([bmaProject]);
      expect(upsertedCount).toBe(1);

      // Verify directly from MongoDB
      const doc = await ProcurementProject.findOne({ externalProjectId: MOCK_BMA_PROJECT_ID });
      expect(doc).not.toBeNull();
      expect(doc?.externalProjectId).toBe(MOCK_BMA_PROJECT_ID);
      expect(doc?.source).toBe('BMA_EGP');
      expect(doc?.budget).toBe(15000000);
      expect(doc?.contractPrice).toBe(14850000);
      expect(doc?.winnerName).toBe('บริษัท คลาวด์ไทย อินโนเวชั่น จำกัด');
      expect(doc?.torStatus).toBe('AVAILABLE');
      expect(doc?.software_category).toBe('Cloud');
      expect(doc?.revision).toBe(1);
      expect(doc?.contentHash).toHaveLength(64);
    });

    it('persists normalized e-GP project into database', async () => {
      const egpProject: DiscoveredProject = {
        externalProjectId: MOCK_EGP_PROJECT_ID,
        projectName: 'ประกวดราคาซื้อระบบบริหารจัดการฐานข้อมูลและซอฟต์แวร์ประมวลผล',
        agencyName: 'กรมสรรพากร',
        fiscalYear: 2568,
        source: 'NATIONAL_EGP',
        sourceUrl: 'https://process5.gprocurement.go.th/001',
        budget: 12000000,
        procurementType: 'ประกาศจัดซื้อจัดจ้าง e-GP',
        publishDate: new Date('2025-01-14T03:00:00.000Z'),
        status: 'ประกาศเชิญชวน',
        is_software: true,
        software_category: 'Database',
      };

      const { upsertedCount } = await upsertDiscoveredProjects([egpProject]);
      expect(upsertedCount).toBe(1);

      const doc = await ProcurementProject.findOne({ externalProjectId: MOCK_EGP_PROJECT_ID });
      expect(doc).not.toBeNull();
      expect(doc?.source).toBe('NATIONAL_EGP');
      expect(doc?.budget).toBe(12000000);
      expect(doc?.software_category).toBe('Database');
      expect(doc?.status).toBe('ประกาศเชิญชวน');
    });
  });

  // ─── D. Deduplication Tests ───────────────────────────────────────────────
  describe('D. Deduplication & Revision Tracking', () => {
    const sampleBmaProject: DiscoveredProject = {
      externalProjectId: MOCK_BMA_PROJECT_ID,
      projectName: 'จ้างพัฒนาระบบคลาวด์และจัดการข้อมูลขนาดใหญ่ กทม.',
      agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
      fiscalYear: 2568,
      source: 'BMA_EGP',
      sourceUrl: 'https://egp2.bangkok.go.th',
      budget: 15000000,
      procurementType: 'e-bidding',
    };

    const sampleEgpProject: DiscoveredProject = {
      externalProjectId: MOCK_EGP_PROJECT_ID,
      projectName: 'ประกวดราคาซื้อระบบบริหารจัดการฐานข้อมูล',
      agencyName: 'กรมสรรพากร',
      fiscalYear: 2568,
      source: 'NATIONAL_EGP',
      sourceUrl: 'https://gprocurement.go.th',
      budget: 12000000,
      procurementType: 'e-GP Announcement',
    };

    it('detects duplicate ingestion and avoids creating redundant documents (idempotency)', async () => {
      // 1. Initial ingestion
      const res1 = await upsertDiscoveredProjects([sampleBmaProject]);
      expect(res1.upsertedCount).toBe(1);
      expect(await ProcurementProject.countDocuments()).toBe(1);

      // 2. Pre-ingestion deduplication check
      const dedupCheck = await checkProjectDeduplication([sampleBmaProject]);
      expect(dedupCheck.newProjects).toHaveLength(0);
      expect(dedupCheck.duplicateProjects).toHaveLength(1);
      expect(dedupCheck.metrics.duplicateCount).toBe(1);

      // 3. Repeated ingestion
      const res2 = await upsertDiscoveredProjects([sampleBmaProject]);
      expect(res2.upsertedCount).toBe(0); // No new documents created

      // Total documents must remain exactly 1
      const totalDocs = await ProcurementProject.countDocuments();
      expect(totalDocs).toBe(1);
    });

    it('tracks content revision when details or budget change', async () => {
      // Ingest initial record (Revision 1)
      await upsertDiscoveredProjects([sampleBmaProject]);
      const initialDoc = await ProcurementProject.findOne({ externalProjectId: MOCK_BMA_PROJECT_ID });
      expect(initialDoc?.revision).toBe(1);
      const initialHash = initialDoc?.contentHash;

      // Budget amendment: 15M -> 16.5M
      const amendedProject: DiscoveredProject = {
        ...sampleBmaProject,
        budget: 16500000,
      };

      const dedupCheck = await checkProjectDeduplication([amendedProject]);
      expect(dedupCheck.newProjects).toHaveLength(0);
      expect(dedupCheck.updatedProjects).toHaveLength(1);
      expect(dedupCheck.updatedProjects[0].oldRevision).toBe(1);
      expect(dedupCheck.updatedProjects[0].newRevision).toBe(2);

      // Upsert the amended project
      const upsertRes = await upsertDiscoveredProjects([amendedProject]);
      expect(upsertRes.upsertedCount).toBe(0); // Updated, not new insert

      const updatedDoc = await ProcurementProject.findOne({ externalProjectId: MOCK_BMA_PROJECT_ID });
      expect(updatedDoc?.revision).toBe(2);
      expect(updatedDoc?.budget).toBe(16500000);
      expect(updatedDoc?.contentHash).not.toBe(initialHash);

      // Total documents in DB must still be 1
      expect(await ProcurementProject.countDocuments()).toBe(1);
    });

    it('preserves cross-source isolation (legitimate BMA and e-GP records are not conflated)', async () => {
      // Ingest BMA record
      await upsertDiscoveredProjects([sampleBmaProject]);

      // Ingest e-GP record
      await upsertDiscoveredProjects([sampleEgpProject]);

      // Both should coexist independently in the database
      const count = await ProcurementProject.countDocuments();
      expect(count).toBe(2);

      const bmaDoc = await ProcurementProject.findOne({ externalProjectId: MOCK_BMA_PROJECT_ID });
      const egpDoc = await ProcurementProject.findOne({ externalProjectId: MOCK_EGP_PROJECT_ID });

      expect(bmaDoc?.source).toBe('BMA_EGP');
      expect(bmaDoc?.projectName).toContain('คลาวด์');
      expect(egpDoc?.source).toBe('NATIONAL_EGP');
      expect(egpDoc?.projectName).toContain('ฐานข้อมูล');
    });
  });

  // ─── E. End-to-End Pipeline Integration Tests ─────────────────────────────
  describe('E. End-to-End Pipeline Integration', () => {
    it('executes full pipeline: Multi-source Fetch -> Classification -> Filter -> DB Persistence', async () => {
      // Setup mocked clients with realistic multi-source responses
      const mockBmaFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('GetProjectFromFilter')) {
          return new Response(JSON.stringify(mockBmaApiResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('GetAnnouncementDetailInProject')) {
          return new Response(JSON.stringify(mockBmaAnnouncements), { status: 200 });
        }
        if (url.includes('GetProjectContractInProject')) {
          return new Response(JSON.stringify(mockBmaContracts), { status: 200 });
        }
        if (url.includes('GetProjectDetail')) {
          return new Response(JSON.stringify(mockBmaDetail), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      });

      const mockEgpFetch = jest.fn().mockImplementation(async () => {
        return new Response(mockEgpRssXml, {
          status: 200,
          headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
        });
      });

      const bmaClient = new BmaClient({ fetchImpl: mockBmaFetch as unknown as typeof fetch });
      const egpClient = new EgpClient({ fetchImpl: mockEgpFetch as unknown as typeof fetch });
      const govSpendingClient = createMockGovSpendingClient();

      const service = new IngestionService({
        bmaClient,
        egpClient,
        govSpendingClient,
      });

      // Execute unified discovery
      const pipelineResult = await service.discoverFromAllSources({ keyword: 'ซอฟต์แวร์' });

      // Verify classification and filtering:
      // - BMA returned 2 items: 1 software (Cloud), 1 food (filtered out)
      // - e-GP returned 2 items: 1 software (Database), 1 road (filtered out)
      // Total software projects persisted should be 2
      expect(pipelineResult.totalProjects).toBe(2);
      expect(pipelineResult.upsertedCount).toBe(2);
      expect(pipelineResult.bySource.BMA_EGP).toBe(2);
      expect(pipelineResult.bySource.NATIONAL_EGP).toBe(2);

      // Verify database state
      const persistedInDb = await ProcurementProject.find().sort({ source: 1 }).lean();
      expect(persistedInDb).toHaveLength(2);

      const bmaStored = persistedInDb.find((p) => p.source === 'BMA_EGP');
      const egpStored = persistedInDb.find((p) => p.source === 'NATIONAL_EGP');

      expect(bmaStored).toBeDefined();
      expect(bmaStored?.externalProjectId).toBe(MOCK_BMA_PROJECT_ID);
      expect(bmaStored?.is_software).toBe(true);
      expect(bmaStored?.winnerName).toBe('บริษัท คลาวด์ไทย อินโนเวชั่น จำกัด');

      expect(egpStored).toBeDefined();
      expect(egpStored?.externalProjectId).toBe(MOCK_EGP_PROJECT_ID);
      expect(egpStored?.is_software).toBe(true);
      expect(egpStored?.budget).toBe(12000000);
    });

    it('ensures end-to-end repeated pipeline execution is fully idempotent', async () => {
      const mockBmaFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('GetProjectFromFilter')) {
          return new Response(JSON.stringify(mockBmaApiResponse), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      });

      const mockEgpFetch = jest.fn().mockImplementation(async () => {
        return new Response(mockEgpRssXml, {
          status: 200,
          headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
        });
      });

      const service = new IngestionService({
        bmaClient: new BmaClient({ fetchImpl: mockBmaFetch as unknown as typeof fetch }),
        egpClient: new EgpClient({ fetchImpl: mockEgpFetch as unknown as typeof fetch }),
        govSpendingClient: createMockGovSpendingClient(),
      });

      // Run 1: Inserts records
      const run1 = await service.discoverFromAllSources();
      expect(run1.upsertedCount).toBe(2);
      const countAfterRun1 = await ProcurementProject.countDocuments();
      expect(countAfterRun1).toBe(2);

      // Run 2: Exact same input — should update/match existing without inserting new rows
      const run2 = await service.discoverFromAllSources();
      expect(run2.upsertedCount).toBe(0);
      const countAfterRun2 = await ProcurementProject.countDocuments();
      expect(countAfterRun2).toBe(2);
    });
  });
});
