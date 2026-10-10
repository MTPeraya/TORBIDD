// =============================================================================
// services/procurement-filter.ts - Procurement Filtering Service
// (Supports Issues #147, #149, #150, #155)
// =============================================================================

import { Project } from '@/types/project';
import { ProcurementFilters } from '@/types/procurement';
import { matchesAgency, BANGKOK_AGENCIES } from '@/types/agency';
import { daysUntil } from '@/lib/utils';

/**
 * Filter procurements by software category (supports single or multiple categories).
 * If no categories provided or empty list, returns original list.
 */
export function filterByCategory(
  projects: Project[],
  categories?: (string | null | undefined)[] | string | null,
): Project[] {
  if (!categories) return projects;

  const rawArray = Array.isArray(categories) ? categories : [categories];
  const validCategories = rawArray
    .flatMap((c) => (typeof c === 'string' ? c.split(',') : []))
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);

  if (validCategories.length === 0) return projects;

  return projects.filter((p) => {
    if (!p.category) return false;
    const catLower = p.category.toLowerCase().trim();
    return validCategories.includes(catLower);
  });
}

/**
 * Filter procurements by government agency / department.
 * Supports matching by Thai name, English name, agency ID, or agency code.
 */
export function filterByAgency(
  projects: Project[],
  agencies?: (string | null | undefined)[] | string | null,
): Project[] {
  if (!agencies) return projects;

  const rawArray = Array.isArray(agencies) ? agencies : [agencies];
  const validAgencies = rawArray
    .flatMap((a) => (typeof a === 'string' ? a.split(',') : []))
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  if (validAgencies.length === 0) return projects;

  // Resolve agency objects for candidate IDs (e.g. 'dept-strategy' -> SED)
  const resolvedTargets: { th: string; en: string }[] = [];
  for (const ag of validAgencies) {
    const known = BANGKOK_AGENCIES.find(
      (k) => k.id.toLowerCase() === ag.toLowerCase() || (k.code && k.code.toLowerCase() === ag.toLowerCase()),
    );
    if (known) {
      resolvedTargets.push({ th: known.name.th, en: known.name.en });
    } else {
      resolvedTargets.push({ th: ag, en: ag });
    }
  }

  return projects.filter((p) => {
    if (!p.department) return false;

    return resolvedTargets.some((target) => {
      // Direct string matching
      if (matchesAgency(p.department, target.th) || matchesAgency(p.department, target.en)) {
        return true;
      }
      return false;
    });
  });
}

/**
 * Filter procurements by budget range.
 * Handles:
 * - minBudget
 * - maxBudget
 * - budgetPreset ('under5m', '5to10', '10to20', 'above20m')
 * - Safe handling of missing/unannounced/null/NaN budgets without throwing errors.
 */
export function filterByBudget(
  projects: Project[],
  options: {
    minBudget?: number | null;
    maxBudget?: number | null;
    budgetPreset?: string | null;
  } = {},
): Project[] {
  const { minBudget, maxBudget, budgetPreset } = options;

  let filtered = projects;

  // Handle Preset if provided
  if (budgetPreset) {
    filtered = filtered.filter((p) => {
      const b = typeof p.budget === 'number' && !isNaN(p.budget) ? p.budget : 0;
      switch (budgetPreset) {
        case 'under5m':
          return b < 5_000_000;
        case '5to10':
          return b >= 5_000_000 && b <= 10_000_000;
        case '10to20':
          return b >= 10_000_000 && b <= 20_000_000;
        case 'above20m':
          return b > 20_000_000;
        default:
          return true;
      }
    });
  }

  // Handle explicit numeric Min / Max
  const hasMin = minBudget !== undefined && minBudget !== null && !isNaN(minBudget);
  const hasMax = maxBudget !== undefined && maxBudget !== null && !isNaN(maxBudget);

  if (hasMin || hasMax) {
    filtered = filtered.filter((p) => {
      const b = typeof p.budget === 'number' && !isNaN(p.budget) ? p.budget : 0;

      if (hasMin && b < (minBudget as number)) {
        return false;
      }
      if (hasMax && b > (maxBudget as number)) {
        return false;
      }
      return true;
    });
  }

  return filtered;
}

/**
 * Filter procurements by search query (title, department, category, description).
 */
export function filterBySearch(projects: Project[], query?: string | null): Project[] {
  if (!query || !query.trim()) return projects;

  const q = query.trim().toLowerCase();

  return projects.filter((p) => {
    const titleTh = p.title?.th?.toLowerCase() || '';
    const titleEn = p.title?.en?.toLowerCase() || '';
    const deptTh = p.department?.th?.toLowerCase() || '';
    const deptEn = p.department?.en?.toLowerCase() || '';
    const cat = p.category?.toLowerCase() || '';
    const descTh = p.description?.th?.toLowerCase() || '';
    const descEn = p.description?.en?.toLowerCase() || '';
    const idStr = String(p.externalId || '');

    return (
      titleTh.includes(q) ||
      titleEn.includes(q) ||
      deptTh.includes(q) ||
      deptEn.includes(q) ||
      cat.includes(q) ||
      descTh.includes(q) ||
      descEn.includes(q) ||
      idStr.includes(q)
    );
  });
}

/**
 * Determines whether a procurement contract is already awarded.
 */
export function isContractAwarded(project: Project): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = project as any;
  const rawStatus = String(p.status || '');
  const winner = p.winnerName || p.winner_name;
  return Boolean(
    winner ||
    rawStatus === 'จัดทำสัญญาแล้ว' ||
    rawStatus === 'มีผู้ชนะ/ทำสัญญาแล้ว' ||
    rawStatus.includes('จัดทำสัญญาแล้ว') ||
    rawStatus.includes('ได้ผู้ชนะ') ||
    (p.contractPrice && p.contractPrice > 0 && (p.contractDate || p.contractFinishDate))
  );
}

/**
 * Filter procurements by submission deadline.
 * Excludes contracts that are already awarded as their bidding is closed.
 */
export function filterByDeadline(projects: Project[], deadline?: string | null): Project[] {
  if (!deadline) return projects;

  return projects.filter((p) => {
    // Contract already awarded should not show when filtering by deadline
    if (isContractAwarded(p)) return false;

    if (!p.deadline) return false;
    const d = daysUntil(p.deadline);
    switch (deadline) {
      case 'within7':
        return d >= 0 && d <= 7;
      case 'within30':
        return d >= 0 && d <= 30;
      case 'moreThan30':
        return d > 30;
      default:
        return true;
    }
  });
}

/**
 * Apply combined search & all procurement filters harmoniously.
 * (Supports Issue #155)
 */
export function applyProcurementFilters(
  projects: Project[],
  filters: ProcurementFilters = {},
): Project[] {
  let result = projects;

  // If any filter is applied, exclude contracts that are already awarded
  const isFiltering = Boolean(
    filters.deadline ||
    filters.search ||
    (filters.categories && filters.categories.length > 0) ||
    (filters.agencies && filters.agencies.length > 0) ||
    filters.department ||
    filters.minBudget !== undefined ||
    filters.maxBudget !== undefined ||
    filters.budgetPreset ||
    filters.isSoftwareRelated !== undefined
  );

  if (isFiltering) {
    result = result.filter((p) => !isContractAwarded(p));
  }

  // 1. Keyword search
  if (filters.search) {
    result = filterBySearch(result, filters.search);
  }

  // 2. Software categories (supports multiple categories)
  if (filters.categories && filters.categories.length > 0) {
    result = filterByCategory(result, filters.categories);
  }

  // 3. Government agencies / departments (supports multiple agencies)
  const agencyList: string[] = [];
  if (filters.agencies && filters.agencies.length > 0) {
    agencyList.push(...filters.agencies);
  }
  if (filters.department && !agencyList.includes(filters.department)) {
    agencyList.push(filters.department);
  }
  if (agencyList.length > 0) {
    result = filterByAgency(result, agencyList);
  }

  // 4. Budget filter (min, max, presets)
  if (
    filters.minBudget !== undefined ||
    filters.maxBudget !== undefined ||
    filters.budgetPreset
  ) {
    result = filterByBudget(result, {
      minBudget: filters.minBudget,
      maxBudget: filters.maxBudget,
      budgetPreset: filters.budgetPreset,
    });
  }

  // 5. Deadline filter
  if (filters.deadline) {
    result = filterByDeadline(result, filters.deadline);
  }

  // 6. Software-related filter (UC-4 / UC-10)
  if (filters.isSoftwareRelated !== undefined) {
    result = result.filter((p) => Boolean(p.isSoftwareRelated) === filters.isSoftwareRelated);
  }

  return result;
}
