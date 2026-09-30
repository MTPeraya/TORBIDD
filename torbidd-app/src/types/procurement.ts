// =============================================================================
// types/procurement.ts - Unified Procurement Types & Data Ingestion Contracts
// (Supports Issues #150, #154, #155, #156 & Government Ingestion)
// =============================================================================

import { Project, ProjectCategory } from './project';
import { SoftwareCategory } from './procurement-category';

// ─── Query & Discovery Contracts ─────────────────────────────────────────────

export type Procurement = Project;

export type ProcurementSortOption =
  | 'publishDate_desc'
  | 'publishDate_asc'
  | 'budget_desc'
  | 'budget_asc';

export interface ProcurementFilters {
  search?: string;
  categories?: (SoftwareCategory | ProjectCategory | string)[];
  agencies?: string[];
  department?: string; // backwards compatibility with single department filter
  minBudget?: number | null;
  maxBudget?: number | null;
  budgetPreset?: 'under5m' | '5to10' | '10to20' | 'above20m' | '';
  deadline?: 'within7' | 'within30' | 'moreThan30' | '';
  sortBy?: ProcurementSortOption;
  page?: number;
  limit?: number;
  isSoftwareRelated?: boolean;
}

export interface ProcurementQueryResult {
  items: Project[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActiveFilterIndicator {
  id: string;
  type: 'search' | 'category' | 'agency' | 'budget' | 'deadline';
  label: string;
  value: string;
}

// ─── Data Ingestion Contracts ────────────────────────────────────────────────

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
  is_software?: boolean;
  software_category?: string;
  ai_confidence?: 'High' | 'Medium' | 'Low';
  classification_reason?: string;
  classified_by?: 'ai' | 'admin' | 'rule';
  classified_at?: Date | string;
  admin_reviewed?: boolean;
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
