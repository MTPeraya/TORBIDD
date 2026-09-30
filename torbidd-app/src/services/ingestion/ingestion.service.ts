// =============================================================================
// services/ingestion/ingestion.service.ts - End-to-End Ingestion Pipeline Service
// =============================================================================

import { GovSpendingClient, GovSpendingHealthStatus } from './clients/govspending-client';
import { EgpClient, EgpHealthStatus } from './clients/egp-client';
import { BmaClient, BmaHealthStatus } from './clients/bma-client';
import { DocumentExtractor } from './document-extractor';
import {
  upsertDiscoveredProjects,
  saveProcurementDocument,
  getDocumentsByProjectId,
  getProcurementProjectByExternalId,
  checkProjectDeduplication,
  updateProcurementProjectExtraction,
} from '@/services/database/procurement';
import { extractTorFromFile, TorExtractResult } from '@/services/ai/tor-extractor';
import {
  DeduplicationCheckResult,
  DiscoveredProject,
  GovSpendingSearchParams,
  GovSpendingSearchResult,
  IngestionDocumentsResult,
  ProcurementDocumentRecord,
} from '@/types/procurement';

export interface IngestionServiceOptions {
  govSpendingClient?: GovSpendingClient;
  egpClient?: EgpClient;
  bmaClient?: BmaClient;
  documentExtractor?: DocumentExtractor;
}

export interface SourcesHealthReport {
  timestamp: string;
  sources: {
    bma: BmaHealthStatus;
    egp: EgpHealthStatus;
    dataGoTh: GovSpendingHealthStatus;
  };
  allReachable: boolean;
}

export class IngestionService {
  private readonly govSpendingClient: GovSpendingClient;
  private readonly egpClient: EgpClient;
  private readonly bmaClient: BmaClient;
  private readonly documentExtractor: DocumentExtractor;

  public constructor(options: IngestionServiceOptions = {}) {
    this.govSpendingClient = options.govSpendingClient ?? new GovSpendingClient();
    this.egpClient = options.egpClient ?? new EgpClient();
    this.bmaClient = options.bmaClient ?? new BmaClient();
    this.documentExtractor = options.documentExtractor ?? new DocumentExtractor();
  }

  /**
   * Diagnostic check verifying live connectivity to all 3 required government data sources:
   * 1. Bangkok Metropolitan Administration (egp2.bangkok.go.th)
   * 2. Electronic Government Procurement (www.gprocurement.go.th)
   * 3. Open Government Data of Thailand (data.go.th / opend.data.go.th)
   */
  public async checkAllSourcesHealth(): Promise<SourcesHealthReport> {
    const [bma, egp, dataGoTh] = await Promise.all([
      this.bmaClient.checkHealth(),
      this.egpClient.checkHealth(),
      this.govSpendingClient.checkHealth(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      sources: {
        bma,
        egp,
        dataGoTh,
      },
      allReachable: bma.status === 'UP' && egp.status === 'UP' && dataGoTh.status === 'UP',
    };
  }

  /**
   * Unified multi-source discovery aggregating projects from:
   * - Open Government Data (data.go.th / CKAN)
   * - BMA e-Procurement (egp2.bangkok.go.th)
   * - National e-GP Announcements (process3 / process5.gprocurement.go.th)
   */
  public async discoverFromAllSources(params: GovSpendingSearchParams = {}): Promise<{
    totalProjects: number;
    upsertedCount: number;
    modifiedCount: number;
    bySource: Record<string, number>;
    projects: DiscoveredProject[];
  }> {
    const allProjects: DiscoveredProject[] = [];
    const bySource: Record<string, number> = {
      CKAN_GOVSPENDING: 0,
      BMA_EGP: 0,
      NATIONAL_EGP: 0,
    };

    // 1. Data.go.th (CKAN)
    try {
      const ckanRes = await this.govSpendingClient.searchProjects(params);
      allProjects.push(...ckanRes.projects);
      bySource.CKAN_GOVSPENDING = ckanRes.projects.length;
    } catch (ckanErr) {
      console.warn('[IngestionService] CKAN search skipped/failed:', ckanErr);
    }

    // 2. BMA e-Procurement (egp2.bangkok.go.th)
    try {
      const bmaRes = await this.bmaClient.searchProjects({
        keyword: params.keyword,
        fiscalYear: params.fiscalYear,
        signal: params.signal,
      });
      allProjects.push(...bmaRes.projects);
      bySource.BMA_EGP = bmaRes.projects.length;
    } catch (bmaErr) {
      console.warn('[IngestionService] BMA search skipped/failed:', bmaErr);
    }

    // 3. National e-GP (gprocurement.go.th)
    try {
      const egpRes = await this.egpClient.pollAnnouncements({
        signal: params.signal,
      });
      allProjects.push(...egpRes.projects);
      bySource.NATIONAL_EGP = egpRes.projects.length;
    } catch (egpErr) {
      console.warn('[IngestionService] e-GP RSS poll skipped/failed:', egpErr);
    }

    // 4. Automatically classify all discovered projects as software / category (UC-10)
    await this.classifyDiscoveredProjects(allProjects);

    // 5. Filter: only persist projects that are software-related (is_software === true)
    const softwareProjects = allProjects.filter((p) => p.is_software === true);
    const filteredOutCount = allProjects.length - softwareProjects.length;
    if (filteredOutCount > 0) {
      console.info(
        `[IngestionService] Filtered out ${filteredOutCount} non-software projects. Persisting ${softwareProjects.length} software-related projects.`,
      );
    }

    // 6. Persist software-only discovered projects idempotently
    let upsertStats = { upsertedCount: 0, modifiedCount: 0 };
    try {
      if (softwareProjects.length > 0) {
        const stats = await upsertDiscoveredProjects(softwareProjects);
        upsertStats = {
          upsertedCount: stats.upsertedCount,
          modifiedCount: stats.modifiedCount,
        };
      }
    } catch (dbErr) {
      console.warn('[IngestionService] Database upsert skipped or offline:', dbErr);
    }

    return {
      totalProjects: softwareProjects.length,
      upsertedCount: upsertStats.upsertedCount,
      modifiedCount: upsertStats.modifiedCount,
      bySource,
      projects: softwareProjects,
    };
  }

  /**
   * UC-10: Automatically classify discovered projects into software or non-software,
   * assigning software_category, ai_confidence, classification_reason, and classified_by.
   */
  private async classifyDiscoveredProjects(projects: DiscoveredProject[]): Promise<void> {
    if (!projects || projects.length === 0) return;
    try {
      const { classifyProject } = await import('@/services/ai/classifier');
      const { classifyByKeywords } = await import('@/services/ai/adapters');

      // For bulk discovery (>20), use instant rule-based classification to prevent 429 quota exhaustion.
      // Small batches / single items use configured AI provider.
      const isBulk = projects.length > 20;

      for (const p of projects) {
        if (p.is_software !== undefined && p.software_category) continue;
        try {
          const res = isBulk
            ? classifyByKeywords(p.projectName, p.summary?.th || p.projectName)
            : await classifyProject(p.projectName, p.summary?.th || p.projectName);

          p.is_software = res.isSoftwareRelated;
          p.software_category = res.category;
          p.ai_confidence = res.confidence;
          p.classification_reason = res.reasoning;
          p.classified_by = isBulk ? 'rule' : (res.provider ? 'ai' : 'rule');
          p.classified_at = new Date();
        } catch {
          p.is_software = true;
          p.software_category = 'Website';
          p.ai_confidence = 'Medium';
          p.classified_by = 'rule';
          p.classified_at = new Date();
        }
      }
    } catch (err) {
      console.warn('[IngestionService] Project classification skipped:', err);
    }
  }

  /**
   * Step 1: Discover procurement projects from CKAN / Open Government Data.
   * Performs pre-ingestion duplicate check and idempotently saves discovered projects to MongoDB.
   */
  public async discoverProjects(
    params: GovSpendingSearchParams = {},
  ): Promise<
    GovSpendingSearchResult & {
      upsertedCount: number;
      modifiedCount: number;
      deduplication?: DeduplicationCheckResult['metrics'];
    }
  > {
    // 1. Query CKAN / GovSpending API
    const searchResult = await this.govSpendingClient.searchProjects(params);

    // 1.5 Classify all discovered projects (UC-10)
    await this.classifyDiscoveredProjects(searchResult.projects);

    // 1.6 Filter: only continue with software-related projects
    const softwareProjects = searchResult.projects.filter((p) => p.is_software === true);
    const filteredOut = searchResult.projects.length - softwareProjects.length;
    if (filteredOut > 0) {
      console.info(`[IngestionService] discoverProjects: filtered out ${filteredOut} non-software, keeping ${softwareProjects.length}.`);
    }

    // 2. Pre-ingestion check: Detect duplicates and identify version revisions before downstream queuing
    let dedupCheck: DeduplicationCheckResult | null = null;
    try {
      dedupCheck = await checkProjectDeduplication(softwareProjects);
    } catch {
      // Offline fallback
    }

    // 3. Persist software-only projects idempotently with conflict resolution
    let upsertStats: {
      upsertedCount: number;
      modifiedCount: number;
      matchedCount: number;
      dedupMetrics?: DeduplicationCheckResult['metrics'];
    } = {
      upsertedCount: 0,
      modifiedCount: 0,
      matchedCount: 0,
    };
    try {
      upsertStats = await upsertDiscoveredProjects(softwareProjects);
    } catch (dbErr) {
      console.warn('[IngestionService] Database upsert skipped or offline:', dbErr);
    }

    return {
      ...searchResult,
      projects: softwareProjects,
      total: softwareProjects.length,
      upsertedCount: upsertStats.upsertedCount,
      modifiedCount: upsertStats.modifiedCount,
      deduplication: dedupCheck?.metrics ?? upsertStats.dedupMetrics,
    };
  }

  /**
   * Step 2 & 3: Retrieve project documents from e-GP, safely extract ATTACH_TOR, and persist.
   * Idempotent: Checks if documents already exist to prevent duplicate downloads.
   */
  public async ingestProjectDocuments(projectId: string): Promise<IngestionDocumentsResult> {
    const cleanId = projectId.trim();
    this.egpClient.assertProjectId(cleanId);

    // 1. Check idempotency: Have we already ingested documents for this project?
    try {
      const existingDocs = await getDocumentsByProjectId(cleanId);
      const hasTor = existingDocs.some((d) => d.documentType === 'ATTACH_TOR' && d.status === 'PROCESSED');
      if (hasTor) {
        console.info(`[Deduplication Audit] Skipped duplicate document download for project ${cleanId} (ATTACH_TOR already PROCESSED)`);
        return {
          projectId: cleanId,
          externalProjectId: cleanId,
          documentsFound: existingDocs.length,
          documents: existingDocs as unknown as ProcurementDocumentRecord[],
          alreadyIngested: true,
        };
      }
    } catch {
      // Continue if DB check fails
    }

    // 2. Query e-GP for metadata and download ZIP archive
    const { metadata, zipBuffer } = await this.egpClient.fetchProjectZip(cleanId);

    // 3. Safely decompress ZIP, check zip-bombs & find ATTACH_TOR
    const downloadUrl = `https://process5.gprocurement.go.th/egp-upload-service/v1/downloadFileTest?fileId=${metadata.zipId}`;
    const extractedDocs = this.documentExtractor.extractZip(zipBuffer, cleanId, downloadUrl);

    // 4. Persist extracted files to disk
    const diskResults = await this.documentExtractor.persistDocumentsToDisk(cleanId, extractedDocs);

    // 5. Look up project to associate ObjectId if possible
    let targetDbId = cleanId;
    try {
      const project = await getProcurementProjectByExternalId(cleanId);
      if (project) {
        targetDbId = project._id.toString();
      }
    } catch {
      // If DB offline, fallback
    }

    // 6. Save document records idempotently to MongoDB
    const savedDocumentRecords: ProcurementDocumentRecord[] = [];
    for (const item of diskResults) {
      const docPayload: Omit<ProcurementDocumentRecord, '_id'> = {
        projectId: targetDbId,
        externalProjectId: cleanId,
        documentType: item.document.documentType,
        fileName: item.document.fileName,
        filePath: item.relativePath,
        storageReference: item.absolutePath,
        source: 'NATIONAL_EGP',
        sourceUrl: item.document.sourceUrl,
        fileSize: item.document.fileSize,
        mimeType: item.document.mimeType,
        downloadedAt: new Date(),
        status: 'PROCESSED',
      };

      try {
        const { document } = await saveProcurementDocument(docPayload);
        savedDocumentRecords.push(document as unknown as ProcurementDocumentRecord);
      } catch (dbErr) {
        console.warn('[IngestionService] Could not persist document record to DB:', dbErr);
        savedDocumentRecords.push({
          ...docPayload,
          downloadedAt: new Date().toISOString(),
        });
      }
    }

    // 7. Issue #91: Automatically process TOR documents and extract structured procurement data
    let extractionResult: TorExtractResult | null = null;
    const torDiskItem = diskResults.find((item) => item.document.documentType === 'ATTACH_TOR');
    if (torDiskItem) {
      try {
        const existingProj = await getProcurementProjectByExternalId(cleanId);
        extractionResult = await extractTorFromFile(torDiskItem.absolutePath, {
          projectId: cleanId,
          fileName: torDiskItem.document.fileName,
          projectContext: {
            projectName: existingProj?.projectName,
            agencyName: existingProj?.agencyName,
            budget: existingProj?.budget,
            fiscalYear: existingProj?.fiscalYear,
            procurementType: existingProj?.procurementType,
          },
        });

        if (extractionResult) {
          await updateProcurementProjectExtraction(cleanId, extractionResult);
          console.info(`[IngestionService] Auto TOR extraction completed for project ${cleanId}`);
        }
      } catch (extractErr) {
        console.warn(`[IngestionService] Auto TOR extraction warning for project ${cleanId}:`, extractErr);
      }
    }

    return {
      projectId: targetDbId,
      externalProjectId: cleanId,
      documentsFound: savedDocumentRecords.length,
      documents: savedDocumentRecords,
      alreadyIngested: false,
      extraction: (extractionResult as unknown as Record<string, unknown>) ?? undefined,
    };
  }
}
