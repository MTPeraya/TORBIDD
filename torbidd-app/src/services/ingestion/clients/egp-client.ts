// =============================================================================
// services/ingestion/clients/egp-client.ts - National e-GP Client
// =============================================================================

import { DiscoveredProject, EgpArchiveMetadata } from '@/types/procurement';
import { getIngestionConfig } from '@/lib/config';
import { parseToIsoDate } from '@/services/transformation/normalizers/date-normalizer';

const METADATA_PATH = '/egp-approval-service/apv-common/infoProcureDocAnnounZipTemp';
const DOWNLOAD_PATH = '/egp-upload-service/v1/downloadFileTest';
const PROJECT_ID_PATTERN = /^\d{11}$/;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024; // 100MB download limit

export interface EgpClientOptions {
  baseUrl?: string;
  portalUrl?: string;
  rssBaseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export interface EgpDownloadResult {
  metadata: EgpArchiveMetadata;
  zipBuffer: Buffer;
  contentLength: number;
}

export interface EgpHealthStatus {
  status: 'UP' | 'DOWN';
  statusCode?: number;
  latencyMs: number;
  endpoint: string;
  error?: string;
}

/**
 * EgpClient - Connects to process5.gprocurement.go.th and www.gprocurement.go.th
 * to retrieve procurement ZIP packages and poll national e-GP announcements.
 */
export class EgpClient {
  private readonly baseUrl: string;
  private readonly portalUrl: string;
  private readonly rssBaseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;

  public constructor(options: EgpClientOptions = {}) {
    const config = getIngestionConfig();
    this.baseUrl = (options.baseUrl ?? config.egpBaseUrl).replace(/\/+$/, '');
    this.portalUrl = (options.portalUrl ?? process.env.EGP_PORTAL_URL ?? 'https://www.gprocurement.go.th').replace(/\/+$/, '');
    this.rssBaseUrl = (
      options.rssBaseUrl ??
      process.env.EGP_RSS_BASE_URL ??
      'https://process3.gprocurement.go.th/EPROCRssFeedWeb/egpannouncerss.xml'
    ).trim();
    this.fetchImpl =
      options.fetchImpl ??
      (typeof fetch !== 'undefined'
        ? fetch
        : ((globalThis as unknown as { fetch?: typeof fetch }).fetch as typeof fetch));
    this.requestTimeoutMs = options.requestTimeoutMs ?? config.requestTimeoutMs;
  }

  /**
   * Health check verifying connectivity to www.gprocurement.go.th.
   */
  public async checkHealth(): Promise<EgpHealthStatus> {
    const start = Date.now();
    try {
      const response = await this.fetchImpl(this.portalUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'TORBIDD-Ingestion-Bot/1.0',
          Accept: 'text/html,*/*',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      return {
        status: response.ok || response.status === 301 || response.status === 302 ? 'UP' : 'DOWN',
        statusCode: response.status,
        latencyMs: Date.now() - start,
        endpoint: this.portalUrl,
      };
    } catch (err) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - start,
        endpoint: this.portalUrl,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Validate that the project ID is an 11-digit numeric string.
   */
  public assertProjectId(projectId: string): void {
    if (!projectId || !PROJECT_ID_PATTERN.test(projectId.trim())) {
      throw new Error(`e-GP Project ID must contain exactly 11 numeric digits, got: '${projectId}'`);
    }
  }

  /**
   * Fetch archive metadata (zipId and filename) for a given Project ID from e-GP.
   */
  public async getArchiveMetadata(projectId: string): Promise<EgpArchiveMetadata> {
    const cleanId = projectId.trim();
    this.assertProjectId(cleanId);

    const url = new URL(`${this.baseUrl}${METADATA_PATH}`);
    url.searchParams.set('projectId', cleanId);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          noToken: 'noToken',
          noDataProfile: 'noDataProfile',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`e-GP metadata request failed for project ${cleanId}: ${msg}`);
    }

    if (!response.ok) {
      throw new Error(`e-GP metadata request failed with status ${response.status} for project ${cleanId}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`e-GP returned invalid JSON metadata for project ${cleanId}`);
    }

    // Check payload structure
    const payloadRecord = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
    const data = payloadRecord && typeof payloadRecord.data === 'object' && payloadRecord.data !== null
      ? (payloadRecord.data as Record<string, unknown>)
      : null;

    if (!data) {
      throw new Error(`e-GP has no document metadata available for project ${cleanId}`);
    }

    const zipId = typeof data.zipId === 'string' ? data.zipId : '';
    const archiveName = typeof data.buildName1 === 'string' ? data.buildName1 : `${cleanId}.zip`;

    if (!zipId || zipId.trim().length === 0) {
      throw new Error(`No downloadable archive (missing zipId) found in e-GP for project ${cleanId}`);
    }

    return {
      zipId: zipId.trim(),
      archiveName: archiveName.trim(),
      projectId: cleanId,
    };
  }

  /**
   * Download the ZIP document package from e-GP using the fileId (zipId).
   */
  public async downloadArchive(metadata: EgpArchiveMetadata): Promise<EgpDownloadResult> {
    const url = new URL(`${this.baseUrl}${DOWNLOAD_PATH}`);
    url.searchParams.set('fileId', metadata.zipId);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/zip, application/octet-stream',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`e-GP download connection failed for zipId ${metadata.zipId}: ${msg}`);
    }

    if (!response.ok) {
      throw new Error(`e-GP download failed with status ${response.status} for project ${metadata.projectId}`);
    }

    const headerLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(headerLength) && headerLength > MAX_ARCHIVE_BYTES) {
      throw new Error(`e-GP ZIP archive exceeds maximum safe limit of ${MAX_ARCHIVE_BYTES} bytes`);
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed reading e-GP ZIP payload: ${msg}`);
    }

    const zipBuffer = Buffer.from(arrayBuffer);

    if (zipBuffer.length > MAX_ARCHIVE_BYTES) {
      throw new Error(`e-GP ZIP archive is too large: ${zipBuffer.length} bytes`);
    }

    // Validate ZIP magic header: PK\x03\x04 or PK\x05\x06 (empty) or starts with 'PK' (0x50, 0x4b)
    if (zipBuffer.length < 4 || zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4b) {
      throw new Error(`Downloaded file from e-GP is not a valid ZIP archive for project ${metadata.projectId}`);
    }

    return {
      metadata,
      zipBuffer,
      contentLength: zipBuffer.length,
    };
  }

  /**
   * High-level method: Get metadata and download ZIP package in one step.
   */
  public async fetchProjectZip(projectId: string): Promise<EgpDownloadResult> {
    const metadata = await this.getArchiveMetadata(projectId);
    return this.downloadArchive(metadata);
  }

  /**
   * Polls procurement announcements from e-GP RSS feed.
   * Parses items, extracts 11-digit project IDs, and maps them to DiscoveredProject records.
   */
  public async pollAnnouncements(options: {
    deptId?: string;
    anounceType?: string;
    limit?: number;
    signal?: AbortSignal;
  } = {}): Promise<{ total: number; projects: DiscoveredProject[] }> {
    const url = new URL(this.rssBaseUrl);
    if (options.deptId) {
      url.searchParams.set('deptId', options.deptId);
    }
    if (options.anounceType) {
      url.searchParams.set('anounceType', options.anounceType);
    }

    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
    const combinedSignal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'TORBIDD-Ingestion-Bot/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: combinedSignal,
      });

      if (!response.ok) {
        console.warn(`[EgpClient] RSS feed returned HTTP ${response.status}`);
        return { total: 0, projects: [] };
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Detect encoding or default to windows-874 / tis-620 for Thai government feeds
      let text = '';
      try {
        const sniff = new TextDecoder('ascii', { fatal: false }).decode(bytes.slice(0, 200));
        const match = sniff.match(/encoding=["']([^"']+)["']/i);
        const encoding = match ? match[1].toLowerCase() : 'windows-874';

        if (encoding.includes('utf-8')) {
          text = new TextDecoder('utf-8').decode(bytes);
        } else {
          text = new TextDecoder('windows-874').decode(bytes);
        }
      } catch {
        text = new TextDecoder('windows-874').decode(bytes);
      }

      const projects = this.parseRssXml(text, options.limit ?? 100);

      return {
        total: projects.length,
        projects,
      };
    } catch (err) {
      console.warn(
        '[EgpClient] RSS poll failed — falling back gracefully:',
        err instanceof Error ? err.message : String(err),
      );
      return { total: 0, projects: [] };
    }
  }

  /**
   * Parses e-GP RSS XML feed items into DiscoveredProject records.
   */
  private parseRssXml(xml: string, limit: number): DiscoveredProject[] {
    const projects: DiscoveredProject[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const currentYear = new Date().getFullYear() + 543;

    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null && projects.length < limit) {
      const itemContent = match[1];

      const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemContent);
      const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(itemContent);
      const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(itemContent);
      const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i.exec(itemContent);

      const title = (titleMatch?.[1] ?? '').trim();
      const link = (linkMatch?.[1] ?? '').trim();
      const desc = (descMatch?.[1] ?? '').trim();
      const pubDateRaw = (pubDateMatch?.[1] ?? '').trim();
      const publishDate = pubDateRaw ? parseToIsoDate(pubDateRaw) || undefined : undefined;

      // Extract 11-digit project ID from link or description
      const idMatch = /(\d{11})/.exec(link) || /(\d{11})/.exec(desc) || /(\d{11})/.exec(title);
      const externalProjectId = idMatch ? idMatch[1] : `EGP-${Date.now()}-${projects.length}`;

      // Derive fiscal year from project ID prefix if 11 digits (e.g., 68xxxxxxxxx -> 2568, 69xxxxxxxxx -> 2569)
      let projectFiscalYear = currentYear;
      if (idMatch && idMatch[1]) {
        const prefix2 = parseInt(idMatch[1].substring(0, 2), 10);
        if (prefix2 >= 60 && prefix2 <= 75) {
          projectFiscalYear = 2500 + prefix2;
        }
      }

      // Extract budget if present
      const budgetMatch = /(?:งบประมาณ|วงเงิน)\s*[:=]?\s*([\d,]+)/i.exec(desc);
      const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : 0;

      projects.push({
        externalProjectId,
        projectName: title || 'e-GP Announcement',
        agencyName: 'กรมบัญชีกลาง',
        fiscalYear: projectFiscalYear,
        source: 'NATIONAL_EGP',
        sourceUrl: link || `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${externalProjectId}`,
        budget: Number.isFinite(budget) ? budget : 0,
        procurementType: 'ประกาศจัดซื้อจัดจ้าง e-GP',
        publishDate,
        status: 'ประกาศเชิญชวน',
      });
    }

    return projects;
  }
}

