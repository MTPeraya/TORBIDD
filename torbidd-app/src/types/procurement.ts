// =============================================================================
// types/procurement.ts - Unified Procurement Types & Query Contracts
// (Supports Issues #150, #154, #155, #156)
// =============================================================================

import { Project, ProjectCategory } from './project';
import { SoftwareCategory } from './procurement-category';

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
