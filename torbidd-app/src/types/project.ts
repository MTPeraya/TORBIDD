// =============================================================================
// Types: Project
// =============================================================================

// UC-10: Expanded software categories
export type ProjectCategory =
  | 'Website'
  | 'Mobile App'
  | 'AI'
  | 'Database'
  | 'ERP'
  | 'Cloud'
  | 'Data Analytics'
  | 'Information System';

export type ClassificationReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'CORRECTED';

export type AiConfidence = 'High' | 'Medium' | 'Low';

export interface BilingualText {
  th: string;
  en: string;
}

export interface Department {
  th: string;
  en: string;
}

export type QualificationCriteriaType =
  | 'registered_capital'
  | 'past_project_value'
  | 'certifications'
  | 'personnel_experience'
  | 'legal_status'
  | 'other';

export type ClauseRiskLevel = 'Safe' | 'Low' | 'Medium' | 'High';

export interface RestrictiveClauseAssessment {
  isRestrictive: boolean;
  riskLevel: ClauseRiskLevel;
  flagReason?: { th: string; en: string };
  legalReference?: string;
  recommendation?: { th: string; en: string };
}

export interface QualificationCriteriaValue {
  key: string; // e.g. 'min_past_project_value', 'min_registered_capital', 'min_personnel_years'
  value: string | number;
  unit?: string;
  numericValue?: number;
}

export interface ExtractedQualificationItem {
  id: string;
  description: BilingualText;
  category: 'Legal' | 'Financial' | 'Experience' | 'Technical';
  threshold?: string;
  mandatory: boolean;
  criteriaType?: QualificationCriteriaType;
  criteriaValue?: QualificationCriteriaValue;
  riskAssessment?: RestrictiveClauseAssessment;
}

export interface TimelineEvent {
  id: string;
  event: BilingualText;
  date: string; // ISO date
  description?: BilingualText;
  status: 'completed' | 'active' | 'upcoming';
}

export interface BudgetBreakdownItem {
  category: BilingualText;
  amount: number;
  percentage: number;
}

export interface HighlightedQualification {
  type: 'critical' | 'standard';
  title: BilingualText;
  description: BilingualText;
}

export interface DocumentSection {
  sectionId: string;
  articleNumber?: string;
  title: BilingualText;
  page: number;
  content: BilingualText;
  extractedHighlights?: BilingualText[];
}

export interface AiMetadata {
  model: string;
  confidenceScore: number;
  verifiedByHuman: boolean;
  extractedClausesCount: number;
  lastVerifiedDate: string;
}

export interface ContactInfo {
  department: BilingualText;
  division?: BilingualText;
  phone?: string;
  email?: string;
  officer?: BilingualText;
}

export type TorStatus = 'AVAILABLE' | 'NO_TOR' | 'PENDING';

export interface Project {
  _id?: string;
  externalId: number;
  title: BilingualText;
  department: Department;
  budget: number; // in THB
  contractPrice?: number; // in THB (ราคามูลค่าที่จัดหาได้ / ราคาตกลงซื้อจ้าง)
  publishDate: string; // ISO date string — actual announcement date from source
  deadline: string; // ISO date string
  fiscalYear?: number; // Thai fiscal year (พ.ศ.), e.g. 2568
  category: ProjectCategory;
  isSoftwareRelated?: boolean;         // UC-10: software vs non-software flag (default: true)
  classificationReviewStatus?: ClassificationReviewStatus; // UC-10: admin review
  procurementType: string;
  description: BilingualText;
  summary?: BilingualText; // Issue #87: TOR Executive Summary
  scope: { th: string[]; en: string[] };
  qualifications: { th: string[]; en: string[] };
  requiredTechnologies?: string[]; // Issue #89: Required Tech Stack tags
  technicalRequirements?: { th: string[]; en: string[] }; // Issue #89: Technical Requirements
  extractedQualifications?: ExtractedQualificationItem[]; // Issue #90: Detailed Qualifications
  historicalAvg: number;
  sourceDocument: string;
  sourceUrl?: string;
  documentUrl?: string;
  torStatus?: TorStatus; // Whether TOR document is available
  processedDate: string; // ISO date string — when data was synced/processed
  aiConfidence: AiConfidence;
  aiClassificationModel?: string;
  extractionStatus?: 'PENDING' | 'EXTRACTED' | 'FAILED';
  timeline?: TimelineEvent[];
  budgetBreakdown?: BudgetBreakdownItem[];
  highlightedQualifications?: HighlightedQualification[];
  documentSections?: DocumentSection[];
  aiMetadata?: AiMetadata;
  contactInfo?: ContactInfo;
  createdAt?: string;
  updatedAt?: string;
  contractDate?: string;
  contractFinishDate?: string;
  winnerName?: string;
  medianPrice?: number;
  status?: string;
  _hasActualPublishDate?: boolean;
}

export interface ProjectFilters {
  search?: string;
  department?: string;
  agency?: string;
  agencies?: string | string[];
  category?: ProjectCategory;
  categories?: string | string[];
  isSoftwareRelated?: boolean;        // UC-10: filter by software flag
  classificationReviewStatus?: ClassificationReviewStatus;
  budget?: 'under5m' | '5to10' | '10to20' | 'above20m';
  minBudget?: number;
  maxBudget?: number;
  deadline?: 'within7' | 'within30' | 'moreThan30';
  sortBy?:
    | 'publishDate_desc'
    | 'publishDate_asc'
    | 'budget_desc'
    | 'budget_asc'
    | 'deadline_asc'
    | 'deadline_desc'
    | 'newest'
    | 'oldest';
  page?: number;
  limit?: number;
}

