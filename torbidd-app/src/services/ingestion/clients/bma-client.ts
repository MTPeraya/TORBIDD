// =============================================================================
// services/ingestion/clients/bma-client.ts
// Bangkok Metropolitan Administration (BMA) e-Procurement Client
// Connects to egp2.bangkok.go.th to discover BMA public procurement projects.
// =============================================================================

import { DiscoveredProject } from '@/types/procurement';
import { getIngestionConfig } from '@/lib/config';

export interface BmaClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export interface BmaSearchParams {
  keyword?: string;
  fiscalYear?: number;
  limit?: number;
  page?: number;
  signal?: AbortSignal;
}

export interface BmaSearchResult {
  total: number;
  page: number;
  limit: number;
  projects: DiscoveredProject[];
}

export interface BmaHealthStatus {
  status: 'UP' | 'DOWN';
  statusCode?: number;
  latencyMs: number;
  endpoint: string;
  error?: string;
}

export class BmaClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;

  public constructor(options: BmaClientOptions = {}) {
    const config = getIngestionConfig();
    this.baseUrl = (options.baseUrl ?? config.bmaBaseUrl).replace(/\/+$/, '');
    this.fetchImpl =
      options.fetchImpl ??
      (typeof fetch !== 'undefined'
        ? fetch
        : ((globalThis as unknown as { fetch?: typeof fetch }).fetch as typeof fetch));
    this.requestTimeoutMs = options.requestTimeoutMs ?? config.requestTimeoutMs;
  }

  /**
   * Health check verifying connectivity to egp2.bangkok.go.th.
   */
  public async checkHealth(): Promise<BmaHealthStatus> {
    const start = Date.now();
    try {
      const response = await this.fetchImpl(this.baseUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'TORBIDD-Ingestion-Bot/1.0 (+http://localhost:3000)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      return {
        status: response.ok || response.status === 301 || response.status === 302 ? 'UP' : 'DOWN',
        statusCode: response.status,
        latencyMs: Date.now() - start,
        endpoint: this.baseUrl,
      };
    } catch (err) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - start,
        endpoint: this.baseUrl,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Discovers procurement projects from BMA e-Procurement portal.
   * Parses project listings or falls back to public announcement feeds.
   */
  public async searchProjects(params: BmaSearchParams = {}): Promise<BmaSearchResult> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const page = Math.max(params.page ?? 1, 1);
    const keyword = params.keyword?.trim() || '';

    const targetUrl = new URL(`${this.baseUrl}/project-search`);
    if (keyword) {
      targetUrl.searchParams.set('keyword', keyword);
    }
    if (params.fiscalYear) {
      targetUrl.searchParams.set('budgetYear', String(params.fiscalYear));
    }
    targetUrl.searchParams.set('page', String(page));
    targetUrl.searchParams.set('size', String(limit));

    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
    const combinedSignal = params.signal
      ? AbortSignal.any([params.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await this.fetchImpl(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'TORBIDD-Ingestion-Bot/1.0',
          Accept: 'application/json, text/html',
        },
        signal: combinedSignal,
      });

      if (!response.ok) {
        console.warn(`[BmaClient] Portal returned HTTP ${response.status} for ${targetUrl.toString()}`);
        return { total: 0, page, limit, projects: [] };
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        const rawList = Array.isArray(json) ? json : json.data || json.items || [];
        const projects = this.mapRawProjects(rawList);
        return {
          total: json.total ?? projects.length,
          page,
          limit,
          projects,
        };
      }

      // If portal returned HTML or server-rendered page
      const htmlText = await response.text();
      const extractedProjects = this.extractProjectsFromHtml(htmlText, params.fiscalYear);

      return {
        total: extractedProjects.length,
        page,
        limit,
        projects: extractedProjects.slice(0, limit),
      };
    } catch (err) {
      console.warn(
        '[BmaClient] Search failed:',
        err instanceof Error ? err.message : String(err),
      );
      return { total: 0, page, limit, projects: [] };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRawProjects(rawItems: any[]): DiscoveredProject[] {
    return rawItems
      .filter((item) => item && (item.projectId || item.id || item.project_id))
      .map((item) => {
        const id = String(item.projectId || item.id || item.project_id).trim();
        const name = String(item.projectName || item.name || item.project_name || 'BMA Procurement');
        const agency = String(item.departmentName || item.deptName || 'กรุงเทพมหานคร');
        const budget = Number(item.projectBudget || item.budget || item.sumPrice || 0);
        const year = Number(item.budgetYear || item.year || new Date().getFullYear() + 543);

        return {
          externalProjectId: id,
          projectName: name,
          agencyName: agency,
          fiscalYear: year,
          source: 'BMA_EGP',
          sourceUrl: `${this.baseUrl}/project-detail/${id}`,
          budget: Number.isFinite(budget) ? budget : 0,
          procurementType: item.procurementMethod || item.announceType || 'ประกวดราคาอิเล็กทรอนิกส์',
        };
      });
  }

  private extractProjectsFromHtml(html: string, fallbackYear?: number): DiscoveredProject[] {
    const projects: DiscoveredProject[] = [];
    const idRegex = /\/project-detail\/([0-9a-zA-Z\-_]+)/g;
    const seenIds = new Set<string>();
    let match: RegExpExecArray | null;

    const fiscalYear = fallbackYear ?? new Date().getFullYear() + 543;

    while ((match = idRegex.exec(html)) !== null) {
      const id = match[1];
      if (!seenIds.has(id)) {
        seenIds.add(id);
        projects.push({
          externalProjectId: id,
          projectName: `โครงการจัดซื้อจัดจ้าง กทม. (${id})`,
          agencyName: 'กรุงเทพมหานคร',
          fiscalYear,
          source: 'BMA_EGP',
          sourceUrl: `${this.baseUrl}/project-detail/${id}`,
          budget: 0,
          procurementType: 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',
        });
      }
    }

    return projects;
  }
}
