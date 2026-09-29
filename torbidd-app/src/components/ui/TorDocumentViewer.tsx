'use client';

import React, { useState } from 'react';
import { DocumentSection, Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';

interface TorDocumentViewerProps {
  project: Project;
  documentSections?: DocumentSection[];
  onClose?: () => void;
  isSplitView?: boolean;
}

export function TorDocumentViewer({
  project,
  documentSections,
  onClose,
  isSplitView = false,
}: TorDocumentViewerProps) {
  const { language, L, getLocalized } = useLanguage();
  const [activeSectionId, setActiveSectionId] = useState<string>(
    documentSections?.[0]?.sectionId || 'article-1'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const sections = documentSections || [];
  const currentSection =
    sections.find((s) => s.sectionId === activeSectionId) || sections[0];

  const handleDownloadPDF = () => {
    const docName = project.sourceDocument || `BMA_TOR_${project.externalId}.pdf`;
    // Create a mock blob or download trigger
    const content = `Bangkok Metropolitan Administration - Official TOR Document\nProject: ${getLocalized(project.title)}\nDepartment: ${getLocalized(project.department)}\nBudget: ${project.budget} THB\nPublished: ${project.publishDate}\nDeadline: ${project.deadline}\n\n=========================================\n${sections.map((s) => `${getLocalized(s.title)}\n${getLocalized(s.content)}`).join('\n\n')}`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredSections = searchQuery.trim()
    ? sections.filter((s) => {
        const title = (getLocalized(s.title) as string).toLowerCase();
        const content = (getLocalized(s.content) as string).toLowerCase();
        const q = searchQuery.toLowerCase();
        return title.includes(q) || content.includes(q);
      })
    : sections;

  return (
    <div className={`tor-document-viewer ${isSplitView ? 'split-mode' : 'standalone-mode'}`}>
      {/* Viewer Action Bar */}
      <div className="tor-viewer-toolbar">
        <div className="toolbar-left">
          <div className="doc-icon-badge">{ICONS.file}</div>
          <div className="doc-info-meta">
            <span className="doc-title-text">{project.sourceDocument || `TOR-${project.externalId}.pdf`}</span>
            <span className="doc-verified-tag">
              {ICONS.shield}
              <span>{L('officialVerification')}</span>
            </span>
          </div>
        </div>

        <div className="toolbar-center">
          {/* Zoom controls */}
          <div className="viewer-zoom-controls">
            <button
              className="zoom-btn"
              onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
              title={L('zoomOut')}
              aria-label={L('zoomOut')}
            >
              {ICONS.zoomOut}
            </button>
            <span className="zoom-label">{zoomLevel}%</span>
            <button
              className="zoom-btn"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              title={L('zoomIn')}
              aria-label={L('zoomIn')}
            >
              {ICONS.zoomIn}
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <button className="btn btn-secondary toolbar-action-btn" onClick={handleDownloadPDF}>
            {ICONS.download}
            <span>{L('downloadOfficialPDF')}</span>
          </button>

          {project.sourceUrl && (
            <a
              href={project.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary toolbar-action-btn"
              style={{ textDecoration: 'none' }}
            >
              {ICONS.externalLink}
              <span>{L('viewOriginalSource')}</span>
            </a>
          )}

          {onClose && !isSplitView && (
            <button className="toolbar-close-btn" onClick={onClose} aria-label={L('closeViewer')}>
              {ICONS.x}
            </button>
          )}
        </div>
      </div>

      {/* Main Split Body: Sidebar Navigation + Document Sheet */}
      <div className="tor-viewer-workspace">
        {/* Navigation Sidebar */}
        <div className="tor-viewer-sidebar">
          <div className="viewer-search-box">
            {ICONS.search}
            <input
              type="text"
              placeholder={L('searchDocPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="viewer-search-input"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                {ICONS.x}
              </button>
            )}
          </div>

          <div className="viewer-section-list">
            <div className="section-list-header">{L('articles')}</div>
            {filteredSections.map((sec) => {
              const isSelected = sec.sectionId === currentSection?.sectionId;
              return (
                <button
                  key={sec.sectionId}
                  className={`section-nav-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setActiveSectionId(sec.sectionId)}
                >
                  <div className="section-nav-top">
                    {sec.articleNumber && (
                      <span className="article-number-badge">{sec.articleNumber}</span>
                    )}
                    <span className="page-indicator-pill">
                      {L('page')} {sec.page}
                    </span>
                  </div>
                  <span className="section-nav-title">{getLocalized(sec.title) as string}</span>
                  {sec.extractedHighlights && sec.extractedHighlights.length > 0 && (
                    <span className="ai-extracted-count">
                      {ICONS.sparkles}
                      <span>
                        {sec.extractedHighlights.length} {L('clauseHighlights')}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Paper Document Canvas */}
        <div className="tor-viewer-canvas">
          {currentSection ? (
            <div
              className="tor-paper-sheet"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            >
              {/* Document Official Header */}
              <div className="paper-official-header">
                <div className="paper-garuda-emblem">
                  <div className="emblem-circle">ครุฑ</div>
                  <span className="emblem-subtext">เอกสารราชการกรุงเทพมหานคร</span>
                </div>
                <div className="paper-header-meta">
                  <div className="paper-ref-number">
                    เลขที่ประกาศ: BMA-TOR-2026/0{project.externalId}
                  </div>
                  <div className="paper-publish-date">
                    วันประกาศ: {formatDate(project.publishDate, language)}
                  </div>
                </div>
              </div>

              <div className="paper-document-title">
                <h3>{getLocalized(project.title) as string}</h3>
                <p className="paper-dept-name">{getLocalized(project.department) as string}</p>
              </div>

              <div className="paper-divider" />

              {/* Current Section Content */}
              <div className="paper-section-body">
                <div className="paper-section-header">
                  {currentSection.articleNumber && (
                    <span className="paper-article-tag">{currentSection.articleNumber}</span>
                  )}
                  <h4 className="paper-section-heading">
                    {getLocalized(currentSection.title) as string}
                  </h4>
                  <span className="paper-page-watermark">
                    {L('page')} {currentSection.page} {L('of')} {sections.length}
                  </span>
                </div>

                <div className="paper-text-content">
                  {getLocalized(currentSection.content) as string}
                </div>

                {/* AI Extracted Highlight Callouts */}
                {currentSection.extractedHighlights &&
                  currentSection.extractedHighlights.length > 0 && (
                    <div className="paper-ai-highlights-box">
                      <div className="highlights-header">
                        {ICONS.sparkles}
                        <span>{L('clauseHighlights')}</span>
                        <span className="ai-badge-pill">{L('aiExtractedTag')}</span>
                      </div>
                      <ul className="highlights-list">
                        {currentSection.extractedHighlights.map((hl, hIdx) => (
                          <li key={hIdx} className="highlight-item">
                            <span className="highlight-marker">✓</span>
                            <span>{getLocalized(hl) as string}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* Paper Footer */}
              <div className="paper-footer">
                <span>กรุงเทพมหานคร — สำนักยุทธศาสตร์และประเมินผล</span>
                <span>หน้าที่ {currentSection.page}</span>
              </div>
            </div>
          ) : (
            <div className="empty-search-state">
              <p>ไม่พบข้อความที่ค้นหาในเอกสาร</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
