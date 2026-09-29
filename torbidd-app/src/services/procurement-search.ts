// =============================================================================
// services/procurement-search.ts - Procurement Search & Sort Service
// (Supports Issues #154, #155, #156)
// =============================================================================

import { Project } from '@/types/project';
import {
  ProcurementFilters,
  ProcurementQueryResult,
  ProcurementSortOption,
} from '@/types/procurement';
import { applyProcurementFilters } from './procurement-filter';

/**
 * Deterministically sort procurements.
 * Ensures stable sorting order across paginated pages by utilizing secondary keys.
 * (Supports Issue #154: Publication Date Sorting)
 */
export function sortProcurements(
  projects: Project[],
  sortBy: ProcurementSortOption | 'newest' | 'oldest' = 'publishDate_desc',
): Project[] {
  const sorted = [...projects];

  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'publishDate_asc':
      case 'oldest': {
        const timeA = new Date(a.publishDate).getTime() || 0;
        const timeB = new Date(b.publishDate).getTime() || 0;
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        // Secondary sort key for deterministic ordering
        return (a.externalId || 0) - (b.externalId || 0);
      }

      case 'budget_desc': {
        const budA = typeof a.budget === 'number' ? a.budget : 0;
        const budB = typeof b.budget === 'number' ? b.budget : 0;
        if (budA !== budB) {
          return budB - budA;
        }
        return (b.externalId || 0) - (a.externalId || 0);
      }

      case 'budget_asc': {
        const budA = typeof a.budget === 'number' ? a.budget : 0;
        const budB = typeof b.budget === 'number' ? b.budget : 0;
        if (budA !== budB) {
          return budA - budB;
        }
        return (a.externalId || 0) - (b.externalId || 0);
      }

      case 'publishDate_desc':
      case 'newest':
      default: {
        const timeA = new Date(a.publishDate).getTime() || 0;
        const timeB = new Date(b.publishDate).getTime() || 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        // Secondary sort key for deterministic ordering
        return (b.externalId || 0) - (a.externalId || 0);
      }
    }
  });

  return sorted;
}

/**
 * Paginate an array of projects with pagination metadata.
 */
export function paginateProcurements(
  items: Project[],
  page = 1,
  limit = 12,
): ProcurementQueryResult {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const startIndex = (safePage - 1) * safeLimit;
  const paginatedItems = items.slice(startIndex, startIndex + safeLimit);

  return {
    items: paginatedItems,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

/**
 * Execute unified combined search, filtering, deterministic sorting, and pagination.
 * (Supports Issues #154, #155, #156)
 */
export function executeProcurementSearch(
  projects: Project[],
  filters: ProcurementFilters = {},
): ProcurementQueryResult {
  // 1. Filter
  const filtered = applyProcurementFilters(projects, filters);

  // 2. Sort (default to publishDate_desc if not provided)
  const sorted = sortProcurements(filtered, filters.sortBy || 'publishDate_desc');

  // 3. Paginate
  const page = filters.page ? Number(filters.page) : 1;
  const limit = filters.limit ? Number(filters.limit) : 12;

  return paginateProcurements(sorted, page, limit);
}
