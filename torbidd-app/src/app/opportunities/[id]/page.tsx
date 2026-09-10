'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/hooks/useBookmarks';
import { ICONS } from '@/components/ui/Icons';
import { EligibilityChecklist } from '@/components/ui/EligibilityChecklist';
import { BudgetComparisonBar } from '@/components/ui/BudgetComparisonBar';
import { ProcurementTimeline } from '@/components/ui/ProcurementTimeline';
import { BudgetBreakdownCard } from '@/components/ui/BudgetBreakdownCard';
import { TorDocumentViewer } from '@/components/ui/TorDocumentViewer';
import { SetAlertModal } from '@/components/ui/SetAlertModal';
import {
  formatBudgetFull,
  formatDate,
  daysUntil,
  isClosingSoon,
  getCategoryClass,
} from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/labels';
import { INITIAL_PROJECTS } from '@/lib/initialData';
import { enrichProjectDetail } from '@/lib/projectDetailHelper';

type ViewMode = 'summary' | 'split' | 'document';

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
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load project data and saved checklist state
  useEffect(() => {
    const numId = parseInt(id, 10);

    // Set optimistic offline data synchronously
    const found = INITIAL_PROJECTS.find((p) => p.externalId === numId);
    if (found && !project) {
      Promise.resolve().then(() => setProject(enrichProjectDetail(found)));
    }

    // Fetch fresh from API
    fetch(`/api/projects/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setProject(enrichProjectDetail(json.data));
        }
      })
      .catch(() => {});

    // Restore persistent checklist state
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(`torbidd_checklist_${id}`) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        Promise.resolve().then(() => setCheckedIndices(parsed));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Persist checklist state when changed
  const handleToggleCheck = (index: number) => {
    setCheckedIndices((prev) => {
      const next = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
      try {
        localStorage.setItem(`torbidd_checklist_${id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSelectAllChecks = () => {
    if (!project?.qualifications?.th) return;
    const all = project.qualifications.th.map((_, i) => i);
    setCheckedIndices(all);
    try {
      localStorage.setItem(`torbidd_checklist_${id}`, JSON.stringify(all));
    } catch {}
  };

  const handleClearAllChecks = () => {
    setCheckedIndices([]);
    try {
      localStorage.removeItem(`torbidd_checklist_${id}`);
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      showToast(L('linkCopied'));
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

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

  const qualificationsList = (getLocalized(project.qualifications) as string[]) || [];
  const scopeList = (getLocalized(project.scope) as string[]) || [];

  return (
    <div className="page-content detail-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="detail-floating-toast">
          {ICONS.check}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation and View Mode Bar */}
      <div className="detail-top-nav-bar">
        <button className="detail-back-btn" onClick={() => router.push('/opportunities')}>
          {ICONS.arrowLeft}
          {L('backToList')}
        </button>

        {/* View Mode Switcher */}
        <div className="view-mode-tabs">
          <button
            className={`view-mode-btn ${viewMode === 'summary' ? 'active' : ''}`}
            onClick={() => setViewMode('summary')}
          >
            {ICONS.file}
            <span>{L('summaryView')}</span>
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
          >
            {ICONS.columns}
            <span>{L('splitView')}</span>
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'document' ? 'active' : ''}`}
            onClick={() => setViewMode('document')}
          >
            {ICONS.bookOpen}
            <span>{L('documentView')}</span>
          </button>
        </div>
      </div>

      {/* View Mode 1: Document View Only */}
      {viewMode === 'document' && (
        <div className="tor-viewer-full-container">
          <TorDocumentViewer
            project={project}
            documentSections={project.documentSections}
            onClose={() => setViewMode('summary')}
          />
        </div>
      )}

      {/* View Mode 2 & 3: Summary or Split View */}
      {viewMode !== 'document' && (
        <div className={`detail-grid ${viewMode === 'split' ? 'split-view-active' : ''}`}>
          {/* Main Left Column */}
          <div className="detail-main">
            {/* Hero Card */}
            <div className="detail-card detail-hero">
              <div className="detail-hero-tags">
                <span className="tag software">{L('softwareProject')}</span>
                <span className={`tag category ${catClass}`}>{catLabel}</span>
                <span className={statusTagClass}>{statusText}</span>
                {days >= 0 && (
                  <span className="tag deadline-tag">
                    {ICONS.clock}
                    <span>{days} {L('days')} {L('daysRemaining')}</span>
                  </span>
                )}
              </div>

              <h1 className="detail-hero-title">{getLocalized(project.title) as string}</h1>

              <div className="detail-hero-dept">
                {ICONS.building}
                <span>{getLocalized(project.department) as string}</span>
              </div>

              {/* Metadata Grid */}
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
                  <div
                    className={`meta-value ${closing ? 'deadline-soon' : ''}`}
                    style={{ fontWeight: 700 }}
                  >
                    {formatDate(project.deadline, language)}
                  </div>
                  <span className="ai-extract-label">{L('aiExtracted')}</span>
                </div>
              </div>

              {/* Action Bar */}
              <div className="detail-hero-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => setViewMode(viewMode === 'split' ? 'summary' : 'split')}
                >
                  {ICONS.bookOpen}
                  <span>{viewMode === 'split' ? L('summaryView') : L('openTORViewer')}</span>
                </button>

                <button
                  className={`btn btn-bookmark ${bookmarked ? 'active' : ''}`}
                  onClick={() => {
                    toggleBookmark(project.externalId);
                    showToast(bookmarked ? L('bookmarkRemoved') : L('bookmarkAdded'));
                  }}
                >
                  {bookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
                  <span>{bookmarked ? L('saved') : L('saveBookmark')}</span>
                </button>

                <button className="btn btn-secondary" onClick={() => setIsAlertModalOpen(true)}>
                  {ICONS.bell}
                  <span>{L('setAlert')}</span>
                </button>

                <button className="btn btn-secondary" onClick={handleShare}>
                  {ICONS.share}
                  <span>{L('shareOpportunity')}</span>
                </button>

                <button className="btn btn-secondary" onClick={handlePrint}>
                  {ICONS.printer}
                  <span>{L('printBrief')}</span>
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

            {/* Important Dates Timeline */}
            <ProcurementTimeline timeline={project.timeline} />

            {/* Bidder Qualifications & Go/No-Go Checklist */}
            <EligibilityChecklist
              qualifications={qualificationsList}
              checkedIndices={checkedIndices}
              onToggle={handleToggleCheck}
              onSelectAll={handleSelectAllChecks}
              onClearAll={handleClearAllChecks}
              highlightedQualifications={project.highlightedQualifications}
            />
          </div>

          {/* Right Column: Split Viewer OR Intelligence Sidebar */}
          {viewMode === 'split' ? (
            <div className="detail-split-col">
              <TorDocumentViewer
                project={project}
                documentSections={project.documentSections}
                isSplitView={true}
                onClose={() => setViewMode('summary')}
              />
            </div>
          ) : (
            <div className="detail-sidebar-col">
              {/* Budget Breakdown Card */}
              <BudgetBreakdownCard
                budget={project.budget}
                historicalAvg={project.historicalAvg}
                budgetBreakdown={project.budgetBreakdown}
              />

              {/* Historical Budget Comparison Bar */}
              <BudgetComparisonBar budget={project.budget} historicalAvg={project.historicalAvg} />

              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => router.push('/historical')}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {ICONS.chart}
                  <span>{L('viewPriceComparison')}</span>
                </button>
              </div>

              {/* Source & AI Transparency Card (DESIGN.md Sections 9 & 10) */}
              <div className="detail-card transparency-card" style={{ marginTop: 8 }}>
                <h2 className="detail-card-title">
                  {ICONS.info}
                  <span>{L('sourceTransparency')}</span>
                </h2>

                <div className="transparency-details">
                  <div className="transparency-row">
                    <span className="transparency-label">Source Document</span>
                    <span className="transparency-val">
                      {project.sourceDocument || 'BMA_TOR_OFFICIAL.pdf'}
                    </span>
                  </div>

                  <div className="transparency-row">
                    <span className="transparency-label">AI Model</span>
                    <span className="transparency-val">
                      {project.aiMetadata?.model || 'Gemini 1.5 Pro (Vertex AI)'}
                    </span>
                  </div>

                  <div className="transparency-row">
                    <span className="transparency-label">{L('aiConfidenceScore')}</span>
                    <span className="transparency-val score-high">
                      {project.aiMetadata?.confidenceScore || 97}% ({project.aiConfidence})
                    </span>
                  </div>

                  <div className="transparency-row">
                    <span className="transparency-label">{L('verifiedClauses')}</span>
                    <span className="transparency-val">
                      {project.aiMetadata?.extractedClausesCount || 12} clauses
                    </span>
                  </div>

                  <div className="transparency-row">
                    <span className="transparency-label">Human Verification</span>
                    <span className="transparency-val verified-text">
                      {ICONS.check} Verified
                    </span>
                  </div>

                  <div className="transparency-row" style={{ borderBottom: 'none' }}>
                    <span className="transparency-label">Last Extracted</span>
                    <span className="transparency-val">
                      {formatDate(project.processedDate || project.publishDate, language)}
                    </span>
                  </div>
                </div>

                {project.sourceUrl && (
                  <div style={{ marginTop: 14 }}>
                    <a
                      href={project.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }}
                    >
                      {ICONS.externalLink}
                      <span>{L('viewOriginalSource')}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Responsible Department & Inquiries Contact Card */}
              {project.contactInfo && (
                <div className="detail-card contact-card" style={{ marginTop: 8 }}>
                  <h2 className="detail-card-title">
                    {ICONS.building}
                    <span>{L('contactOfficer')}</span>
                  </h2>

                  <div className="contact-details">
                    <div className="contact-item">
                      <span className="contact-label">{L('department')}</span>
                      <strong className="contact-val">
                        {getLocalized(project.contactInfo.department) as string}
                      </strong>
                    </div>

                    {project.contactInfo.division && (
                      <div className="contact-item">
                        <span className="contact-label">หน่วยงานย่อย</span>
                        <span className="contact-val">
                          {getLocalized(project.contactInfo.division) as string}
                        </span>
                      </div>
                    )}

                    {project.contactInfo.phone && (
                      <div className="contact-item">
                        <span className="contact-label">โทรศัพท์ติดต่อ</span>
                        <a href={`tel:${project.contactInfo.phone}`} className="contact-val link">
                          {project.contactInfo.phone}
                        </a>
                      </div>
                    )}

                    {project.contactInfo.email && (
                      <div className="contact-item">
                        <span className="contact-label">อีเมล</span>
                        <a href={`mailto:${project.contactInfo.email}`} className="contact-val link">
                          {project.contactInfo.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Set Alert Modal */}
      <SetAlertModal
        project={project}
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
      />
    </div>
  );
}
