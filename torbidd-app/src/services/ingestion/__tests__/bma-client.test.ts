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
  });
});
