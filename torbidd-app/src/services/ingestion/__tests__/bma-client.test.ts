// =============================================================================
// services/ingestion/__tests__/bma-client.test.ts
// Unit tests for BMA e-Procurement Client (egp2.bangkok.go.th)
// =============================================================================

import { BmaClient } from '../clients/bma-client';

describe('BmaClient (egp2.bangkok.go.th)', () => {
  describe('checkHealth()', () => {
    it('returns UP status when endpoint responds with 200 or 301/302', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const client = new BmaClient({
        baseUrl: 'https://egp2.bangkok.go.th',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const health = await client.checkHealth();
      expect(health.status).toBe('UP');
      expect(health.statusCode).toBe(200);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns DOWN status when network connection fails', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const client = new BmaClient({
        baseUrl: 'https://egp2.bangkok.go.th',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const health = await client.checkHealth();
      expect(health.status).toBe('DOWN');
      expect(health.error).toContain('Connection refused');
    });
  });

  describe('searchProjects()', () => {
    it('parses JSON API response when portal returns JSON format', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          total: 2,
          data: [
            {
              projectId: '66010001234',
              projectName: 'จ้างพัฒนาระบบเทคโนโลยีสารสนเทศ กทม.',
              departmentName: 'สำนักยุทธศาสตร์และประเมินผล',
              projectBudget: 5000000,
              budgetYear: 2568,
            },
            {
              projectId: '66010005678',
              projectName: 'จ้างปรับปรุงเว็บไซต์ศูนย์ข้อมูล กทม.',
              departmentName: 'สำนักงานเลขานุการผู้ว่าราชการกรุงเทพมหานคร',
              projectBudget: 1200000,
              budgetYear: 2568,
            },
          ],
        }),
      });

      const client = new BmaClient({
        baseUrl: 'https://egp2.bangkok.go.th',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await client.searchProjects({ keyword: 'สารสนเทศ' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.total).toBe(2);
      expect(result.projects).toHaveLength(2);
      expect(result.projects[0].externalProjectId).toBe('66010001234');
      expect(result.projects[0].source).toBe('BMA_EGP');
      expect(result.projects[0].sourceUrl).toBe('https://egp2.bangkok.go.th/project-detail/66010001234');
    });

    it('extracts project IDs from HTML when portal returns server-rendered page', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="list">
              <a href="/project-detail/67010099881">รายละเอียดโครงการ 1</a>
              <a href="/project-detail/67010099882">รายละเอียดโครงการ 2</a>
            </div>
          </body>
        </html>
      `;

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: async () => mockHtml,
      });

      const client = new BmaClient({
        baseUrl: 'https://egp2.bangkok.go.th',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await client.searchProjects({ limit: 10 });

      expect(result.projects).toHaveLength(2);
      expect(result.projects[0].externalProjectId).toBe('67010099881');
      expect(result.projects[0].source).toBe('BMA_EGP');
      expect(result.projects[1].externalProjectId).toBe('67010099882');
    });

    it('handles search network errors gracefully by returning empty results', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      const client = new BmaClient({
        baseUrl: 'https://egp2.bangkok.go.th',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await client.searchProjects();
      expect(result.total).toBe(0);
      expect(result.projects).toEqual([]);
    });

    it('queries Bangkok e-GP GetProjectFromFilter and maps projectNumber and budget', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          totalCount: 1,
          data: [
            {
              projectId: 'bma-guid-1234',
              projectNumber: '69109001213',
              projectName: 'ประกวดราคาจ้างค่าบำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์',
              masterOrgGroupName: 'สำนักยุทธศาสตร์และประเมินผล',
              masterOrgDepartmentName: 'สำนักงานพัฒนาระบบสารสนเทศดิจิทัล',
              projectBudget: 3900000,
            },
          ],
        }),
      });

      const client = new BmaClient({
        apiBaseUrl: 'https://egp2.bangkok.go.th/appapi/api',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await client.searchProjects({ keyword: 'โปรแกรม' });

      expect(result.total).toBe(1);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].externalProjectId).toBe('69109001213');
      expect(result.projects[0].fiscalYear).toBe(2569);
      expect(result.projects[0].budget).toBe(3900000);
      expect(result.projects[0].agencyName).toBe('สำนักงานพัฒนาระบบสารสนเทศดิจิทัล');
      expect(result.projects[0].source).toBe('BMA_EGP');
      expect(result.projects[0].sourceUrl).toBe('https://egp2.bangkok.go.th/project-detail/bma-guid-1234');
    });
  });

  describe('enrichProject()', () => {
    it('enriches project with TOR document link and signed contract winner', async () => {
      const mockFetch = jest.fn().mockImplementation(async (urlStr: string) => {
        if (urlStr.includes('GetAnnouncementDetailInProject')) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: 'ann-guid-001',
                  masterAnnounceTypeName: 'ร่างขอบเขตของงาน (TOR)',
                  projectAnnouncementPath: 'Attach_TOR_Document.pdf',
                  projectAnnouncementPublishDate: '2026-09-15T00:00:00Z',
                },
              ],
            }),
          };
        }
        if (urlStr.includes('GetProjectDetail')) {
          return {
            ok: true,
            json: async () => ({
              masterMethodIdName: 'e-Bidding',
              masterTypeIdName: 'จ้างทำของ',
              masterGoodsIdName: 'เทคโนโลยีสารสนเทศ',
              masterContractAvailableName: 'จัดทำสัญญาแล้ว',
            }),
          };
        }
        if (urlStr.includes('GetProjectContractInProject')) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  projectContractBidderName: 'บริษัท ทีเอ็กซ์ โซลูชั่นส์ จำกัด',
                  projectContractContractBudget: 3800000,
                  projectContractContractDate: '2026-09-28',
                },
              ],
            }),
          };
        }
        return { ok: false };
      });

      const client = new BmaClient({
        apiBaseUrl: 'https://egp2.bangkok.go.th/appapi/api',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const baseProject = {
        externalProjectId: '69109001213',
        projectName: 'บำรุงรักษาระบบ',
        agencyName: 'กทม.',
        fiscalYear: 2569,
        source: 'BMA_EGP',
        sourceUrl: 'https://egp2.bangkok.go.th/project-detail/pid-1',
        rawPayload: { projectId: 'pid-1' },
      };

      const enriched = await client.enrichProject(baseProject);

      expect(enriched.torStatus).toBe('AVAILABLE');
      expect(enriched.sourceUrl).toBe('https://egp2.bangkok.go.th/api/file/ann-guid-001/Attach_TOR_Document.pdf');
      expect(enriched.winnerName).toBe('บริษัท ทีเอ็กซ์ โซลูชั่นส์ จำกัด');
      expect(enriched.contractPrice).toBe(3800000);
      expect(enriched.contractDate).toBe('2026-09-28');
      expect(enriched.status).toBe('จัดทำสัญญาแล้ว');
    });
  });

  describe('URLs', () => {
    it('constructs valid fileUrl and listingUrl', () => {
      const client = new BmaClient();
      expect(client.fileUrl('ann-123', 'file test.pdf')).toBe(
        'https://egp2.bangkok.go.th/api/file/ann-123/file%20test.pdf',
      );
      expect(client.listingUrl('proj-456')).toBe(
        'https://egp2.bangkok.go.th/project-detail/proj-456',
      );
    });
  });
});

