// =============================================================================
// services/ingestion/clients/govspending-client.ts - Thai Open Data (CKAN) Client
// =============================================================================

import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { DiscoveredProject, GovSpendingSearchParams, GovSpendingSearchResult } from '@/types/procurement';

const DEFAULT_BASE_URL = 'https://opend.data.go.th/govspending/service/egp-contract';
const PROJECT_ID_PATTERN = /^\d{11}$/;
const MAX_REQUEST_ATTEMPTS = 3;

/**
 * Raw project item schema returned from GovSpending / CKAN API
 */
const rawProjectSchema = z.object({
  project_id: z.string().trim().regex(PROJECT_ID_PATTERN, 'Invalid project ID format (expected 11 digits)'),
  project_name: z.string().min(1, 'Project name is required'),
  dept_name: z.string().optional(),
  dept_sub_name: z.string().optional(),
  agency_name: z.string().optional(),
  year: z.coerce.number().int(),
  sum_price_agree: z.coerce.number().optional(),
  transaction_sub_type_name: z.string().optional(),
});

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
    const key = options.apiKey ?? process.env.GOVSPENDING_API_KEY;
    this.apiKey = key?.trim() ?? '';
    this.baseUrl = options.baseUrl ?? process.env.GOVSPENDING_BASE_URL ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? (Number(process.env.REQUEST_TIMEOUT_MS) || 30_000);
    this.retryDelayBaseMs = options.retryDelayBaseMs;
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

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('GovSpending returned invalid JSON response');
    }

    const parsed = rawResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`GovSpending returned unexpected response format: ${parsed.error.message}`);
    }

    const total = parsed.data.total ?? parsed.data.data.length;
    const projects: DiscoveredProject[] = parsed.data.data.map((item) => {
      const agency = item.dept_name || item.dept_sub_name || item.agency_name || 'กรุงเทพมหานคร';
      const detailUrl = `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${item.project_id}`;

      return {
        externalProjectId: item.project_id,
        projectName: item.project_name,
        agencyName: agency,
        fiscalYear: item.year,
        source: 'CKAN_GOVSPENDING',
        sourceUrl: detailUrl,
        budget: item.sum_price_agree || 0,
        procurementType: item.transaction_sub_type_name || '',
      };
    });

    return {
      total,
      page: input.page,
      limit: input.limit,
      offset: input.offset,
      projects,
    };
  }
}
