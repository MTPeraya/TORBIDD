'use client';

import React from 'react';
import { HighlightedQualification } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

interface EligibilityChecklistProps {
  qualifications: string[];
  checkedIndices: number[];
  onToggle: (index: number) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  highlightedQualifications?: HighlightedQualification[];
}

export function EligibilityChecklist({
  qualifications,
  checkedIndices,
  onToggle,
  onSelectAll,
  onClearAll,
  highlightedQualifications,
}: EligibilityChecklistProps) {
  const { language, L, getLocalized } = useLanguage();

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
      <div className="qualifications-header-row">
        <div className="qualifications-badge">
          {ICONS.shield}
          <span>{L('bidderQualifications')}</span>
        </div>

        {/* Quick check/clear tools */}
        <div className="checklist-tools">
          {onSelectAll && (
            <button
              type="button"
              className="checklist-tool-btn"
              onClick={onSelectAll}
              title={L('selectAllChecks')}
            >
              {L('selectAllChecks')}
            </button>
          )}
          {onClearAll && (
            <button
              type="button"
              className="checklist-tool-btn"
              onClick={onClearAll}
              title={L('clearAllChecks')}
            >
              {L('clearAllChecks')}
            </button>
          )}
        </div>
      </div>

      {/* Critical Mandatory Qualification Highlight Box (DESIGN.md Section 8) */}
      {highlightedQualifications && highlightedQualifications.length > 0 && (
        <div className="critical-qualifications-banner">
          <div className="critical-qual-badge">
            {ICONS.alertTriangle}
            <span>{L('criticalQualification')}</span>
          </div>
          <p className="critical-qual-sub">{L('criticalQualNotice')}</p>
          <div className="critical-qual-items">
            {highlightedQualifications
              .filter((q) => q.type === 'critical')
              .map((q, idx) => (
                <div key={idx} className="critical-qual-item">
                  <span className="critical-item-tag">{L('mandatoryRequirement')}</span>
                  <div className="critical-item-content">
                    <strong className="critical-item-title">
                      {getLocalized(q.title) as string}
                    </strong>
                    <p className="critical-item-desc">
                      {getLocalized(q.description) as string}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 16, fontWeight: 500 }}>
        💡 {L('checklistTitle')}
      </p>

      {/* Interactive Checklist */}
      <div className="eligibility-checklist">
        {qualifications.map((q, idx) => {
          const isChecked = checkedIndices.includes(idx);
          return (
            <div
              key={idx}
              className={`checklist-item ${isChecked ? 'checked' : ''}`}
              onClick={() => onToggle(idx)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onToggle(idx);
                }
              }}
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

      {/* Gauge & Assessment Score Panel */}
      <div className="gauge-wrapper">
        <div className="gauge-header-text">{L('gaugeTitle')}</div>
        <div className="gauge-container">
          <div
            className={`gauge-fill ${matchPct === 100 ? 'high' : matchPct >= 60 ? 'mid' : ''}`}
            style={{ width: `${matchPct}%` }}
          />
        </div>
        <div className="gauge-status-row">
          <div className="gauge-score">
            {matchPct}% ({checkedCount}/{totalCount} {language === 'th' ? 'ข้อ' : 'items'})
          </div>
          <div className={`gauge-badge ${matchStatusClass}`}>{matchStatusText}</div>
        </div>
      </div>
    </div>
  );
}
