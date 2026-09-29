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
  const days = daysUntil(project.deadline);
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[language][project.category] || project.category;
  const bookmarked = isBookmarked(project.externalId);

  // Status tag with dot indicator
  const statusTagClass = 'tag open-dot';
  const statusText = language === 'th' ? '● เปิดรับข้อเสนอ' : '● Open';

  const handleCardClick = () => {
    const targetId = (project as any).externalProjectId || project.externalId;
    router.push(`/opportunities/${targetId}`);
  };

  return (
    <div className="project-card" onClick={handleCardClick} role="button" tabIndex={0}>
      <div>
        <div className="project-card-header">
          <div className="project-card-tags">
            {((project as any).externalProjectId || project.sourceDocument?.includes('Attach_TOR_') || (project as any).source === 'CKAN_GOVSPENDING') && (
              <span
                className="tag"
                style={{
                  background: '#e8f5ef',
                  color: '#1e7e53',
                  border: '1px solid rgba(30, 126, 83, 0.25)',
                  fontWeight: 600,
                }}
              >
                🟢 e-GP รัฐบาล
              </span>
            )}
            <span className="tag software">{L('softwareProject')}</span>
            <span className={`tag category ${catClass}`}>{catLabel}</span>
            {days >= 0 && <span className={statusTagClass}>{statusText}</span>}
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
          <div className="meta-item">
            <span className="meta-label">{L('budget')}</span>
            <span className="meta-value budget">{formatBudget(project.budget, language)}</span>
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
