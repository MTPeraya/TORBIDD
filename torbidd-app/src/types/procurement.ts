// =============================================================================
// types/procurement.ts - Types for Government Procurement Data Ingestion
// =============================================================================

export interface DiscoveredProject {
  _id?: string;
  externalProjectId: string;
  projectName: string;
  agencyName: string;
  fiscalYear: number;
  source: string;
  sourceUrl: string;
  budget?: number;
  procurementType?: string;
  discoveredAt?: Date | string;
  updatedAt?: Date | string;
}

export type DocumentType = 'ATTACH_TOR' | 'ANNOUNCEMENT' | 'OTHER';
export type DocumentStatus = 'PROCESSED' | 'DOWNLOADED' | 'FAILED' | 'MISSING';

export interface ProcurementDocumentRecord {
  _id?: string;
  projectId: string; // ObjectId string referencing ProcurementProject
  externalProjectId: string;
  documentType: DocumentType;
  fileName: string;
  filePath: string;
  storageReference: string;
  source: string;
  sourceUrl: string;
  fileSize: number;
  mimeType: string;
  downloadedAt: Date | string;
  status: DocumentStatus;
  errorMessage?: string;
}

export interface ProcurementProjectWithDocuments extends DiscoveredProject {
  documents: ProcurementDocumentRecord[];
}

export interface GovSpendingSearchParams {
  keyword?: string;
  fiscalYear?: number;
  page?: number;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface GovSpendingSearchResult {
  total: number;
  page: number;
  limit: number;
  offset: number;
  projects: DiscoveredProject[];
}

export interface EgpArchiveMetadata {
  zipId: string;
  archiveName: string;
  projectId: string;
}

export interface ExtractedDocument {
  fileName: string;
  mimeType: string;
  content: Buffer;
  documentType: DocumentType;
  sourceUrl: string;
  fileSize: number;
}

export interface IngestionDocumentsResult {
  projectId: string;
  externalProjectId: string;
  documentsFound: number;
  documents: ProcurementDocumentRecord[];
  alreadyIngested?: boolean;
}
