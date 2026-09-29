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
  contractPrice?: number;
  procurementType?: string;
  summary?: { th: string; en: string };
  requiredTechnologies?: string[];
  technicalRequirements?: { th: string[]; en: string[] };
  extractedQualifications?: Array<{
    id: string;
    description: { th: string; en: string };
    category: 'Legal' | 'Financial' | 'Experience' | 'Technical';
    threshold?: string;
    mandatory: boolean;
  }>;
  extractionStatus?: 'PENDING' | 'EXTRACTED' | 'FAILED';
  contentHash?: string;
  revision?: number;
  discoveredAt?: Date | string;
  updatedAt?: Date | string;
}

export interface DeduplicationCheckResult {
  newProjects: DiscoveredProject[];
  updatedProjects: Array<{
    project: DiscoveredProject;
    oldRevision: number;
    newRevision: number;
    reason: string;
  }>;
  duplicateProjects: Array<{
    project: DiscoveredProject;
    existingRevision: number;
  }>;
  metrics: {
    totalChecked: number;
    newCount: number;
    updatedCount: number;
    duplicateCount: number;
  };
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

export interface GovSpendingMetrics {
  totalRecordsRetrieved: number;
  payloadSizeBytes: number;
  recordsByAgency: Record<string, number>;
}

export interface GovSpendingSearchResult {
  total: number;
  page: number;
  limit: number;
  offset: number;
  projects: DiscoveredProject[];
  metrics?: GovSpendingMetrics;
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
  extraction?: Record<string, unknown>;
}
