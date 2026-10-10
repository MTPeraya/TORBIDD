// =============================================================================
// services/ingestion/clients/bma-client.ts
// Bangkok Metropolitan Administration (BMA) e-Procurement Client
// Connects to egp2.bangkok.go.th to discover and extract BMA public procurement projects.
// =============================================================================

import { DiscoveredProject } from '@/types/procurement';
import { getIngestionConfig } from '@/lib/config';

export const BMA_EGP_ENDPOINTS = {
  api: 'https://egp2.bangkok.go.th/appapi/api',
  listing: 'https://egp2.bangkok.go.th/project-detail',
  file: 'https://egp2.bangkok.go.th/api/file',
} as const;

export const BMA_ANNOUNCE_TYPES = {
  TOR_DRAFT: {
    id: '24995aa2-d875-4d3d-9dec-d5e22d222aa4',
    code: '98',
    label: 'ร่างขอบเขตของงาน (TOR)',
    stage: 'เปิดรับฟังความคิดเห็น',
  },
  INVITATION: {
    id: '705f1ffb-82e2-4beb-bdd2-2746f0783bf0',
    code: 'D0',
    label: 'ประกาศเชิญชวน',
    stage: 'ประกาศ TOR',
  },
  AWARD: {
    id: '8a879a96-9fcc-48a0-aa06-8a39450d02bb',
    code: 'W0',
    label: 'ประกาศรายชื่อผู้ชนะการเสนอราคา / ประกาศรายชื่อผู้ได้รับการคัดเลือก',
    stage: 'ประกาศผู้ชนะ',
  },
} as const;

export interface BmaClientOptions {
  baseUrl?: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export interface BmaSearchParams {
  keyword?: string;
  announceTypeId?: string;
  fiscalYear?: number;
  limit?: number;
  page?: number;
  signal?: AbortSignal;
  enrich?: boolean;
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

export interface RawBmaAnnouncement {
  id: string;
  masterAnnounceTypeName: string | null;
  projectAnnouncementPublishDate: string | null;
  projectAnnouncementPath: string | null;
}

export interface RawBmaContract {
  projectContractBidderName: string | null;
  projectContractContractNumberEgp: string | null;
  projectContractContractDate: string | null;
  projectContractContractBudget: number | string | null;
  projectContractContractStartDate: string | null;
  projectContractContractEndDate: string | null;
  projectContractContractDeadline: number | string | null;
}

export interface RawBmaProjectDetail {
  projectId?: string;
  projectName?: string;
  projectNumber?: string;
  masterMethodIdName: string | null;
  masterTypeIdName: string | null;
  masterGoodsIdName: string | null;
  masterContractAvailableName: string | null;
  masterOrgGroupName?: string | null;
  masterOrgDepartmentName?: string | null;
}

export class BmaClient {
  private readonly baseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;

  public constructor(options: BmaClientOptions = {}) {
    const config = getIngestionConfig();
    this.baseUrl = (options.baseUrl ?? config.bmaBaseUrl ?? 'https://egp2.bangkok.go.th').replace(/\/+$/, '');
    this.apiBaseUrl = (options.apiBaseUrl ?? BMA_EGP_ENDPOINTS.api).replace(/\/+$/, '');
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
   * Get direct URL to download a document from BMA e-GP.
   */
  public fileUrl(announcementId: string, filename: string): string {
    return `${BMA_EGP_ENDPOINTS.file}/${announcementId}/${encodeURIComponent(filename)}`;
  }

  /**
   * Get public detail listing URL for a BMA project.
   */
  public listingUrl(projectId: string): string {
    return `${BMA_EGP_ENDPOINTS.listing}/${projectId}`;
  }

  /**
   * Fetch announcements (TOR, tender notice, awards) for a specific BMA project.
   */
  public async getProjectAnnouncements(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<RawBmaAnnouncement[]> {
    try {
      const targetUrl = new URL(`${this.apiBaseUrl}/ProjectAnnouncements/GetAnnouncementDetailInProject`);
      targetUrl.searchParams.set('pageNo', '1');
      targetUrl.searchParams.set('pageSize', '20');
      targetUrl.searchParams.set('projectId', projectId);

      const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      const res = await this.fetchImpl(targetUrl.toString(), {
        method: 'GET',
        headers: { 'User-Agent': 'TORBIDD-Ingestion-Bot/1.0', Accept: 'application/json' },
        signal: combinedSignal,
      });

      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch signed contracts for an awarded BMA project.
   */
  public async getProjectContracts(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<RawBmaContract[]> {
    try {
      const targetUrl = new URL(`${this.apiBaseUrl}/ProjectContracts/GetProjectContractInProject`);
      targetUrl.searchParams.set('pageNo', '1');
      targetUrl.searchParams.set('pageSize', '20');
      targetUrl.searchParams.set('projectId', projectId);

      const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      const res = await this.fetchImpl(targetUrl.toString(), {
        method: 'GET',
        headers: { 'User-Agent': 'TORBIDD-Ingestion-Bot/1.0', Accept: 'application/json' },
        signal: combinedSignal,
      });

      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch detailed metadata (procurement method, goods category, status) for a BMA project.
   */
  public async getProjectDetail(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<RawBmaProjectDetail | null> {
    try {
      const targetUrl = new URL(`${this.apiBaseUrl}/Projects/GetProjectDetail`);
      targetUrl.searchParams.set('projectId', projectId);

      const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      const res = await this.fetchImpl(targetUrl.toString(), {
        method: 'GET',
        headers: { 'User-Agent': 'TORBIDD-Ingestion-Bot/1.0', Accept: 'application/json' },
        signal: combinedSignal,
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Discovers procurement projects from BMA e-Procurement portal.
   * Primary: Queries BMA e-GP JSON API endpoint (/Projects/GetProjectFromFilter).
   * Fallback: Legacy/mock URL or HTML parsing if testing with mock servers.
   */
  public async searchProjects(params: BmaSearchParams = {}): Promise<BmaSearchResult> {
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 1000);
    const page = Math.max(params.page ?? 1, 1);
    const keyword = params.keyword?.trim() || '';
    const announceTypeId = params.announceTypeId || BMA_ANNOUNCE_TYPES.INVITATION.id;

    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
    const combinedSignal = params.signal
      ? AbortSignal.any([params.signal, timeoutSignal])
      : timeoutSignal;

    // 1. Try real Bangkok e-GP REST API
    try {
      const apiUrl = new URL(`${this.apiBaseUrl}/Projects/GetProjectFromFilter`);
      apiUrl.searchParams.set('projectSearchText', keyword);
      apiUrl.searchParams.set('masterAnnounceTypeId', announceTypeId);
      apiUrl.searchParams.set('startDate', '');
      apiUrl.searchParams.set('endDate', '');
      apiUrl.searchParams.set('pageNo', String(page));
      apiUrl.searchParams.set('pageSize', String(limit));
      apiUrl.searchParams.set('sortBy', 'publishDateDesc');

      const apiResponse = await this.fetchImpl(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'TORBIDD-Ingestion-Bot/1.0',
          Accept: 'application/json',
        },
        signal: combinedSignal,
      });

      if (apiResponse.ok) {
        const json = await apiResponse.json();
        const rawList = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (rawList.length > 0 || json?.totalCount !== undefined) {
          const projects = this.mapRawProjects(rawList);
          return {
            total: json.totalCount ?? json.total ?? projects.length,
            page,
            limit,
            projects,
          };
        }
      }
    } catch {
      // Continue to fallback if API URL is unavailable or mocked
    }

    // 2. Fallback: Base URL search endpoint (mock test compatibility)
    try {
      const fallbackUrl = new URL(`${this.baseUrl}/project-search`);
      if (keyword) fallbackUrl.searchParams.set('keyword', keyword);
      if (params.fiscalYear) fallbackUrl.searchParams.set('budgetYear', String(params.fiscalYear));
      fallbackUrl.searchParams.set('page', String(page));
      fallbackUrl.searchParams.set('size', String(limit));

      const response = await this.fetchImpl(fallbackUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'TORBIDD-Ingestion-Bot/1.0',
          Accept: 'application/json, text/html',
        },
        signal: combinedSignal,
      });

      if (!response.ok) {
        return { total: 0, page, limit, projects: [] };
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        const rawList = Array.isArray(json) ? json : json.data || json.items || [];
        const projects = this.mapRawProjects(rawList);
        return {
          total: json.total ?? json.totalCount ?? projects.length,
          page,
          limit,
          projects,
        };
      }

      // If portal returned HTML
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

  /**
   * Enriches a single project with announcements, TOR document link, and contract details.
   */
  public async enrichProject(project: DiscoveredProject, signal?: AbortSignal): Promise<DiscoveredProject> {
    const rawProjectId = (project.rawPayload?.projectId as string) || project.externalProjectId;
    if (!rawProjectId) return project;

    try {
      const [announcements, detail, contracts] = await Promise.all([
        this.getProjectAnnouncements(rawProjectId, signal),
        this.getProjectDetail(rawProjectId, signal),
        this.getProjectContracts(rawProjectId, signal),
      ]);

      const enriched = { ...project };

      // Procurement method / type from detail
      if (detail?.masterMethodIdName) {
        enriched.procurementType = `ประกวดราคา (${detail.masterMethodIdName})`;
      } else if (detail?.masterTypeIdName) {
        enriched.procurementType = detail.masterTypeIdName;
      }

      // Announcements & TOR documents
      const torAnn = announcements.find((a) => {
        const name = (a.masterAnnounceTypeName || '').toLowerCase();
        return name.includes('tor') || name.includes('ขอบเขตของงาน');
      });

      if (torAnn && torAnn.projectAnnouncementPath) {
        enriched.torStatus = 'AVAILABLE';
        enriched.sourceUrl = this.fileUrl(torAnn.id, torAnn.projectAnnouncementPath);
        if (torAnn.projectAnnouncementPublishDate) {
          enriched.publishDate = torAnn.projectAnnouncementPublishDate;
        }
      } else if (announcements.length > 0) {
        const firstAnn = announcements[0];
        if (firstAnn.projectAnnouncementPath) {
          enriched.sourceUrl = this.fileUrl(firstAnn.id, firstAnn.projectAnnouncementPath);
        }
        if (firstAnn.projectAnnouncementPublishDate) {
          enriched.publishDate = firstAnn.projectAnnouncementPublishDate;
        }
      }

      // Contracts / Winner info
      if (contracts.length > 0) {
        const firstContract = contracts[0];
        if (firstContract.projectContractBidderName) {
          enriched.winnerName = firstContract.projectContractBidderName.trim();
          enriched.status = 'จัดทำสัญญาแล้ว';
        }
        if (firstContract.projectContractContractBudget) {
          enriched.contractPrice = Number(firstContract.projectContractContractBudget) || 0;
        }
        if (firstContract.projectContractContractDate) {
          enriched.contractDate = firstContract.projectContractContractDate;
        }
      } else if (detail?.masterContractAvailableName) {
        enriched.status = detail.masterContractAvailableName;
      }

      // Merge into rawPayload
      enriched.rawPayload = {
        ...enriched.rawPayload,
        bmaDetail: detail,
        bmaAnnouncementsCount: announcements.length,
        bmaContractsCount: contracts.length,
      };

      return enriched;
    } catch {
      return project;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public mapRawProjects(rawItems: any[]): DiscoveredProject[] {
    return rawItems
      .filter((item) => item && (item.projectNumber || item.projectId || item.id || item.project_id))
      .map((item) => {
        // Prefer Bangkok projectNumber (e.g. "69109001213") as externalProjectId
        const projectNumber = item.projectNumber ? String(item.projectNumber).trim() : '';
        const rawId = String(item.projectId || item.id || item.project_id || projectNumber).trim();
        const externalProjectId = projectNumber || rawId;

        const name = String(item.projectName || item.name || item.project_name || 'BMA Procurement').trim();
        const agency = String(
          item.masterOrgDepartmentName ||
          item.departmentName ||
          item.deptName ||
          item.masterOrgGroupName ||
          'กรุงเทพมหานคร',
        ).trim();

        const budget = Number(item.projectBudget || item.budget || item.sumPrice || 0);

        // Derive Thai Fiscal Year: from projectNumber (e.g. 69xxxx -> 2569) or budgetYear
        let fiscalYear = Number(item.budgetYear || item.year);
        if ((!fiscalYear || isNaN(fiscalYear)) && projectNumber && projectNumber.length >= 2) {
          const prefix = parseInt(projectNumber.slice(0, 2), 10);
          if (prefix >= 50 && prefix <= 99) {
            fiscalYear = 2500 + prefix;
          }
        }
        if (!fiscalYear || isNaN(fiscalYear)) {
          fiscalYear = new Date().getFullYear() + 543;
        }

        const sourceUrl = item.projectId
          ? this.listingUrl(item.projectId)
          : `${this.baseUrl}/project-detail/${externalProjectId}`;

        return {
          externalProjectId,
          projectName: name,
          agencyName: agency,
          fiscalYear,
          source: 'BMA_EGP',
          sourceUrl,
          budget: Number.isFinite(budget) ? budget : 0,
          procurementType: item.procurementMethod || item.announceType || 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',
          torStatus: 'PENDING',
          rawPayload: {
            ...item,
            projectId: item.projectId || rawId,
            projectNumber: projectNumber || undefined,
          },
        };
      });
  }

  public extractProjectsFromHtml(html: string, fallbackYear?: number): DiscoveredProject[] {
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
          torStatus: 'PENDING',
        });
      }
    }

    return projects;
  }
}

