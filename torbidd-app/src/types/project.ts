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
  processedDate: string;
  aiConfidence: AiConfidence;
  aiClassificationModel?: string;
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
