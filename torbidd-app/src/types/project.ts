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

export interface ExtractedQualificationItem {
  id: string;
  description: BilingualText;
  category: 'Legal' | 'Financial' | 'Experience' | 'Technical';
  threshold?: string;
  mandatory: boolean;
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
  summary?: BilingualText; // Issue #87: TOR Executive Summary
  scope: { th: string[]; en: string[] };
  qualifications: { th: string[]; en: string[] };
  requiredTechnologies?: string[]; // Issue #89: Required Tech Stack tags
  technicalRequirements?: { th: string[]; en: string[] }; // Issue #89: Technical Requirements
  extractedQualifications?: ExtractedQualificationItem[]; // Issue #90: Detailed Qualifications
  historicalAvg: number;
  sourceDocument: string;
  processedDate: string;
  aiConfidence: AiConfidence;
  aiClassificationModel?: string;
  extractionStatus?: 'PENDING' | 'EXTRACTED' | 'FAILED'; // Issue #91: Auto extraction status
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
