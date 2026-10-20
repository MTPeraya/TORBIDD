'use client';

// =============================================================================
// components/procurement-filters/DeadlineFilter.tsx
// Priority Submission Deadline Filter Component with urgency indicators & counts
// =============================================================================

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export interface DeadlineCounts {
  within7?: number;
  within30?: number;
  moreThan30?: number;
  total?: number;
}

interface DeadlineFilterProps {
  selectedDeadline: string;
  onChange: (deadline: string) => void;
  deadlineCounts?: DeadlineCounts;
  id?: string;
}

export function DeadlineFilter({
  selectedDeadline,
  onChange,
  deadlineCounts,
  id = 'deadline-filter',
}: DeadlineFilterProps) {
  const { language, L } = useLanguage();

  const options = [
    {
      id: '',
      label: L('allDeadlines'),
      icon: '🌐',
      count: deadlineCounts?.total,
      isUrgent: false,
    },
    {
      id: 'within7',
      label: language === 'th' ? 'ภายใน 7 วัน (ด่วนมาก)' : 'Within 7 Days (Urgent)',
      icon: '⏳',
      count: deadlineCounts?.within7,
      isUrgent: true,
    },
    {
      id: 'within30',
      label: L('within30days'),
      icon: '📅',
      count: deadlineCounts?.within30,
      isUrgent: false,
    },
    {
      id: 'moreThan30',
      label: L('moreThan30'),
      icon: '🗓️',
      count: deadlineCounts?.moreThan30,
      isUrgent: false,
    },
  ];

  return (
    <div className="filter-group deadline-filter-group" id={id}>
      <div className="filter-group-header">
        <label className="filter-group-label" htmlFor={`${id}-select`}>
          <span>⏳ {L('deadline')}</span>
          <span className="filter-priority-badge">{language === 'th' ? 'สำคัญสุด' : 'Priority'}</span>
        </label>
        {selectedDeadline && (
          <button
            type="button"
            className="filter-group-reset-btn"
            onClick={() => onChange('')}
            aria-label={L('clearFilters')}
          >
            {L('clearFilters')}
          </button>
        )}
      </div>

      <div className="deadline-options-list" role="radiogroup" aria-label={L('deadline')}>
        {options.map((opt) => {
          const isSelected = selectedDeadline === opt.id;
          return (
            <button
              key={opt.id || 'all'}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`deadline-pill-btn ${isSelected ? 'active' : ''} ${
                opt.isUrgent ? 'urgent' : ''
              }`}
              onClick={() => onChange(opt.id)}
            >
              <div className="deadline-pill-left">
                <span className="deadline-pill-icon">{opt.icon}</span>
                <span className="deadline-pill-title">{opt.label}</span>
              </div>
              {typeof opt.count === 'number' && (
                <span className={`deadline-pill-count ${opt.isUrgent && (opt.count > 0) ? 'urgent-count' : ''}`}>
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
