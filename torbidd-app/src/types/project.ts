// =============================================================================
// Types: Project
// =============================================================================

export type ProjectCategory = 'Website' | 'Mobile App' | 'AI' | 'Database';

export type AiConfidence = 'High' | 'Medium' | 'Low';

export interface BilingualText {
  th: string;
  en: string;
}

export interface Department {
  th: string;
  en: string;
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

export interface Project {
  _id?: string;
  externalId: number;
  title: BilingualText;
  department: Department;
  budget: number; // in THB
  publishDate: string; // ISO date string
  deadline: string; // ISO date string
  category: ProjectCategory;
  procurementType: string;
  description: BilingualText;
  scope: { th: string[]; en: string[] };
  qualifications: { th: string[]; en: string[] };
  historicalAvg: number;
  sourceDocument: string;
  sourceUrl?: string;
  documentUrl?: string;
  processedDate: string;
  aiConfidence: AiConfidence;
  aiClassificationModel?: string;
  timeline?: TimelineEvent[];
  budgetBreakdown?: BudgetBreakdownItem[];
  highlightedQualifications?: HighlightedQualification[];
  documentSections?: DocumentSection[];
  aiMetadata?: AiMetadata;
  contactInfo?: ContactInfo;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectFilters {
  search?: string;
  department?: string;
  category?: ProjectCategory;
  budget?: 'under5m' | '5to10' | '10to20' | 'above20m';
  deadline?: 'within7' | 'within30' | 'moreThan30';
}

