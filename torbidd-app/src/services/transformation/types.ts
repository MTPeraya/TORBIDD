// =============================================================================
// services/transformation/types.ts - Data Contracts & Types for ETL Transformation
// =============================================================================

export interface RawAgencyPayload {
  // Common heterogeneous identifier keys
  project_id?: string | number;
  projectId?: string | number;
  external_id?: string | number;
  externalId?: string | number;
  id?: string | number;

  // Title keys
  project_name?: string;
  projectName?: string;
  title?: string | { th?: string; en?: string };

  // Agency keys
  dept_name?: string;
  dept_sub_name?: string;
  agency_name?: string;
  agencyName?: string;
  department?: string | { th?: string; en?: string };
  organization?: string;

  // Budget keys
  budget?: string | number;
  project_money?: string | number;
  projectMoney?: string | number;
  sum_price_agree?: string | number;
  sumPriceAgree?: string | number;
  contract_price?: string | number;
  contractPrice?: string | number;
  price?: string | number;
  amount?: string | number;

  // Date keys
  publish_date?: string | Date;
  publishDate?: string | Date;
  announce_date?: string | Date;
  date?: string | Date;
  contract_date?: string | Date;
  discovered_at?: string | Date;

  // Fiscal year keys
  year?: string | number;
  fiscal_year?: string | number;
  fiscalYear?: string | number;

  // Procurement method / type keys
  procurement_type?: string;
  procurementType?: string;
  transaction_sub_type_name?: string;
  method?: string;

  // URL / Document keys
  source_url?: string;
  sourceUrl?: string;
  detail_url?: string;
  document_url?: string;
  documents?: Array<{
    fileName?: string;
    fileUrl?: string;
    fileType?: string;
  }>;

  // Catch-all for heterogeneous payloads
  [key: string]: unknown;
}

export interface NormalizedProcurementProject {
  externalProjectId: string;
  projectName: string;
  agencyName: string;
  fiscalYear: number;
  budget: number;
  contractPrice?: number;
  publishDate: string; // ISO-8601 UTC
  procurementType: string;
  source: string;
  sourceUrl: string;
  documentLinks: string[];
  contentHash: string;
  revision: number;
  transformedAt: string;
}

export type TransformationStatus = 'VALID' | 'FLAGGED' | 'REJECTED';

export interface TransformationIssue {
  field: string;
  message: string;
  rawValue?: unknown;
}

export interface TransformationResult<T = NormalizedProcurementProject> {
  status: TransformationStatus;
  data?: T;
  flags: string[];
  errors: TransformationIssue[];
  rawPayload: unknown;
}

export interface BatchTransformationSummary {
  total: number;
  validCount: number;
  flaggedCount: number;
  rejectedCount: number;
  items: TransformationResult[];
  validProjects: NormalizedProcurementProject[];
}
