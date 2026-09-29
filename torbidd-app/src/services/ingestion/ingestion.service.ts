// =============================================================================
// services/ingestion/ingestion.service.ts - End-to-End Ingestion Pipeline Service
// =============================================================================

import { GovSpendingClient } from './clients/govspending-client';
import { EgpClient } from './clients/egp-client';
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
  GovSpendingSearchParams,
  GovSpendingSearchResult,
  IngestionDocumentsResult,
  ProcurementDocumentRecord,
} from '@/types/procurement';

export interface IngestionServiceOptions {
  govSpendingClient?: GovSpendingClient;
  egpClient?: EgpClient;
  documentExtractor?: DocumentExtractor;
}

export class IngestionService {
  private readonly govSpendingClient: GovSpendingClient;
  private readonly egpClient: EgpClient;
  private readonly documentExtractor: DocumentExtractor;

  public constructor(options: IngestionServiceOptions = {}) {
    this.govSpendingClient = options.govSpendingClient ?? new GovSpendingClient();
    this.egpClient = options.egpClient ?? new EgpClient();
    this.documentExtractor = options.documentExtractor ?? new DocumentExtractor();
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

    // 2. Pre-ingestion check: Detect duplicates and identify version revisions before downstream queuing
    let dedupCheck: DeduplicationCheckResult | null = null;
    try {
      dedupCheck = await checkProjectDeduplication(searchResult.projects);
    } catch {
      // Offline fallback
    }

    // 3. Persist discovered projects idempotently with conflict resolution
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
      upsertStats = await upsertDiscoveredProjects(searchResult.projects);
    } catch (dbErr) {
      console.warn('[IngestionService] Database upsert skipped or offline:', dbErr);
    }

    return {
      ...searchResult,
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
