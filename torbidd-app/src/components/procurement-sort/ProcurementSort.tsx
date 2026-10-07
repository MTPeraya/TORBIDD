'use client';

// =============================================================================
// components/procurement-sort/ProcurementSort.tsx
// (Supports Issue #154: Implement Publication Date Sorting)
// =============================================================================

import React from 'react';
import { ProcurementSortOption } from '@/types/procurement';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProcurementSortProps {
  value: ProcurementSortOption;
  onChange: (sort: ProcurementSortOption) => void;
  id?: string;
}

export function ProcurementSort({
  value = 'publishDate_desc',
  onChange,
  id = 'procurement-sort-select',
}: ProcurementSortProps) {
  const { L } = useLanguage();

  return (
    <div className="procurement-sort-control">
      <label htmlFor={id} className="procurement-sort-label">
        {L('sortBy')}:
      </label>
      <select
        id={id}
        className="procurement-sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as ProcurementSortOption)}
        aria-label={L('sortBy')}
      >
        <option value="deadline_asc">⏳ {L('sortDeadlineSoon')}</option>
        <option value="publishDate_desc">{L('sortNewest')}</option>
        <option value="publishDate_asc">{L('sortOldest')}</option>
        <option value="deadline_desc">🗓️ {L('sortDeadlineLate')}</option>
        <option value="budget_desc">{L('sortBudgetHigh')}</option>
        <option value="budget_asc">{L('sortBudgetLow')}</option>
      </select>
    </div>
  );
}
