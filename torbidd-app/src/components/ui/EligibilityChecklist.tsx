'use client';

import React from 'react';
import { HighlightedQualification } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { ExtractedQualificationItem } from '@/types/project';

interface EligibilityChecklistProps {
  qualifications: string[];
  structuredQualifications?: ExtractedQualificationItem[];
  checkedIndices: number[];
  onToggle: (index: number) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  highlightedQualifications?: HighlightedQualification[];
}

export function EligibilityChecklist({
  qualifications,
  structuredQualifications,
  checkedIndices,
  onToggle,
  onSelectAll,
  onClearAll,
  highlightedQualifications,
}: EligibilityChecklistProps) {
  const { language, L, getLocalized } = useLanguage();

  const items = structuredQualifications && structuredQualifications.length > 0
    ? structuredQualifications
    : qualifications.map((q, idx) => ({
        id: `qual-${idx}`,
        description: { th: q, en: q },
        category: (idx === 0 ? 'Legal' : idx === 1 ? 'Experience' : 'Technical') as 'Legal' | 'Experience' | 'Technical',
        threshold: undefined,
        mandatory: true,
      }));

  const totalCount = items.length;
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

  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case 'Legal':
        return {
          label: language === 'th' ? '⚖️ กฎหมาย/นิติบุคคล' : '⚖️ Legal Status',
          bg: '#eef2ff',
          color: '#3730a3',
          border: '1px solid #c7d2fe',
        };
      case 'Financial':
        return {
          label: language === 'th' ? '💰 ทุน/การเงิน' : '💰 Financial',
          bg: '#ecfdf5',
          color: '#065f46',
          border: '1px solid #a7f3d0',
        };
      case 'Experience':
        return {
          label: language === 'th' ? '🏆 ผลงานที่ผ่านมา' : '🏆 Past Experience',
          bg: '#fffbeb',
          color: '#92400e',
          border: '1px solid #fde68a',
        };
      case 'Technical':
        return {
          label: language === 'th' ? '🛠️ เทคนิค/มาตรฐาน' : '🛠️ Technical Standard',
          bg: '#f0fdfa',
          color: '#115e59',
          border: '1px solid #99f6e4',
        };
      default:
        return {
          label: language === 'th' ? '📋 คุณสมบัติ' : '📋 Qualification',
          bg: 'var(--gray-100)',
          color: 'var(--gray-700)',
          border: '1px solid var(--gray-200)',
        };
    }
  };

  return (
    <div className="detail-card qualifications-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div className="qualifications-header-row">
        <div className="qualifications-badge">
            {ICONS.shield}
            <span>{L('bidderQualifications')}</span>
        </div>
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
          {language === 'th' ? '🔍 สกัดจาก TOR ด้วย AI' : '🔍 AI Extracted from TOR'}
        </span>
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
        💡 {L('checklistTitle')} ({language === 'th' ? 'คลิกเลือกข้อที่บริษัทท่านผ่านเกณฑ์เพื่อประเมินความพร้อมแบบ Go / No-Go' : 'Click criteria your firm meets for instant Go/No-Go readiness'})
      </p>

      {/* Interactive Checklist */}
      <div className="eligibility-checklist">
        {items.map((item, idx) => {
          const isChecked = checkedIndices.includes(idx);
          const catInfo = getCategoryBadge(item.category);
          const descText = typeof item.description === 'string'
            ? item.description
            : (language === 'th' ? item.description?.th : item.description?.en) || item.description?.th || '';

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
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div className="checklist-checkbox" style={{ marginTop: 2 }}>{ICONS.check}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: catInfo.bg,
                      color: catInfo.color,
                      border: catInfo.border,
                    }}
                  >
                    {catInfo.label}
                  </span>

                  {item.threshold && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                      }}
                    >
                      🎯 {item.threshold}
                    </span>
                  )}

                  {item.mandatory ? (
                    <span style={{ fontSize: 10.5, color: '#dc2626', fontWeight: 600 }}>
                      *{language === 'th' ? 'เกณฑ์บังคับ' : 'Mandatory'}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10.5, color: '#059669', fontWeight: 500 }}>
                      ({language === 'th' ? 'แนะนำ/คะแนนเสริม' : 'Recommended'})
                    </span>
                  )}
                </div>

                <div className="checklist-text" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--gray-900)' }}>
                  {descText}
                </div>
              </div>
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
