'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

interface EligibilityChecklistProps {
  qualifications: string[];
  checkedIndices: number[];
  onToggle: (index: number) => void;
}

export function EligibilityChecklist({
  qualifications,
  checkedIndices,
  onToggle,
}: EligibilityChecklistProps) {
  const { L } = useLanguage();

  const totalCount = qualifications.length;
  const checkedCount = checkedIndices.length;
  const matchPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  let matchStatusText = '';
  let matchStatusClass = '';
  if (matchPct === 100) {
    matchStatusText = L('goEligible');
    matchStatusClass = 'green';
  } else if (matchPct >= 60) {
    matchStatusText = L('goReview');
    matchStatusClass = 'amber';
  } else {
    matchStatusText = L('noGo');
    matchStatusClass = 'red';
  }

  return (
    <div className="detail-card qualifications-card">
      <div className="qualifications-badge">
        {ICONS.shield}
        <span>{L('bidderQualifications')}</span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 16, fontWeight: 500 }}>
        💡 {L('checklistTitle')}
      </p>

      <div className="eligibility-checklist">
        {qualifications.map((q, idx) => {
          const isChecked = checkedIndices.includes(idx);
          return (
            <div
              key={idx}
              className={`checklist-item ${isChecked ? 'checked' : ''}`}
              onClick={() => onToggle(idx)}
              role="checkbox"
              aria-checked={isChecked}
              tabIndex={0}
            >
              <div className="checklist-checkbox">{ICONS.check}</div>
              <div className="checklist-text">{q}</div>
            </div>
          );
        })}
      </div>

      {/* Gauge Panel */}
      <div className="gauge-wrapper">
        <div className="gauge-header-text">{L('gaugeTitle')}</div>
        <div className="gauge-container">
          <div
            className={`gauge-fill ${matchPct === 100 ? 'high' : matchPct >= 60 ? 'mid' : ''}`}
            style={{ width: `${matchPct}%` }}
          />
        </div>
        <div className="gauge-status-row">
          <div className="gauge-score">{matchPct}%</div>
          <div className={`gauge-badge ${matchStatusClass}`}>{matchStatusText}</div>
        </div>
      </div>
    </div>
  );
}
