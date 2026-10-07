'use client';

import React, { useState, useEffect } from 'react';
import { ICONS } from '@/components/ui/Icons';
import { useLanguage } from '@/contexts/LanguageContext';
export interface TechStackRequirementsProps {
  projectId: string | number;
  rawTechnologies?: string[];
  rawRequirements?: {
    th?: string | string[];
    en?: string | string[];
  } | string[];
}

export function TechStackRequirements({
  projectId,
  rawRequirements,
}: TechStackRequirementsProps) {
  const { language } = useLanguage();

  // 1. Parse technical requirements
  let reqThList: string[] = [];
  let reqEnList: string[] = [];

  if (Array.isArray(rawRequirements)) {
    reqThList = rawRequirements;
    reqEnList = rawRequirements;
  } else if (rawRequirements) {
    if (Array.isArray(rawRequirements.th)) reqThList = rawRequirements.th;
    else if (typeof rawRequirements.th === 'string') reqThList = [rawRequirements.th];

    if (Array.isArray(rawRequirements.en)) reqEnList = rawRequirements.en;
    else if (typeof rawRequirements.en === 'string') reqEnList = [rawRequirements.en];
  }

  const maxLen = Math.max(reqThList.length, reqEnList.length);
  const parsedRequirements = Array.from({ length: maxLen }).map((_, idx) => {
    const th = reqThList[idx] || '';
    const en = reqEnList[idx] || th;
    return {
      id: `tech-req-${idx}`,
      text: { th, en },
    };
  });

  const storageKey = `torbidd_tech_req_${projectId}`;
  const [checkedReqIds, setCheckedReqIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`torbidd_tech_req_${projectId}`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // 2. Persist checklist state when storageKey changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        Promise.resolve().then(() => setCheckedReqIds(JSON.parse(saved)));
      }
    } catch {}
  }, [storageKey]);

  const toggleRequirement = (id: string) => {
    setCheckedReqIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const checkAll = () => {
    const allIds = parsedRequirements.map((r) => r.id);
    setCheckedReqIds(allIds);
    try {
      localStorage.setItem(storageKey, JSON.stringify(allIds));
    } catch {}
  };

  const clearAll = () => {
    setCheckedReqIds([]);
    try {
      localStorage.setItem(storageKey, JSON.stringify([]));
    } catch {}
  };

  const totalReqCount = parsedRequirements.length;
  const checkedCount = parsedRequirements.filter((r) => checkedReqIds.includes(r.id)).length;
  const progressPct = totalReqCount > 0 ? Math.round((checkedCount / totalReqCount) * 100) : 0;

  return (
    <div className="detail-card" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="detail-card-title" style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
          {ICONS.sparkles}
          <span>
            {language === 'th'
              ? 'รายการตรวจสอบข้อกำหนดทางเทคนิค (Technical Requirements Checklist)'
              : 'Technical Requirements Checklist'}
          </span>
        </h2>
      </div>

      {parsedRequirements.length === 0 ? (
        <div
          style={{
            padding: '24px 20px',
            borderRadius: 8,
            background: 'var(--gray-50)',
            border: '1px dashed var(--gray-300)',
            textAlign: 'center',
            color: 'var(--gray-600)',
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {language === 'th'
              ? 'ยังไม่มีรายการตรวจสอบข้อกำหนดทางเทคนิค'
              : 'No Technical Requirements Checklist Available'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
            {language === 'th'
              ? 'กดปุ่ม "ประมวลผล TOR อัตโนมัติ" ในแถบด้านข้างเพื่อให้ AI สกัดข้อกำหนดทางเทคนิคจากเอกสาร'
              : 'Click "Auto-Extract TOR" in the sidebar to generate a Technical Requirements Checklist from the TOR document.'}
          </div>
        </div>
      ) : (
        <div>
          {/* Action Bar (Check All / Clear All) */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--gray-700)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>⚙️</span>
              <span>
                {language === 'th'
                  ? `รายการข้อกำหนด (${parsedRequirements.length})`
                  : `Requirements (${parsedRequirements.length})`}
              </span>
            </div>

            {/* Checklist Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={checkAll}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0284c7',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                {language === 'th' ? 'เลือกทั้งหมด' : 'Check All'}
              </button>
              <span style={{ color: 'var(--gray-300)' }}>|</span>
              <button
                type="button"
                onClick={clearAll}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--gray-500)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                {language === 'th' ? 'ล้างค่า' : 'Clear All'}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              background: 'var(--gray-100)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
              <span style={{ color: 'var(--gray-700)' }}>
                {language === 'th'
                  ? `ความพร้อมต่อข้อกำหนด: ผ่านการตรวจสอบแล้ว ${checkedCount} จาก ${totalReqCount} ข้อ`
                  : `Readiness: ${checkedCount} of ${totalReqCount} requirements checked`}
              </span>
              <span style={{ color: checkedCount === totalReqCount && totalReqCount > 0 ? '#059669' : '#0284c7' }}>
                {progressPct}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 6,
                background: 'var(--gray-200)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: progressPct === 100 ? '#10b981' : '#0284c7',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Checklist Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parsedRequirements.map((reqItem) => {
              const isChecked = checkedReqIds.includes(reqItem.id);
              const text = language === 'th' ? reqItem.text.th : reqItem.text.en;

              return (
                <div
                  key={reqItem.id}
                  onClick={() => toggleRequirement(reqItem.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: isChecked ? '#f0fdf4' : 'var(--gray-50)',
                    border: isChecked ? '1px solid #bbf7d0' : '1px solid var(--gray-200)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleRequirement(reqItem.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: 3,
                      cursor: 'pointer',
                      accentColor: '#059669',
                      width: 16,
                      height: 16,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: isChecked ? '#166534' : 'var(--gray-800)',
                      textDecoration: isChecked ? 'line-through' : 'none',
                    }}
                  >
                    {text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
