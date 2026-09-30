/**
 * @jest-environment node
 */
// =============================================================================
// services/ingestion/__tests__/egp-client.test.ts
// Tests: 6. e-GP API success, 7. e-GP API failure
// =============================================================================

import { EgpClient } from '../clients/egp-client';

describe('EgpClient (National e-GP)', () => {
  const MOCK_PROJECT_ID = '67119538991';
  const MOCK_ZIP_ID = 'cefa9bcbd513448ea9ad54f80aea5f56';
  // Valid minimal ZIP buffer starting with PK\x03\x04
  const MOCK_ZIP_BUFFER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00]);

  // ─── 6. e-GP API Success ──────────────────────────────────────────────────
  it('6. should retrieve archive metadata and download ZIP archive successfully', async () => {
    const requestedUrls: string[] = [];

    const mockFetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes('infoProcureDocAnnounZipTemp')) {
        return new Response(
          JSON.stringify({
            response: { responseCode: '0' },
            data: {
              projectId: MOCK_PROJECT_ID,
              buildName1: `${MOCK_PROJECT_ID}_announcement.zip`,
              zipId: MOCK_ZIP_ID,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('downloadFileTest')) {
        return new Response(MOCK_ZIP_BUFFER, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Length': String(MOCK_ZIP_BUFFER.length),
          },
        });
      }

      return new Response('Not found', { status: 404 });
    });

    const client = new EgpClient({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    // 1. Metadata check
    const metadata = await client.getArchiveMetadata(MOCK_PROJECT_ID);
    expect(metadata).toEqual({
      projectId: MOCK_PROJECT_ID,
      zipId: MOCK_ZIP_ID,
      archiveName: `${MOCK_PROJECT_ID}_announcement.zip`,
    });

    // 2. Download check
    const result = await client.downloadArchive(metadata);
    expect(result.metadata.projectId).toBe(MOCK_PROJECT_ID);
    expect(result.zipBuffer.length).toBe(MOCK_ZIP_BUFFER.length);
    expect(result.zipBuffer[0]).toBe(0x50);
    expect(result.zipBuffer[1]).toBe(0x4b);

    // Verify correct endpoints and query parameters were used
    expect(requestedUrls[0]).toContain('infoProcureDocAnnounZipTemp');
    expect(requestedUrls[0]).toContain(`projectId=${MOCK_PROJECT_ID}`);
    expect(requestedUrls[1]).toContain('downloadFileTest');
    expect(requestedUrls[1]).toContain(`fileId=${MOCK_ZIP_ID}`);
  });

  // ─── 7. e-GP API Failure ──────────────────────────────────────────────────
  it('7a. should reject invalid Project IDs prior to making network requests', async () => {
    const mockFetch = jest.fn();
    const client = new EgpClient({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getArchiveMetadata('invalid_id')).rejects.toThrow(
      /must contain exactly 11 numeric digits/i,
    );
    await expect(client.getArchiveMetadata('12345')).rejects.toThrow(
      /must contain exactly 11 numeric digits/i,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('7b. should handle e-GP metadata request returning 404/500 HTTP error', async () => {
    const mockFetch = jest.fn().mockImplementation(async () => {
      return new Response('Internal Server Error', { status: 500 });
    });

    const client = new EgpClient({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getArchiveMetadata(MOCK_PROJECT_ID)).rejects.toThrow(
      /e-GP metadata request failed with status 500/i,
    );
  });

  it('7c. should handle e-GP response when project has no downloadable archive (missing zipId)', async () => {
    const mockFetch = jest.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          response: { responseCode: '0' },
          data: {
            projectId: MOCK_PROJECT_ID,
            zipId: '', // Empty zipId
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = new EgpClient({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getArchiveMetadata(MOCK_PROJECT_ID)).rejects.toThrow(
      /missing zipId/i,
    );
  });

  it('7d. should reject downloaded file if not a valid ZIP (invalid magic header)', async () => {
    const mockFetch = jest.fn().mockImplementation(async () => {
      return new Response(Buffer.from('<html><body>Error</body></html>'), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    });

    const client = new EgpClient({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    await expect(
      client.downloadArchive({
        projectId: MOCK_PROJECT_ID,
        zipId: MOCK_ZIP_ID,
        archiveName: 'test.zip',
      }),
    ).rejects.toThrow(/not a valid ZIP archive/i);
  });

  // ─── 8. e-GP Health Check & RSS Announcements ─────────────────────────────
  it('8a. should report UP health status when portal is reachable', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    const client = new EgpClient({ fetchImpl: mockFetch as unknown as typeof fetch });

    const health = await client.checkHealth();
    expect(health.status).toBe('UP');
    expect(health.statusCode).toBe(200);
  });

  it('8b. should poll and parse e-GP RSS XML announcements correctly', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>e-GP Announcements</title>
          <item>
            <title>จ้างพัฒนาระบบคลาวด์ภาครัฐ 67019998877</title>
            <link>https://process5.gprocurement.go.th/project/67019998877</link>
            <description>โครงการจัดซื้อจัดจ้าง วงเงิน 15,000,000 บาท</description>
          </item>
        </channel>
      </rss>`;

    const mockFetch = jest.fn().mockResolvedValue(
      new Response(mockXml, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      }),
    );

    const client = new EgpClient({ fetchImpl: mockFetch as unknown as typeof fetch });
    const result = await client.pollAnnouncements();

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].externalProjectId).toBe('67019998877');
    expect(result.projects[0].source).toBe('NATIONAL_EGP');
    expect(result.projects[0].budget).toBe(15000000);
  });
});

