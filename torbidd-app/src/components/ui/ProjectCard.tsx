'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/hooks/useBookmarks';
import { ICONS } from '@/components/ui/Icons';
import {
  formatBudget,
  formatDate,
  daysUntil,
  isClosingSoon,
  isNew,
  getCategoryClass,
} from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/labels';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const { language, L, getLocalized } = useLanguage();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const closing = isClosingSoon(project.deadline);
  const isNewItem = isNew(project.publishDate);
  const days = daysUntil(project.deadline);
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[language][project.category] || project.category;
  const bookmarked = isBookmarked(project.externalId);

  // Status tag with dot indicator
  let statusTagClass = 'tag open-dot';
  let statusText = language === 'th' ? '● เปิดรับข้อเสนอ' : '● Open';
  if (closing) {
    statusTagClass = 'tag closing-soon-dot';
    statusText = language === 'th' ? '● ใกล้ปิดรับ' : '● Closing Soon';
  } else if (days < 0) {
    statusTagClass = 'tag closed-dot';
    statusText = language === 'th' ? '● ปิดรับข้อเสนอ' : '● Closed';
  }

  const handleCardClick = () => {
    router.push(`/opportunities/${project.externalId}`);
  };

  return (
    <div className="project-card" onClick={handleCardClick} role="button" tabIndex={0}>
      <div>
        <div className="project-card-header">
          <div className="project-card-tags">
            <span className="tag software">{L('softwareProject')}</span>
            <span className={`tag category ${catClass}`}>{catLabel}</span>
            <span className={statusTagClass}>{statusText}</span>
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
      </div>

      <div>
        <div className="project-card-meta">
          <div className="meta-item">
            <span className="meta-label">{L('budget')}</span>
            <span className="meta-value budget">{formatBudget(project.budget, language)}</span>
            <span style={{ fontSize: 10, color: 'var(--gray-500)' }}>{L('aiExtracted')}</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">{L('deadline')}</span>
            <span className={`meta-value ${closing ? 'deadline-soon' : ''}`}>
              {formatDate(project.deadline, language)}
              {closing ? ` (${days}${L('days')})` : ''}
            </span>
            <span style={{ fontSize: 10, color: 'var(--gray-500)' }}>{L('aiExtracted')}</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">{L('publishDate')}</span>
            <span className="meta-value">{formatDate(project.publishDate, language)}</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">{L('procurementType')}</span>
            <span className="meta-value">{project.procurementType}</span>
          </div>
        </div>

        <div className="source-label">
          Source: {project.sourceDocument || 'BMA TOR'} • {L('sourceUpdated')}: {formatDate(project.processedDate || project.publishDate, language)}
        </div>
      </div>
    </div>
  );
}
