'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/hooks/useBookmarks';
import { ICONS } from '@/components/ui/Icons';
import { EligibilityChecklist } from '@/components/ui/EligibilityChecklist';
import { BudgetComparisonBar } from '@/components/ui/BudgetComparisonBar';
import {
  formatBudgetFull,
  formatDate,
  daysUntil,
  isClosingSoon,
  getCategoryClass,
} from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/labels';
import { INITIAL_PROJECTS } from '@/lib/initialData';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { language, L, getLocalized } = useLanguage();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const [project, setProject] = useState<Project | null>(null);
  const [checkedIndices, setCheckedIndices] = useState<number[]>([]);

  useEffect(() => {
    // Try matching by externalId first (number) or ObjectId (string)
    const numId = parseInt(id, 10);
    const found = INITIAL_PROJECTS.find((p) => p.externalId === numId);
    if (found) {
      setProject(found);
    }

    // Also fetch fresh from API
    fetch(`/api/projects/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setProject(json.data);
        }
      })
      .catch(() => {});
  }, [id]);

  if (!project) {
    return (
      <div className="page-content">
        <button className="detail-back-btn" onClick={() => router.push('/opportunities')}>
          {ICONS.arrowLeft}
          {L('backToList')}
        </button>
        <div className="empty-state" style={{ marginTop: 40 }}>
          <h3>Project Not Found</h3>
          <p>The procurement opportunity requested could not be located.</p>
        </div>
      </div>
    );
  }

  const closing = isClosingSoon(project.deadline);
  const days = daysUntil(project.deadline);
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[language][project.category] || project.category;
  const bookmarked = isBookmarked(project.externalId);

  // Status tag with dot
  let statusTagClass = 'tag open-dot';
  let statusText = language === 'th' ? '● เปิดรับข้อเสนอ' : '● Open';
  if (closing) {
    statusTagClass = 'tag closing-soon-dot';
    statusText = language === 'th' ? '● ใกล้ปิดรับ' : '● Closing Soon';
  } else if (days < 0) {
    statusTagClass = 'tag closed-dot';
    statusText = language === 'th' ? '● ปิดรับข้อเสนอ' : '● Closed';
  }

  const handleToggleCheck = (index: number) => {
    setCheckedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      return [...prev, index];
    });
  };

  const handleDownloadTOR = () => {
    alert(
      language === 'th'
        ? `เอกสาร TOR ต้นฉบับ: ${project.sourceDocument || 'BMA_TOR.pdf'} (ระบบพร้อมเชื่อมต่อระบบ e-GP กทม.)`
        : `Opening original TOR document: ${project.sourceDocument || 'BMA_TOR.pdf'}`
    );
  };

  const qualificationsList = (getLocalized(project.qualifications) as string[]) || [];
  const scopeList = (getLocalized(project.scope) as string[]) || [];

  return (
    <div className="page-content">
      <button className="detail-back-btn" onClick={() => router.push('/opportunities')}>
        {ICONS.arrowLeft}
        {L('backToList')}
      </button>

      <div className="detail-grid">
        <div className="detail-main">
          {/* Hero Card */}
          <div className="detail-card detail-hero">
            <div className="detail-hero-tags">
              <span className="tag software">{L('softwareProject')}</span>
              <span className={`tag category ${catClass}`}>{catLabel}</span>
              <span className={statusTagClass}>{statusText}</span>
            </div>

            <h1 className="detail-hero-title">{getLocalized(project.title) as string}</h1>

            <div className="detail-hero-dept">
              {ICONS.building}
              {getLocalized(project.department) as string}
            </div>

            <div className="detail-meta-grid">
              <div className="detail-meta-item">
                <div className="meta-label">{L('budget')}</div>
                <div className="meta-value budget" style={{ fontWeight: 700 }}>
                  {formatBudgetFull(project.budget, language)}
                </div>
                <span className="ai-extract-label">{L('extractedFromTOR')}</span>
              </div>

              <div className="detail-meta-item">
                <div className="meta-label">{L('procurementType')}</div>
                <div className="meta-value" style={{ fontWeight: 700 }}>
                  {project.procurementType}
                </div>
                <span className="ai-extract-label">{L('aiExtracted')}</span>
              </div>

              <div className="detail-meta-item">
                <div className="meta-label">{L('publishDate')}</div>
                <div className="meta-value" style={{ fontWeight: 700 }}>
                  {formatDate(project.publishDate, language)}
                </div>
                <span className="ai-extract-label">{L('aiExtracted')}</span>
              </div>

              <div className="detail-meta-item">
                <div className="meta-label">{L('deadline')}</div>
                <div className={`meta-value ${closing ? 'deadline-soon' : ''}`} style={{ fontWeight: 700 }}>
                  {formatDate(project.deadline, language)}
                </div>
                <span className="ai-extract-label">{L('aiExtracted')}</span>
              </div>
            </div>

            <div className="detail-hero-actions">
              <button className="btn btn-primary" onClick={handleDownloadTOR}>
                {ICONS.externalLink}
                {L('downloadTOR')}
              </button>

              <button
                className={`btn btn-bookmark ${bookmarked ? 'active' : ''}`}
                onClick={() => toggleBookmark(project.externalId)}
              >
                {bookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
                <span>{bookmarked ? L('saved') : L('saveBookmark')}</span>
              </button>
            </div>
          </div>

          {/* Description Card */}
          <div className="detail-card">
            <h2 className="detail-card-title">
              {ICONS.file}
              <span>{L('projectDesc')}</span>
            </h2>
            <p className="description-text">{getLocalized(project.description) as string}</p>
          </div>

          {/* Scope of Work */}
          <div className="detail-card">
            <h2 className="detail-card-title">
              {ICONS.target}
              <span>{L('scopeOfWork')}</span>
            </h2>
            <ul className="scope-list">
              {scopeList.map((item, idx) => (
                <li key={idx} className="scope-item">
                  <span className="scope-bullet">●</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Qualifications & Go/No-Go Checklist */}
          <EligibilityChecklist
            qualifications={qualificationsList}
            checkedIndices={checkedIndices}
            onToggle={handleToggleCheck}
          />
        </div>

        {/* Sidebar Column */}
        <div className="detail-sidebar-col">
          {/* Budget Comparison Card */}
          <BudgetComparisonBar budget={project.budget} historicalAvg={project.historicalAvg} />

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/historical')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {ICONS.chart}
              <span>{L('viewPriceComparison')}</span>
            </button>
          </div>

          {/* Quick Info & Transparency Card */}
          <div className="detail-card" style={{ marginTop: 16 }}>
            <h2 className="detail-card-title">
              {ICONS.info}
              <span>{L('sourceTransparency')}</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Source Document</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-900)' }}>
                  {project.sourceDocument || 'BMA TOR PDF'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Last Extracted</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-900)' }}>
                  {formatDate(project.processedDate || project.publishDate, language)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Extraction Status</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>✓ Verified</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>AI Confidence</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary-700)' }}>
                  {project.aiConfidence || 'High'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
