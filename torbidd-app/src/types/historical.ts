// =============================================================================
// Types: Historical Project
// =============================================================================

import { BilingualText, Department, ProjectCategory } from './project';

export interface HistoricalProject {
  _id?: string;
  title: BilingualText;
  department: Department;
  year: number;
  category: ProjectCategory;
  budget: number;
  createdAt?: string;
}

export interface HistoricalFilters {
  category?: ProjectCategory;
  department?: string;
  year?: number;
}
