'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Project, TorStatus } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/hooks/useBookmarks';
import { ICONS } from '@/components/ui/Icons';
import {
  formatBudget,
  formatDate,
  daysUntil,
  getCategoryClass,
} from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/labels';

interface ExtendedProject extends Project {
  externalProjectId?: string | number;
  source?: string;
  _hasActualPublishDate?: boolean;
}

interface ProjectCardProps {
  project: Project;
}

function getTorBadge(torStatus: TorStatus | undefined, language: 'th' | 'en') {
  if (torStatus === 'NO_TOR') {
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 4,
          background: 'rgba(239, 68, 68, 0.08)',
          color: '#dc2626',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
        }}
        title={language === 'th' ? 'ยังไม่มีเอกสาร TOR แนบ' : 'No TOR document available'}
      >
        📄 {language === 'th' ? 'ไม่มี TOR' : 'No TOR'}
      </span>
    );
  }
  if (torStatus === 'PENDING') {
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 4,
          background: 'rgba(245, 158, 11, 0.08)',
          color: '#d97706',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
        }}
        title={language === 'th' ? 'TOR อยู่ระหว่างดำเนินการ' : 'TOR document pending'}
      >
        ⏳ {language === 'th' ? 'TOR รอดำเนินการ' : 'TOR Pending'}
      </span>
    );
  }
  // AVAILABLE — no badge needed (default)
  return null;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const { language, L, getLocalized } = useLanguage();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const extProject = project as ExtendedProject;
  const hasDeadline = project.deadline && project.deadline !== '';
  const days = hasDeadline ? daysUntil(project.deadline) : null;
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[language][project.category] || project.category;
  const bookmarked = isBookmarked(project.externalId);

  // ─── Status Tag (based on official status & actual deadline) ────────────────
  const rawStatus = (project as any).status || '';
  const winnerName = (project as any).winnerName;
  let statusTagClass = 'tag';
  let statusText = '';

  if (winnerName || rawStatus === 'จัดทำสัญญาแล้ว') {
    statusTagClass = 'tag closed-dot';
    statusText = language === 'th' ? '● มีผู้ชนะ/ทำสัญญาแล้ว' : '● Contract Awarded';
  } else if (rawStatus === 'ระหว่างดำเนินการ') {
    statusTagClass = 'tag open-dot';
    statusText = language === 'th' ? '● ระหว่างดำเนินการ' : '● In Progress';
  } else if (hasDeadline) {
    if (days !== null && days < 0) {
      statusTagClass = 'tag closed-dot';
      statusText = language === 'th' ? '● ปิดรับข้อเสนอ' : '● Closed';
    } else if (days !== null && days <= 7) {
      statusTagClass = 'tag closing-soon-dot';
      statusText = language === 'th' ? `● ใกล้ปิดรับ (${days}ว)` : `● Closing Soon (${days}d)`;
    } else if (days !== null) {
      statusTagClass = 'tag open-dot';
      statusText = language === 'th' ? `● เปิดรับ (${days}ว)` : `● Open (${days}d)`;
    }
  } else if (rawStatus) {
    statusTagClass = 'tag open-dot';
    statusText = `● ${rawStatus}`;
  } else {
    statusTagClass = 'tag';
    statusText = language === 'th' ? '● ประกาศจัดซื้อ' : '● Announced';
  }

  const handleCardClick = () => {
    const targetId = extProject.externalProjectId || project.externalId;
    router.push(`/opportunities/${targetId}`);
  };

  // ─── Fiscal Year display ───────────────────────────────────────────────────
  const fiscalYear = project.fiscalYear;
  const calendarYear = fiscalYear ? fiscalYear - 543 : null;

  // ─── Publish date label ────────────────────────────────────────────────────
  // If we only have sync date (not real announcement), label it accordingly.
  const hasRealPublishDate = extProject._hasActualPublishDate !== false;
  const publishLabel = hasRealPublishDate
    ? (language === 'th' ? 'วันประกาศ' : 'Published')
    : (language === 'th' ? 'วันที่ซิงค์' : 'Synced');

  return (
    <div className="project-card" onClick={handleCardClick} role="button" tabIndex={0}>
      <div>
        <div className="project-card-header">
          <div className="project-card-tags">
            <span className={`tag category ${catClass}`}>{catLabel}</span>
            {statusText && <span className={statusTagClass}>{statusText}</span>}
            {getTorBadge(project.torStatus, language)}
          </div>
          <button
            type="button"
            className={`bookmark-btn ${bookmarked ? 'active' : ''}`}
            onClick={(e) => toggleBookmark(project.externalId, e)}
            aria-label={bookmarked ? L('saved') : L('saveBookmark')}
          >
            {bookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
          </button>
        </div>

        <div className="ai-tag-label">{L('aiClassification')}</div>
        <h3 className="project-card-title" style={{ marginTop: 6 }}>
          {getLocalized(project.title) as string}
        </h3>

        <div className="project-card-dept">
          {ICONS.building}
          {getLocalized(project.department) as string}
        </div>

        {project.requiredTechnologies && project.requiredTechnologies.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {project.requiredTechnologies.slice(0, 3).map((t, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: 'rgba(14, 165, 233, 0.08)',
                  color: '#0284c7',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                }}
              >
                {t}
              </span>
            ))}
            {project.requiredTechnologies.length > 3 && (
              <span style={{ fontSize: 10, color: 'var(--gray-500)', alignSelf: 'center' }}>
                +{project.requiredTechnologies.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="project-card-meta">
          {/* Budget */}
          <div className="meta-item">
            <span className="meta-label">{L('budget')}</span>
            <span className="meta-value budget">
              {project.budget > 0 ? formatBudget(project.budget, language) : (language === 'th' ? 'ไม่ระบุ' : 'N/A')}
            </span>
            {project.contractPrice && project.contractPrice !== project.budget && (
              <span style={{ fontSize: 10, color: '#047857', fontWeight: 600 }}>
                {language === 'th'
                  ? `จัดหาได้: ${formatBudget(project.contractPrice, language)}`
                  : `Awarded: ${formatBudget(project.contractPrice, language)}`}
              </span>
            )}
            {project.winnerName && (
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--gray-600)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 160,
                }}
                title={project.winnerName}
              >
                {language === 'th' ? `ผู้ชนะ: ${project.winnerName}` : `Winner: ${project.winnerName}`}
              </span>
            )}
          </div>

          {/* Deadline or Contract Period */}
          <div className="meta-item">
            <span className="meta-label">
              {hasDeadline
                ? (language === 'th' ? 'กำหนดปิดรับ' : 'Closes')
                : project.contractFinishDate
                ? (language === 'th' ? 'สิ้นสุดสัญญา' : 'Contract End')
                : project.contractDate
                ? (language === 'th' ? 'วันทำสัญญา' : 'Contract Date')
                : (language === 'th' ? 'สถานะ' : 'Status')}
            </span>
            <span
              className="meta-value"
              style={{
                color:
                  days !== null && days <= 7 && days >= 0
                    ? '#dc2626'
                    : project.contractFinishDate
                    ? '#047857'
                    : undefined,
                fontWeight:
                  (days !== null && days <= 7 && days >= 0) || project.contractFinishDate
                    ? 600
                    : undefined,
              }}
            >
              {hasDeadline
                ? formatDate(project.deadline, language)
                : project.contractFinishDate
                ? formatDate(project.contractFinishDate, language)
                : project.contractDate
                ? formatDate(project.contractDate, language)
                : project.status
                ? project.status
                : (language === 'th' ? 'เปิดรับข้อเสนอ (ดู e-GP)' : 'Active (See e-GP)')}
            </span>
          </div>

          {/* Fiscal Year */}
          {fiscalYear && (
            <div className="meta-item">
              <span className="meta-label">{language === 'th' ? 'ปีงบประมาณ' : 'Fiscal Year'}</span>
              <span className="meta-value">
                {language === 'th'
                  ? `พ.ศ. ${fiscalYear} (ค.ศ. ${calendarYear})`
                  : `TH FY ${fiscalYear} (CE ${calendarYear})`}
              </span>
            </div>
          )}

          {/* Procurement Type */}
          <div className="meta-item">
            <span className="meta-label">{L('procurementType')}</span>
            <span className="meta-value">{project.procurementType || 'N/A'}</span>
          </div>
        </div>

        <div className="source-label">
          <span>{publishLabel}: {project.publishDate ? formatDate(project.publishDate, language) : 'N/A'}</span>
          {!hasRealPublishDate && (
            <span
              style={{ marginLeft: 4, fontSize: 9, color: '#dc2626', fontWeight: 700 }}
              title={language === 'th' ? 'วันที่แสดงเป็นวันที่ซิงค์ข้อมูล ไม่ใช่วันประกาศจริง' : 'Date shown is sync date, not the actual announcement date'}
            >
              ⚠
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
