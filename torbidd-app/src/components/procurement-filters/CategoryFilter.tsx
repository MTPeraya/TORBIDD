'use client';

// =============================================================================
// components/procurement-filters/CategoryFilter.tsx
// (Supports Issue #147: Implement Software Category Filter)
// =============================================================================

import React from 'react';
import { SoftwareCategory, SOFTWARE_CATEGORIES } from '@/types/procurement-category';
import { useLanguage } from '@/contexts/LanguageContext';
import { CATEGORY_LABELS } from '@/lib/labels';

interface CategoryFilterProps {
  selectedCategories: SoftwareCategory[];
  onChange: (categories: SoftwareCategory[]) => void;
  onClear?: () => void;
  isMultiSelect?: boolean;
  categoryCounts?: Record<string, number>;
  id?: string;
}

export function CategoryFilter({
  selectedCategories,
  onChange,
  onClear,
  isMultiSelect = true,
  categoryCounts,
  id = 'category-filter',
}: CategoryFilterProps) {
  const { language, L } = useLanguage();

  const handleToggle = (catId: SoftwareCategory) => {
    if (isMultiSelect) {
      if (selectedCategories.includes(catId)) {
        onChange(selectedCategories.filter((c) => c !== catId));
      } else {
        onChange([...selectedCategories, catId]);
      }
    } else {
      if (selectedCategories.includes(catId)) {
        onChange([]);
      } else {
        onChange([catId]);
      }
    }
  };

  const handleClear = () => {
    onChange([]);
    onClear?.();
  };

  return (
    <div className="filter-group category-filter-group" id={id}>
      <div className="filter-group-header">
        <label className="filter-group-label">{L('filterSoftwareCategory')}</label>
        {selectedCategories.length > 0 && (
          <button
            type="button"
            className="filter-group-reset-btn"
            onClick={handleClear}
            aria-label="Clear category filter"
          >
            {L('clearFilters')}
          </button>
        )}
      </div>

      <div className="category-options-list" role="group" aria-label={L('filterSoftwareCategory')}>
        {SOFTWARE_CATEGORIES.map((cat) => {
          const isSelected = selectedCategories.includes(cat.id);
          const count = categoryCounts ? categoryCounts[cat.id] : undefined;
          const localizedName = CATEGORY_LABELS[language][cat.id] || (language === 'th' ? cat.name.th : cat.name.en);

          return (
            <button
              key={cat.id}
              type="button"
              className={`category-pill-btn ${isSelected ? 'active' : ''}`}
              onClick={() => handleToggle(cat.id)}
              aria-pressed={isSelected}
              data-category={cat.id}
            >
              <span className="category-pill-indicator">
                {isSelected ? '✓' : ''}
              </span>
              <span className="category-pill-text">{localizedName}</span>
              {typeof count === 'number' && (
                <span className="category-pill-count">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
