'use client';

import React, { useState, useEffect } from 'react';
import { ICONS } from '@/components/ui/Icons';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  TechCategory,
  NormalizedTechItem,
  normalizeTechList,
  categorizeTechnicalRequirement,
} from '@/services/transformation/taxonomy/tech-taxonomy';

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
  rawTechnologies,
  rawRequirements,
}: TechStackRequirementsProps) {
  const { language } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<'All' | TechCategory>('All');

  // 1. Normalize tech stack tags using taxonomy
  const fallbackTechs = [
    'React',
    'Node.js',
    'PostgreSQL',
    'Docker & Containers',
    'Cloud Infrastructure',
    'ISO/IEC 27001',
    'PDPA Compliance',
  ];
  const tagsToNormalize = rawTechnologies && rawTechnologies.length > 0
    ? rawTechnologies
    : fallbackTechs;

  const normalizedTechnologies: NormalizedTechItem[] = normalizeTechList(tagsToNormalize);

  // 2. Parse & categorize technical requirements
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
    const category = categorizeTechnicalRequirement(th, en);
    return {
      id: `tech-req-${idx}`,
      category,
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

  // 3. Persist checklist state when storageKey changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        Promise.resolve().then(() => setCheckedReqIds(JSON.parse(saved)));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 4. Counts per category
  const categories: { key: 'All' | TechCategory; labelTh: string; labelEn: string; icon: string }[] = [
    { key: 'All', labelTh: 'ทั้งหมด', labelEn: 'All', icon: '⚡' },
    { key: 'Frontend', labelTh: 'Frontend', labelEn: 'Frontend', icon: '🎨' },
    { key: 'Backend', labelTh: 'Backend', labelEn: 'Backend', icon: '⚙️' },
    { key: 'Infra', labelTh: 'Infra & Cloud', labelEn: 'Infra & Cloud', icon: '☁️' },
    { key: 'Security', labelTh: 'Security & PDPA', labelEn: 'Security & PDPA', icon: '🛡️' },
  ];

  const getTechCount = (cat: 'All' | TechCategory) => {
    if (cat === 'All') return normalizedTechnologies.length;
    return normalizedTechnologies.filter((t) => t.category === cat).length;
  };

  // Filtered lists
  const filteredTechs = activeCategory === 'All'
    ? normalizedTechnologies
    : normalizedTechnologies.filter((t) => t.category === activeCategory);

  const filteredRequirements = activeCategory === 'All'
    ? parsedRequirements
    : parsedRequirements.filter((r) => r.category === activeCategory);

  const totalReqCount = parsedRequirements.length;
  const checkedCount = parsedRequirements.filter((r) => checkedReqIds.includes(r.id)).length;
  const progressPct = totalReqCount > 0 ? Math.round((checkedCount / totalReqCount) * 100) : 0;

  // Category styles
  const getCategoryTheme = (cat: TechCategory) => {
    switch (cat) {
      case 'Frontend':
        return {
          badgeBg: '#f3e8ff',
          badgeColor: '#7e22ce',
          badgeBorder: '#d8b4fe',
          pillBg: 'rgba(168, 85, 247, 0.08)',
          pillColor: '#7e22ce',
          pillBorder: 'rgba(168, 85, 247, 0.35)',
        };
      case 'Backend':
        return {
          badgeBg: '#ecfdf5',
          badgeColor: '#047857',
          badgeBorder: '#a7f3d0',
          pillBg: 'rgba(16, 185, 129, 0.08)',
          pillColor: '#047857',
          pillBorder: 'rgba(16, 185, 129, 0.35)',
        };
      case 'Infra':
        return {
          badgeBg: '#eff6ff',
          badgeColor: '#1d4ed8',
          badgeBorder: '#bfdbfe',
          pillBg: 'rgba(59, 130, 246, 0.08)',
          pillColor: '#1d4ed8',
          pillBorder: 'rgba(59, 130, 246, 0.35)',
        };
      case 'Security':
        return {
          badgeBg: '#fff1f2',
          badgeColor: '#be123c',
          badgeBorder: '#fecdd3',
          pillBg: 'rgba(244, 63, 94, 0.08)',
          pillColor: '#be123c',
          pillBorder: 'rgba(244, 63, 94, 0.35)',
        };
    }
  };

  return (
    <div className="detail-card" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="detail-card-title" style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
          {ICONS.sparkles}
          <span>
            {language === 'th'
              ? 'เทคโนโลยีและข้อกำหนดทางเทคนิค (Tech Stack & Requirements)'
              : 'Tech Stack & Technical Requirements'}
          </span>
        </h2>
      </div>

      {/* Category Filter Pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
          padding: '10px 12px',
          background: 'var(--gray-100)',
          borderRadius: 10,
        }}
      >
        <span
          style={{
            alignSelf: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--gray-600)',
            marginRight: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {language === 'th' ? 'หมวดหมู่:' : 'Filter:'}
        </span>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;
          const count = getTechCount(cat.key);
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: isActive ? '1px solid #0284c7' : '1px solid var(--gray-300)',
                background: isActive ? '#0284c7' : '#ffffff',
                color: isActive ? '#ffffff' : 'var(--gray-700)',
                boxShadow: isActive ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none',
              }}
            >
              <span>{cat.icon}</span>
              <span>{language === 'th' ? cat.labelTh : cat.labelEn}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--gray-200)',
                  color: isActive ? '#ffffff' : 'var(--gray-700)',
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── 1. Tech Stack Badges ────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--gray-700)',
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>🏷️</span>
          <span>
            {language === 'th'
              ? `เทคโนโลยีที่ระบุในเอกสาร TOR (${filteredTechs.length})`
              : `Identified Technologies in TOR (${filteredTechs.length})`}
          </span>
        </div>

        {filteredTechs.length === 0 ? (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 8,
              background: 'var(--gray-50)',
              border: '1px dashed var(--gray-300)',
              fontSize: 13,
              color: 'var(--gray-500)',
            }}
          >
            {language === 'th'
              ? `ไม่พบคำสำคัญทางเทคนิคในหมวด ${activeCategory}`
              : `No tech keywords detected for ${activeCategory} category.`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {filteredTechs.map((tech, idx) => {
              const theme = getCategoryTheme(tech.category);
              return (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: theme.pillBg,
                    color: theme.pillColor,
                    border: `1px solid ${theme.pillBorder}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: theme.badgeBg,
                      color: theme.badgeColor,
                      border: `1px solid ${theme.badgeBorder}`,
                      textTransform: 'uppercase',
                    }}
                  >
                    {tech.category}
                  </span>
                  <span>{tech.name}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 2. Requirements Checklist ──────────────────────────────────── */}
      {parsedRequirements.length > 0 && (
        <div>
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
                  ? `รายการตรวจสอบข้อกำหนดทางเทคนิค (Requirement Checklist)`
                  : `Technical Requirements Checklist`}
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
              <span style={{ color: checkedCount === totalReqCount ? '#059669' : '#0284c7' }}>
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
          {filteredRequirements.length === 0 ? (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 8,
                background: 'var(--gray-50)',
                border: '1px dashed var(--gray-300)',
                fontSize: 13,
                color: 'var(--gray-500)',
              }}
            >
              {language === 'th'
                ? `ไม่มีข้อกำหนดในหมวด ${activeCategory}`
                : `No requirements in ${activeCategory} category.`}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredRequirements.map((reqItem) => {
                const isChecked = checkedReqIds.includes(reqItem.id);
                const theme = getCategoryTheme(reqItem.category);
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
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: theme.badgeBg,
                            color: theme.badgeColor,
                            border: `1px solid ${theme.badgeBorder}`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {reqItem.category}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          lineHeight: 1.5,
                          color: isChecked ? '#166534' : 'var(--gray-800)',
                          textDecoration: isChecked ? 'line-through' : 'none',
                        }}
                      >
                        {text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
