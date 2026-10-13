'use client';

// =============================================================================
// components/procurement-filters/ProcurementFilterPanel.tsx
// (Supports Issue #152: Procurement Filter UI)
// =============================================================================

import React from 'react';
import { SoftwareCategory } from '@/types/procurement-category';
import { DeadlineFilter, DeadlineCounts } from './DeadlineFilter';
import { CategoryFilter } from './CategoryFilter';
import { AgencyFilter } from './AgencyFilter';
import { BudgetFilter } from './BudgetFilter';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProcurementFilterPanelProps {
  selectedCategories: SoftwareCategory[];
  onCategoryChange: (categories: SoftwareCategory[]) => void;
  selectedAgencies: string[];
  onAgencyChange: (agencies: string[]) => void;
  minBudget: number | null;
  maxBudget: number | null;
  budgetPreset: string;
  onBudgetChange: (options: {
    minBudget: number | null;
    maxBudget: number | null;
    budgetPreset: string;
  }) => void;
  selectedDeadline: string;
  onDeadlineChange: (deadline: string) => void;
  onClearAll: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  categoryCounts?: Record<string, number>;
  availableAgencies?: { th: string; en: string }[];
  deadlineCounts?: DeadlineCounts;
}

export function ProcurementFilterPanel({
  selectedCategories,
  onCategoryChange,
  selectedAgencies,
  onAgencyChange,
  minBudget,
  maxBudget,
  budgetPreset,
  onBudgetChange,
  selectedDeadline,
  onDeadlineChange,
  onClearAll,
  isOpenMobile = false,
  onCloseMobile,
  categoryCounts,
  availableAgencies,
  deadlineCounts,
}: ProcurementFilterPanelProps) {
  const { L } = useLanguage();

  const hasAnyFilter =
    selectedCategories.length > 0 ||
    selectedAgencies.length > 0 ||
    minBudget !== null ||
    maxBudget !== null ||
    Boolean(budgetPreset) ||
    Boolean(selectedDeadline);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="filter-panel-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`procurement-filter-sidebar ${isOpenMobile ? 'mobile-open' : ''}`}
        aria-label={L('filterDrawerTitle')}
      >
        <div className="filter-sidebar-header">
          <div className="filter-sidebar-title-area">
            <h2 className="filter-sidebar-title">{L('filterDrawerTitle')}</h2>
            <p className="filter-sidebar-subtitle">{L('filterDrawerSub')}</p>
          </div>

          <div className="filter-sidebar-actions">
            {hasAnyFilter && (
              <button
                type="button"
                className="filter-panel-clear-all"
                onClick={onClearAll}
                id="filter-panel-clear-all"
              >
                {L('clearAll')}
              </button>
            )}
            {onCloseMobile && (
              <button
                type="button"
                className="filter-sidebar-close-btn"
                onClick={onCloseMobile}
                aria-label="Close filters"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="filter-sidebar-body">
          {/* 1. Priority Submission Deadline Filter (Top Priority for Bidders) */}
          <DeadlineFilter
            selectedDeadline={selectedDeadline}
            onChange={onDeadlineChange}
            deadlineCounts={deadlineCounts}
          />

          <hr className="filter-divider" />

          {/* 2. Software Category Filter (Issue #147) */}
          <CategoryFilter
            selectedCategories={selectedCategories}
            onChange={onCategoryChange}
            categoryCounts={categoryCounts}
          />

          <hr className="filter-divider" />

          {/* 3. Government Agency Filter (Issue #149) */}
          <AgencyFilter
            selectedAgencies={selectedAgencies}
            onChange={onAgencyChange}
            availableAgencies={availableAgencies}
          />

          <hr className="filter-divider" />

          {/* 4. Budget Range Filter (Issue #150) */}
          <BudgetFilter
            minBudget={minBudget}
            maxBudget={maxBudget}
            budgetPreset={budgetPreset}
            onChange={onBudgetChange}
          />
        </div>

        {isOpenMobile && onCloseMobile && (
          <div className="filter-sidebar-footer-mobile">
            <button
              type="button"
              className="filter-mobile-apply-btn"
              onClick={onCloseMobile}
            >
              {L('applyFilters')}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
