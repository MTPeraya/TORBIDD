// =============================================================================
// services/ingestion/clients/govspending-client.ts - Thai Open Data (CKAN) Client
// =============================================================================

import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { DiscoveredProject, GovSpendingSearchParams, GovSpendingSearchResult } from '@/types/procurement';
import { parseToIsoDate } from '@/services/transformation/normalizers/date-normalizer';

import { getIngestionConfig } from '@/lib/config';

const PROJECT_ID_PATTERN = /^\d{11}$/;
const MAX_REQUEST_ATTEMPTS = 3;

/**
 * Raw contract award schema from GovSpending / CKAN API
 */
const rawContractItemSchema = z
  .object({
    winner_tin: z.string().optional(),
    winner_name: z.string().optional(),
    contract_no: z.string().optional(),
    contract_date: z.string().optional(),
    contract_finish_date: z.string().optional(),
    price_agree: z.coerce.number().optional(),
    status: z.string().optional(),
  })
  .passthrough();

/**
 * Raw project item schema returned from GovSpending / CKAN API
 */
const rawProjectSchema = z
  .object({
    project_id: z.string().trim().regex(PROJECT_ID_PATTERN, 'Invalid project ID format (expected 11 digits)'),
    project_name: z.string().min(1, 'Project name is required'),
    dept_name: z.string().optional(),
    dept_sub_name: z.string().optional(),
    agency_name: z.string().optional(),
    year: z.coerce.number().int(),
    budget: z.coerce.number().optional(),
    project_money: z.coerce.number().optional(),
    price_build: z.coerce.number().optional(),
    sum_price_agree: z.coerce.number().optional(),
    transaction_sub_type_name: z.string().optional(),
    announce_date: z.string().optional(),
    transaction_date: z.string().optional(),
    project_status: z.string().optional(),
    purchase_method_name: z.string().optional(),
    project_type_name: z.string().optional(),
    contract: z.array(rawContractItemSchema).optional(),
  })
  .passthrough();

/**
 * Top-level response schema from GovSpending API
 */
const rawResponseSchema = z.object({
  success: z.boolean().optional().default(true),
  total: z.coerce.number().int().nonnegative().optional(),
  data: z.array(rawProjectSchema),
});

export interface GovSpendingClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  retryDelayBaseMs?: number;
}

/**
 * Calculate current Thai Buddhist Era fiscal year (starts October 1st).
 */
export function getCurrentThaiFiscalYear(date = new Date()): number {
  return date.getUTCFullYear() + (date.getUTCMonth() >= 9 ? 544 : 543);
}

export interface GovSpendingHealthStatus {
  status: 'UP' | 'DOWN';
  statusCode?: number;
  latencyMs: number;
  endpoint: string;
  hasApiKey: boolean;
  error?: string;
}

/**
 * GovSpendingClient - Communicates with opend.data.go.th to discover procurement projects.
 */
export class GovSpendingClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly retryDelayBaseMs?: number;

  public constructor(options: GovSpendingClientOptions = {}) {
    const config = getIngestionConfig();
    const key = options.apiKey !== undefined ? options.apiKey : config.govspendingApiKey;
    this.apiKey = key?.trim() ?? '';
    this.baseUrl = options.baseUrl ?? config.govspendingBaseUrl;
    this.fetchImpl =
      options.fetchImpl ??
      (typeof fetch !== 'undefined'
        ? fetch
        : ((globalThis as unknown as { fetch?: typeof fetch }).fetch as typeof fetch));
    this.requestTimeoutMs = options.requestTimeoutMs ?? config.requestTimeoutMs;
    this.retryDelayBaseMs = options.retryDelayBaseMs;
  }

  /**
   * Health check verifying connectivity to data.go.th / opend.data.go.th.
   */
  public async checkHealth(): Promise<GovSpendingHealthStatus> {
    const start = Date.now();
    try {
      const url = new URL(this.baseUrl);
      if (this.apiKey) {
        url.searchParams.set('api-key', this.apiKey);
        url.searchParams.set('year', String(getCurrentThaiFiscalYear()));
        url.searchParams.set('keyword', 'กทม');
        url.searchParams.set('limit', '1');
      }

      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json, text/html' },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      return {
        status: response.ok || response.status === 401 || response.status === 403 ? 'UP' : 'DOWN',
        statusCode: response.status,
        latencyMs: Date.now() - start,
        endpoint: this.baseUrl,
        hasApiKey: Boolean(this.apiKey),
      };
    } catch (err) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - start,
        endpoint: this.baseUrl,
        hasApiKey: Boolean(this.apiKey),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Ensure API key is configured. Throws descriptive error without leaking secrets.
   */
  private checkApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        'GOVSPENDING_API_KEY is not configured. Please set GOVSPENDING_API_KEY in your environment variables.',
      );
    }
  }

  /**
   * Sanitize error message to prevent leaking API key in logs or error traces.
   */
  public sanitizeMessage(msg: string): string {
    if (!this.apiKey) return msg;
    return msg.replaceAll(this.apiKey, '[REDACTED_API_KEY]');
  }

  /**
   * Search procurement projects on Thai Open Government Data (CKAN) API.
   * Includes exponential backoff for transient errors & rate limiting (429).
   */
  public async searchProjects(params: GovSpendingSearchParams = {}): Promise<GovSpendingSearchResult> {
    this.checkApiKey();

    const limit = Math.min(Math.max(params.limit ?? 100, 1), 1000);
    const page = Math.max(params.page ?? 1, 1);
    const offset = params.offset !== undefined ? params.offset : (page - 1) * limit;
    const fiscalYear = params.fiscalYear ?? getCurrentThaiFiscalYear();
    const keyword = params.keyword?.trim() || 'ซอฟต์แวร์';

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt++) {
      try {
        return await this.fetchPage({
          fiscalYear,
          keyword,
          offset,
          limit,
          page,
          signal: params.signal,
        });
      } catch (err: unknown) {
        if (params.signal?.aborted) {
          throw err;
        }

        const errMsg = err instanceof Error ? err.message : String(err);
        lastError = new Error(this.sanitizeMessage(errMsg));

        // If rate limit (429), back off longer
        const isRateLimit = errMsg.includes('429');
        const defaultRateLimitMs =
          this.retryDelayBaseMs !== undefined ? this.retryDelayBaseMs * attempt : 2000 * attempt;
        const defaultBackoffMs =
          this.retryDelayBaseMs !== undefined
            ? this.retryDelayBaseMs * Math.pow(2, attempt - 1)
            : 500 * Math.pow(2, attempt - 1);
        const backoffMs = isRateLimit ? defaultRateLimitMs : defaultBackoffMs;

        if (attempt < MAX_REQUEST_ATTEMPTS) {
          await delay(backoffMs, undefined, { signal: params.signal });
        }
      }
    }

    throw lastError;
  }

  /**
   * Fetch a single page from the GovSpending API endpoint.
   */
  private async fetchPage(input: {
    fiscalYear: number;
    keyword: string;
    offset: number;
    limit: number;
    page: number;
    signal?: AbortSignal;
  }): Promise<GovSpendingSearchResult> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('api-key', this.apiKey);
    url.searchParams.set('year', String(input.fiscalYear));
    url.searchParams.set('keyword', input.keyword);
    url.searchParams.set('offset', String(input.offset));
    url.searchParams.set('limit', String(input.limit));

    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
    const combinedSignal = input.signal
      ? AbortSignal.any([input.signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: combinedSignal,
      });
    } catch (netErr: unknown) {
      const msg = netErr instanceof Error ? netErr.message : String(netErr);
      throw new Error(`GovSpending network error: ${this.sanitizeMessage(msg)}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('GovSpending authentication failed: Invalid or expired API key');
    }

    if (response.status === 429) {
      throw new Error('GovSpending API rate limit exceeded (HTTP 429)');
    }

    if (!response.ok) {
      throw new Error(`GovSpending request failed with status ${response.status}`);
    }

    let rawText = '';
    let payload: unknown;
    try {
      rawText = await response.text();
      payload = JSON.parse(rawText);
    } catch {
      throw new Error('GovSpending returned invalid JSON response');
    }

    const payloadSizeBytes = Buffer.byteLength(rawText, 'utf8');

    const parsed = rawResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`GovSpending returned unexpected response format: ${parsed.error.message}`);
    }

    const total = parsed.data.total ?? parsed.data.data.length;
    const recordsByAgency: Record<string, number> = {};

    const projects: DiscoveredProject[] = parsed.data.data.map((item) => {
      const agency = item.dept_name || item.dept_sub_name || item.agency_name || 'กรุงเทพมหานคร';
      recordsByAgency[agency] = (recordsByAgency[agency] || 0) + 1;
      const detailUrl = `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${item.project_id}`;

      const budget =
        item.budget && item.budget > 0
          ? item.budget
          : item.project_money && item.project_money > 0
            ? item.project_money
            : item.sum_price_agree || 0;

      // Extract real announce date (actual publishing date)
      const rawAnnounce = item.announce_date && item.announce_date !== '-' ? item.announce_date.trim() : undefined;
      const publishDateIso = rawAnnounce ? parseToIsoDate(rawAnnounce) : undefined;

      // Extract real transaction date / contract date
      const rawTx = item.transaction_date && item.transaction_date !== '-' ? item.transaction_date.trim() : undefined;
      const txDateIso = rawTx ? parseToIsoDate(rawTx) : undefined;

      // Extract contract details if available
      const contracts = Array.isArray(item.contract) ? item.contract : [];
      const primaryContract = contracts.length > 0 ? contracts[0] : undefined;
      const contractDateIso = primaryContract?.contract_date ? parseToIsoDate(primaryContract.contract_date) : txDateIso;
      const contractFinishDateIso = primaryContract?.contract_finish_date ? parseToIsoDate(primaryContract.contract_finish_date) : undefined;
      const winnerName = primaryContract?.winner_name;

      // Build verified timeline only from real source dates
      const timeline: Array<{
        id: string;
        event: { th: string; en: string };
        date: string;
        description: { th: string; en: string };
        status: 'completed' | 'active' | 'upcoming';
      }> = [];

      if (publishDateIso) {
        timeline.push({
          id: 'announcement',
          event: {
            th: 'ประกาศจัดซื้อจัดจ้างอย่างเป็นทางการ',
            en: 'Official Procurement Announcement Published',
          },
          date: publishDateIso,
          description: {
            th: 'เผยแพร่ประกาศผ่านระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)',
            en: 'Published via official e-GP procurement system',
          },
          status: 'completed',
        });
      }

      if (contractDateIso) {
        timeline.push({
          id: 'contract-award',
          event: {
            th: 'ลงนามสัญญา / ประกาศผลผู้ชนะ',
            en: 'Contract Award & Signing',
          },
          date: contractDateIso,
          description: {
            th: winnerName ? `ผู้ชนะการเสนอราคา: ${winnerName}` : 'ลงนามสัญญาเรียบร้อยแล้ว',
            en: winnerName ? `Contract Awardee: ${winnerName}` : 'Contract awarded and executed',
          },
          status: 'completed',
        });
      }

      if (contractFinishDateIso) {
        const daysToFinish = (new Date(contractFinishDateIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        timeline.push({
          id: 'contract-finish',
          event: {
            th: 'กำหนดสิ้นสุดสัญญา / ส่งมอบงานงวดสุดท้าย',
            en: 'Contract Completion & Final Delivery',
          },
          date: contractFinishDateIso,
          description: {
            th: 'กำหนดสิ้นสุดสัญญาตามข้อตกลงจัดซื้อจัดจ้าง',
            en: 'Scheduled contract completion date',
          },
          status: daysToFinish < 0 ? 'completed' : 'upcoming',
        });
      }

      const procurementType =
        item.purchase_method_name ||
        item.transaction_sub_type_name ||
        item.project_type_name ||
        '';

      return {
        externalProjectId: item.project_id,
        projectName: item.project_name,
        agencyName: agency,
        fiscalYear: item.year,
        source: 'CKAN_GOVSPENDING',
        sourceUrl: detailUrl,
        budget,
        contractPrice: item.sum_price_agree && item.sum_price_agree > 0 ? item.sum_price_agree : undefined,
        medianPrice: item.price_build && item.price_build > 0 ? item.price_build : undefined,
        procurementType,
        publishDate: (publishDateIso ?? contractDateIso) || undefined,
        status: item.project_status || (item.sum_price_agree ? 'จัดทำสัญญาแล้ว' : 'ประกาศเชิญชวน'),
        contractDate: contractDateIso || undefined,
        contractFinishDate: contractFinishDateIso || undefined,
        winnerName,
        timeline: timeline.length > 0 ? timeline : undefined,
        rawPayload: item as unknown as Record<string, unknown>,
      };
    });

    const metrics = {
      totalRecordsRetrieved: projects.length,
      payloadSizeBytes,
      recordsByAgency,
    };

    // Logging per-agency request and response metrics
    console.info('[GovSpending API Metrics]', {
      endpoint: url.pathname,
      fiscalYear: input.fiscalYear,
      status: response.status,
      totalRecordsRetrieved: metrics.totalRecordsRetrieved,
      payloadSizeBytes: metrics.payloadSizeBytes,
      recordsByAgency: metrics.recordsByAgency,
    });

    return {
      total,
      page: input.page,
      limit: input.limit,
      offset: input.offset,
      projects,
      metrics,
    };
  }

  /**
   * Iterate through multiple agency / department identifiers or names.
   * Queries the unified endpoint per agency with request throttling between iterations.
   */
  public async searchProjectsByAgencies(
    agencies: string[],
    baseParams: Omit<GovSpendingSearchParams, 'keyword'> = {},
    throttleDelayMs = 200,
  ): Promise<{
    resultsByAgency: Record<string, GovSpendingSearchResult>;
    allProjects: DiscoveredProject[];
    totalRecordsRetrieved: number;
    totalPayloadSizeBytes: number;
    recordsByAgency: Record<string, number>;
  }> {
    const resultsByAgency: Record<string, GovSpendingSearchResult> = {};
    const allProjects: DiscoveredProject[] = [];
    const aggregatedRecordsByAgency: Record<string, number> = {};
    let totalPayloadSizeBytes = 0;

    for (let i = 0; i < agencies.length; i++) {
      const agency = agencies[i];
      if (!agency || !agency.trim()) continue;

      const result = await this.searchProjects({
        ...baseParams,
        keyword: agency.trim(),
      });

      resultsByAgency[agency] = result;
      allProjects.push(...result.projects);
      totalPayloadSizeBytes += result.metrics?.payloadSizeBytes ?? 0;

      if (result.metrics?.recordsByAgency) {
        for (const [name, count] of Object.entries(result.metrics.recordsByAgency)) {
          aggregatedRecordsByAgency[name] = (aggregatedRecordsByAgency[name] || 0) + count;
        }
      }

      if (i < agencies.length - 1 && throttleDelayMs > 0) {
        await delay(throttleDelayMs, undefined, { signal: baseParams.signal });
      }
    }

    return {
      resultsByAgency,
      allProjects,
      totalRecordsRetrieved: allProjects.length,
      totalPayloadSizeBytes,
      recordsByAgency: aggregatedRecordsByAgency,
    };
  }
}
