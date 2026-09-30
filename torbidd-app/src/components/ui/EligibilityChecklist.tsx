'use client';

import React, { useState } from 'react';
import { HighlightedQualification, ExtractedQualificationItem } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { validateAndEnrichQualifications } from '@/services/ai/qualification-validator';

interface EligibilityChecklistProps {
  qualifications: string[];
  structuredQualifications?: ExtractedQualificationItem[];
  checkedIndices: number[];
  onToggle: (index: number) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  highlightedQualifications?: HighlightedQualification[];
  budget?: number;
}

export function EligibilityChecklist({
  qualifications,
  structuredQualifications,
  checkedIndices,
  onToggle,
  onSelectAll,
  onClearAll,
  highlightedQualifications,
  budget = 0,
}: EligibilityChecklistProps) {
  const { language, L, getLocalized } = useLanguage();
  const [filterTab, setFilterTab] = useState<'all' | 'mandatory' | 'optional' | 'restrictive'>('all');

  // Prepare raw items
  const rawItems: ExtractedQualificationItem[] = structuredQualifications && structuredQualifications.length > 0
    ? structuredQualifications
    : qualifications.map((q, idx) => ({
        id: `qual-${idx}`,
        description: { th: q, en: q },
        category: (idx === 0 ? 'Legal' : idx === 1 ? 'Experience' : 'Technical') as 'Legal' | 'Experience' | 'Technical',
        threshold: undefined,
        mandatory: idx !== 2, // 1st & 2nd mandatory, 3rd optional by default
      }));

  // Validate and enrich with explicit criteria values and restrictive risk assessments
  const validationSummary = validateAndEnrichQualifications(rawItems, budget);
  const items = validationSummary.items;

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

  // Filter items based on active tab
  const filteredIndexedItems = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (filterTab === 'mandatory') return item.mandatory;
      if (filterTab === 'optional') return !item.mandatory;
      if (filterTab === 'restrictive') return item.riskAssessment?.isRestrictive;
      return true;
    });

  const mandatoryTotal = items.filter((i) => i.mandatory).length;
  const optionalTotal = items.filter((i) => !i.mandatory).length;
  const restrictiveTotal = items.filter((i) => i.riskAssessment?.isRestrictive).length;

  return (
    <div className="detail-card qualifications-card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div className="qualifications-header-row">
          <div className="qualifications-badge">
            {ICONS.shield}
            <span>
              {language === 'th'
                ? 'การตรวจสอบคุณสมบัติผู้ยื่นข้อเสนอ (Vendor Eligibility & Checklist)'
                : 'Vendor Eligibility & Checklist'}
            </span>
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

      {/* Restrictive Clause Warning Banner (If high-risk clauses found) */}
      {restrictiveTotal > 0 && (
        <div
          style={{
            margin: '12px 0 16px',
            padding: '12px 16px',
            borderRadius: 8,
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#9f1239',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
            <span>⚠️</span>
            <span>
              {language === 'th'
                ? `ตรวจพบ ${restrictiveTotal} ข้อกำหนดที่อาจเข้าข่ายล็อคสเปกหรือจำกัดการแข่งขัน (Restrictive Clauses)`
                : `Detected ${restrictiveTotal} potentially restrictive or anti-competitive qualification clauses`}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: '#be123c', lineHeight: 1.4 }}>
            {language === 'th'
              ? 'ระบบได้วิเคราะห์ตาม พ.ร.บ. การจัดซื้อจัดจ้างฯ พ.ศ. 2560 และหนังสือเวียน ว 214 หากพบเงื่อนไขที่เกินความจำเป็น สามารถยื่นวิจารณ์ร่าง TOR ในช่วงรับฟังคำวิจารณ์ได้'
              : 'Evaluated against Thai Procurement Act B.E. 2560 & Circular W 214. If specifications are disproportionate, you may contest during the public hearing period.'}
          </div>
        </div>
      )}

      {/* Critical Mandatory Qualification Highlight Box */}
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

      {/* Filter Tabs: All | Mandatory | Optional | Restrictive */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 12,
          marginBottom: 16,
          borderBottom: '1px solid var(--gray-200)',
          paddingBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: filterTab === 'all' ? 700 : 500,
            border: 'none',
            background: filterTab === 'all' ? '#0284c7' : 'transparent',
            color: filterTab === 'all' ? '#ffffff' : 'var(--gray-700)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {language === 'th' ? `ทั้งหมด (${totalCount})` : `All (${totalCount})`}
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('mandatory')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: filterTab === 'mandatory' ? 700 : 500,
            border: 'none',
            background: filterTab === 'mandatory' ? '#dc2626' : 'transparent',
            color: filterTab === 'mandatory' ? '#ffffff' : 'var(--gray-700)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🔴 {language === 'th' ? `เกณฑ์บังคับ (${mandatoryTotal})` : `Mandatory (${mandatoryTotal})`}
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('optional')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: filterTab === 'optional' ? 700 : 500,
            border: 'none',
            background: filterTab === 'optional' ? '#059669' : 'transparent',
            color: filterTab === 'optional' ? '#ffffff' : 'var(--gray-700)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🟢 {language === 'th' ? `เกณฑ์เสริม/คะแนนพิเศษ (${optionalTotal})` : `Optional (${optionalTotal})`}
        </button>

        {restrictiveTotal > 0 && (
          <button
            type="button"
            onClick={() => setFilterTab('restrictive')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: filterTab === 'restrictive' ? 700 : 600,
              border: 'none',
              background: filterTab === 'restrictive' ? '#e11d48' : '#ffe4e6',
              color: filterTab === 'restrictive' ? '#ffffff' : '#be123c',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ⚠️ {language === 'th' ? `ข้อกำหนดเสี่ยงล็อคสเปก (${restrictiveTotal})` : `Restrictive Clauses (${restrictiveTotal})`}
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 16, fontWeight: 500 }}>
        💡 {L('checklistTitle')} ({language === 'th' ? 'คลิกเลือกข้อที่บริษัทท่านผ่านเกณฑ์เพื่อประเมินความพร้อมแบบ Go / No-Go' : 'Click criteria your firm meets for instant Go/No-Go readiness'})
      </p>

      {/* Interactive Checklist */}
      <div className="eligibility-checklist">
        {filteredIndexedItems.map(({ item, originalIndex }) => {
          const isChecked = checkedIndices.includes(originalIndex);
          const catInfo = getCategoryBadge(item.category);
          const descText = typeof item.description === 'string'
            ? item.description
            : (language === 'th' ? item.description?.th : item.description?.en) || item.description?.th || '';

          const isRestrictive = item.riskAssessment?.isRestrictive;
          const riskLevel = item.riskAssessment?.riskLevel;

          return (
            <div
              key={originalIndex}
              className={`checklist-item ${isChecked ? 'checked' : ''}`}
              onClick={() => onToggle(originalIndex)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onToggle(originalIndex);
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
                borderLeft: isRestrictive
                  ? '4px solid #e11d48'
                  : item.mandatory
                  ? '4px solid #dc2626'
                  : '4px solid #10b981',
              }}
            >
              <div className="checklist-checkbox" style={{ marginTop: 2 }}>{ICONS.check}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Category Badge */}
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

                  {/* Mandatory vs Optional Tag */}
                  {item.mandatory ? (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: '#fee2e2',
                        color: '#991b1b',
                        fontWeight: 700,
                        border: '1px solid #fecaca',
                      }}
                    >
                      * {language === 'th' ? 'เกณฑ์บังคับ (Mandatory)' : 'Mandatory Requirement'}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: '#dcfce7',
                        color: '#166534',
                        fontWeight: 600,
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      {language === 'th' ? 'เกณฑ์แนะนำ/เสริม (Optional)' : 'Optional / Bonus'}
                    </span>
                  )}

                  {/* Explicit Criteria Value */}
                  {item.criteriaValue && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>🎯</span>
                      <span>
                        {item.criteriaValue.key}: {String(item.criteriaValue.value)}
                      </span>
                    </span>
                  )}

                  {/* Restrictive Clause Risk Tag */}
                  {isRestrictive && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: riskLevel === 'High' ? '#ffe4e6' : '#fff7ed',
                        color: riskLevel === 'High' ? '#be123c' : '#c2410c',
                        border: riskLevel === 'High' ? '1px solid #fda4af' : '1px solid #fed7aa',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>⚠️</span>
                      <span>
                        {language === 'th'
                          ? `เสี่ยงล็อคสเปก (${riskLevel} Risk)`
                          : `Restrictive Clause (${riskLevel} Risk)`}
                      </span>
                    </span>
                  )}
                </div>

                {/* Qualification Description Text */}
                <div className="checklist-text" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--gray-900)' }}>
                  {descText}
                </div>

                {/* Restrictive Clause Details Expandable Box */}
                {isRestrictive && item.riskAssessment && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: '8px 12px',
                      background: '#fff1f2',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#9f1239',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      border: '1px dashed #fca5a5',
                    }}
                  >
                    <div>
                      <strong>{language === 'th' ? 'ข้อสังเกต:' : 'Note:'}</strong>{' '}
                      {language === 'th'
                        ? item.riskAssessment.flagReason?.th
                        : item.riskAssessment.flagReason?.en}
                    </div>
                    {item.riskAssessment.legalReference && (
                      <div style={{ color: '#881337', fontSize: 11.5 }}>
                        <strong>{language === 'th' ? 'อ้างอิงระเบียบ:' : 'Legal Ref:'}</strong>{' '}
                        {item.riskAssessment.legalReference}
                      </div>
                    )}
                    {item.riskAssessment.recommendation && (
                      <div style={{ color: '#0369a1', fontSize: 11.5 }}>
                        <strong>{language === 'th' ? 'คำแนะนำ:' : 'Recommendation:'}</strong>{' '}
                        {language === 'th'
                          ? item.riskAssessment.recommendation?.th
                          : item.riskAssessment.recommendation?.en}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gauge Panel */}
      <div className="gauge-wrapper" style={{ marginTop: 20 }}>
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
