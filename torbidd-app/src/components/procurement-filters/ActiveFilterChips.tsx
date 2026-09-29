'use client';

// =============================================================================
// components/procurement-filters/ActiveFilterChips.tsx
// (Supports Issues #152, #155, #156)
// =============================================================================

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { SoftwareCategory } from '@/types/procurement-category';
import { CATEGORY_LABELS } from '@/lib/labels';
import { formatNumber } from '@/lib/utils';

export interface ActiveFiltersState {
  search?: string;
  categories: SoftwareCategory[];
  agencies: string[];
  minBudget: number | null;
  maxBudget: number | null;
  budgetPreset: string;
  deadline?: string;
}

interface ActiveFilterChipsProps {
  filters: ActiveFiltersState;
  onRemoveSearch: () => void;
  onRemoveCategory: (category: SoftwareCategory) => void;
  onRemoveAgency: (agency: string) => void;
  onRemoveBudget: () => void;
  onRemoveDeadline: () => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({
  filters,
  onRemoveSearch,
  onRemoveCategory,
  onRemoveAgency,
  onRemoveBudget,
  onRemoveDeadline,
  onClearAll,
}: ActiveFilterChipsProps) {
  const { language, L } = useLanguage();

  const hasSearch = Boolean(filters.search && filters.search.trim().length > 0);
  const hasCategories = filters.categories && filters.categories.length > 0;
  const hasAgencies = filters.agencies && filters.agencies.length > 0;
  const hasBudget =
    filters.minBudget !== null ||
    filters.maxBudget !== null ||
    Boolean(filters.budgetPreset);
  const hasDeadline = Boolean(filters.deadline);

  const totalActiveCount =
    (hasSearch ? 1 : 0) +
    (filters.categories ? filters.categories.length : 0) +
    (filters.agencies ? filters.agencies.length : 0) +
    (hasBudget ? 1 : 0) +
    (hasDeadline ? 1 : 0);

  if (totalActiveCount === 0) {
    return null;
  }

  // Format budget label
  let budgetLabel = '';
  if (filters.budgetPreset) {
    switch (filters.budgetPreset) {
      case 'under5m':
        budgetLabel = L('under5m');
        break;
      case '5to10':
        budgetLabel = L('range5to10');
        break;
      case '10to20':
        budgetLabel = L('range10to20');
        break;
      case 'above20m':
        budgetLabel = L('above20m');
        break;
    }
  } else if (filters.minBudget !== null && filters.maxBudget !== null) {
    budgetLabel = `฿${formatNumber(filters.minBudget)} – ฿${formatNumber(filters.maxBudget)}`;
  } else if (filters.minBudget !== null) {
    budgetLabel = `≥ ฿${formatNumber(filters.minBudget)}`;
  } else if (filters.maxBudget !== null) {
    budgetLabel = `≤ ฿${formatNumber(filters.maxBudget)}`;
  }

  // Format deadline label
  let deadlineLabel = '';
  if (filters.deadline === 'within7') deadlineLabel = L('within7days');
  else if (filters.deadline === 'within30') deadlineLabel = L('within30days');
  else if (filters.deadline === 'moreThan30') deadlineLabel = L('moreThan30');

  return (
    <div className="active-filters-bar" role="region" aria-label={L('activeFilters')}>
      <div className="active-filters-heading">
        <span className="active-filters-title">{L('activeFilters')}:</span>
      </div>

      <div className="active-filter-chips-list">
        {/* Search keyword chip */}
        {hasSearch && (
          <span className="active-filter-chip chip-search">
            <span className="chip-type">{language === 'th' ? 'คำค้นหา:' : 'Keyword:'}</span>
            <span className="chip-value">"{filters.search}"</span>
            <button
              type="button"
              className="chip-remove-btn"
              onClick={onRemoveSearch}
              aria-label={`Remove search filter "${filters.search}"`}
            >
              ×
            </button>
          </span>
        )}

        {/* Category chips */}
        {filters.categories.map((cat) => (
          <span key={cat} className="active-filter-chip chip-category">
            <span className="chip-type">{language === 'th' ? 'ประเภท:' : 'Category:'}</span>
            <span className="chip-value">{CATEGORY_LABELS[language][cat] || cat}</span>
            <button
              type="button"
              className="chip-remove-btn"
              onClick={() => onRemoveCategory(cat)}
              aria-label={`Remove category filter "${cat}"`}
            >
              ×
            </button>
          </span>
        ))}

        {/* Agency chips */}
        {filters.agencies.map((agency) => (
          <span key={agency} className="active-filter-chip chip-agency">
            <span className="chip-type">{language === 'th' ? 'หน่วยงาน:' : 'Agency:'}</span>
            <span className="chip-value">{agency}</span>
            <button
              type="button"
              className="chip-remove-btn"
              onClick={() => onRemoveAgency(agency)}
              aria-label={`Remove agency filter "${agency}"`}
            >
              ×
            </button>
          </span>
        ))}

        {/* Budget chip */}
        {hasBudget && budgetLabel && (
          <span className="active-filter-chip chip-budget">
            <span className="chip-type">{language === 'th' ? 'งบประมาณ:' : 'Budget:'}</span>
            <span className="chip-value">{budgetLabel}</span>
            <button
              type="button"
              className="chip-remove-btn"
              onClick={onRemoveBudget}
              aria-label="Remove budget filter"
            >
              ×
            </button>
          </span>
        )}

        {/* Deadline chip */}
        {hasDeadline && deadlineLabel && (
          <span className="active-filter-chip chip-deadline">
            <span className="chip-type">{language === 'th' ? 'กำหนดส่ง:' : 'Deadline:'}</span>
            <span className="chip-value">{deadlineLabel}</span>
            <button
              type="button"
              className="chip-remove-btn"
              onClick={onRemoveDeadline}
              aria-label="Remove deadline filter"
            >
              ×
            </button>
          </span>
        )}

        {/* Clear All button */}
        <button
          type="button"
          className="clear-all-filters-btn"
          onClick={onClearAll}
          aria-label={L('clearAll')}
        >
          {L('clearAll')} ({totalActiveCount})
        </button>
      </div>
    </div>
  );
}
