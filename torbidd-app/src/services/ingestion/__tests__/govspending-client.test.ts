/**
 * @jest-environment node
 */
// =============================================================================
// services/ingestion/__tests__/govspending-client.test.ts
// Tests: 1. CKAN API success, 2. Auth failure, 3. Rate limit, 4. Pagination, 5. Project ID extraction
// =============================================================================

import { GovSpendingClient, getCurrentThaiFiscalYear } from '../clients/govspending-client';

describe('GovSpendingClient (CKAN / Open Data)', () => {
  const TEST_API_KEY = 'test-secret-govspending-key-12345';
  const MOCK_PROJECT_ID = '67119538991';

  // ─── 1. CKAN API Success ──────────────────────────────────────────────────
  it('1. should succeed with valid CKAN API response and normalize project fields', async () => {
    let requestedUrl = '';
    const mockFetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          success: true,
          total: 1,
          data: [
            {
              project_id: MOCK_PROJECT_ID,
              project_name: 'โครงการจ้างพัฒนาระบบเทคโนโลยีสารสนเทศ กรุงเทพมหานคร',
              dept_name: 'สำนักการแพทย์',
              year: 2568,
              sum_price_agree: 5000000,
              transaction_sub_type_name: 'จ้างพัฒนาหรือปรับปรุงระบบงานคอมพิวเตอร์',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = new GovSpendingClient({
      apiKey: TEST_API_KEY,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const result = await client.searchProjects({
      keyword: 'ซอฟต์แวร์',
      fiscalYear: 2568,
      page: 1,
      limit: 10,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(1);
    expect(result.projects).toHaveLength(1);

    const project = result.projects[0];
    expect(project).toEqual({
      externalProjectId: MOCK_PROJECT_ID,
      projectName: 'โครงการจ้างพัฒนาระบบเทคโนโลยีสารสนเทศ กรุงเทพมหานคร',
      agencyName: 'สำนักการแพทย์',
      fiscalYear: 2568,
      source: 'CKAN_GOVSPENDING',
      sourceUrl: `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${MOCK_PROJECT_ID}`,
      budget: 5000000,
      procurementType: 'จ้างพัฒนาหรือปรับปรุงระบบงานคอมพิวเตอร์',
    });

    const url = new URL(requestedUrl);
    expect(url.searchParams.get('api-key')).toBe(TEST_API_KEY);
    expect(url.searchParams.get('keyword')).toBe('ซอฟต์แวร์');
    expect(url.searchParams.get('year')).toBe('2568');
  });

  // ─── 2. CKAN API Authentication Failure ──────────────────────────────────
  it('2. should throw descriptive error on missing API key without calling network', async () => {
    const mockFetch = jest.fn();
    const client = new GovSpendingClient({
      apiKey: '',
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    await expect(client.searchProjects()).rejects.toThrow(
      'GOVSPENDING_API_KEY is not configured',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('2b. should handle HTTP 401/403 and never leak API key in error messages', async () => {
    const mockFetch = jest.fn().mockImplementation(async () => {
      return new Response('Unauthorized', { status: 401 });
    });

    const client = new GovSpendingClient({
      apiKey: TEST_API_KEY,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    let errorThrown: Error | null = null;
    try {
      await client.searchProjects({ fiscalYear: 2568 });
    } catch (err) {
      errorThrown = err as Error;
    }

    expect(errorThrown).not.toBeNull();
    expect(errorThrown!.message).toContain('GovSpending authentication failed');
    // Crucial requirement: NEVER expose the API key in the error message
    expect(errorThrown!.message).not.toContain(TEST_API_KEY);
  });

  // ─── 3. CKAN API Rate Limit ───────────────────────────────────────────────
  it('3. should handle HTTP 429 rate limit response', async () => {
    const mockFetch = jest.fn().mockImplementation(async () => {
      return new Response('Too Many Requests', { status: 429 });
    });

    const client = new GovSpendingClient({
      apiKey: TEST_API_KEY,
      fetchImpl: mockFetch as unknown as typeof fetch,
      requestTimeoutMs: 5000,
      retryDelayBaseMs: 1,
    });

    await expect(client.searchProjects({ fiscalYear: 2568 })).rejects.toThrow(
      /rate limit exceeded/i,
    );
  });

  // ─── 4. Pagination ────────────────────────────────────────────────────────
  it('4. should correctly calculate and send pagination parameters (offset & limit)', async () => {
    let requestedUrl = '';
    const mockFetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          success: true,
          total: 50,
          data: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = new GovSpendingClient({
      apiKey: TEST_API_KEY,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    // Request page 3 with limit 20 -> expected offset = (3 - 1) * 20 = 40
    const result = await client.searchProjects({
      keyword: 'ระบบ',
      page: 3,
      limit: 20,
    });

    expect(result.page).toBe(3);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(40);

    const url = new URL(requestedUrl);
    expect(url.searchParams.get('offset')).toBe('40');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  // ─── 5. Project ID Extraction ────────────────────────────────────────────
  it('5. should reject response items with invalid or non-11-digit project IDs', async () => {
    const mockFetch = jest.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          total: 1,
          data: [
            {
              project_id: 'bad-123', // not 11 digits
              project_name: 'Invalid ID Project',
              year: 2568,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = new GovSpendingClient({
      apiKey: TEST_API_KEY,
      fetchImpl: mockFetch as unknown as typeof fetch,
      retryDelayBaseMs: 1,
    });

    await expect(
      client.searchProjects({ fiscalYear: 2568 }),
    ).rejects.toThrow(/unexpected response format/i);
  });

  it('5b. should compute Thai fiscal year correctly', () => {
    // September 2026 -> 2026 + 543 = 2569 (or 2569 if month >= 9)
    const sepDate = new Date(Date.UTC(2026, 8, 10)); // month 8 is September
    expect(getCurrentThaiFiscalYear(sepDate)).toBe(2569);

    const octDate = new Date(Date.UTC(2026, 9, 1)); // month 9 is October (start of FY2570)
    expect(getCurrentThaiFiscalYear(octDate)).toBe(2570);
  });
});
