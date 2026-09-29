'use client';

// =============================================================================
// components/procurement-list/ProcurementList.tsx
// (Supports Issue #156: Procurement Search & Filter Integration UI)
// =============================================================================

import React from 'react';
import { Project } from '@/types/project';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

interface ProcurementListProps {
  projects: Project[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClearFilters?: () => void;
  totalCount: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (newPage: number) => void;
}

export function ProcurementList({
  projects,
  isLoading = false,
  error = null,
  onRetry,
  onClearFilters,
  totalCount,
  page = 1,
  totalPages = 1,
  onPageChange,
}: ProcurementListProps) {
  const { L } = useLanguage();

  // 1. Error State
  if (error) {
    return (
      <div className="procurement-error-state" role="alert">
        <div className="procurement-state-icon error-icon" aria-hidden="true">
          ⚠️
        </div>
        <h3 className="procurement-state-title">{L('queryErrorTitle')}</h3>
        <p className="procurement-state-desc">{error || L('queryErrorDesc')}</p>
        {onRetry && (
          <button
            type="button"
            className="procurement-retry-btn"
            onClick={onRetry}
            id="procurement-retry-btn"
          >
            {L('retry')}
          </button>
        )}
      </div>
    );
  }

  // 2. Loading Skeleton State
  if (isLoading) {
    return (
      <div className="procurement-list-container">
        <div className="procurement-list-header">
          <div className="skeleton-line skeleton-count-placeholder" />
        </div>
        <div className="projects-grid" aria-busy="true" aria-label="Loading opportunities">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="project-card-skeleton">
              <div className="skeleton-line skeleton-tag" />
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-subtitle" />
              <div className="skeleton-budget-box">
                <div className="skeleton-line skeleton-budget" />
              </div>
              <div className="skeleton-footer">
                <div className="skeleton-line skeleton-date" />
                <div className="skeleton-line skeleton-btn" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. Empty State
  if (projects.length === 0) {
    return (
      <div className="procurement-empty-state" role="region" aria-label="Empty results">
        <div className="procurement-state-icon" aria-hidden="true">
          {ICONS.search}
        </div>
        <h3 className="procurement-state-title">{L('noResultsFound')}</h3>
        <p className="procurement-state-desc">{L('noResultsSuggestion')}</p>
        {onClearFilters && (
          <button
            type="button"
            className="procurement-clear-cta-btn"
            onClick={onClearFilters}
            id="empty-state-clear-btn"
          >
            {L('clearAll')}
          </button>
        )}
      </div>
    );
  }

  // 4. Results List & Pagination
  return (
    <div className="procurement-list-container">
      {/* Result counter header */}
      <div className="procurement-list-header">
        <span className="procurement-result-counter" id="procurement-result-counter">
          {L('showingResults')} <strong>{projects.length}</strong> {L('ofTotalResults')}{' '}
          <strong>{totalCount}</strong> {L('items')}
        </span>
      </div>

      {/* Projects Grid */}
      <div className="projects-grid" id="procurements-results-grid">
        {projects.map((project) => (
          <ProjectCard key={project.externalId} project={project} />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && onPageChange && (
        <nav
          className="procurement-pagination-nav"
          role="navigation"
          aria-label="Pagination Navigation"
        >
          <button
            type="button"
            className="pagination-btn pagination-prev"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label={L('pagePrev')}
          >
            ← {L('pagePrev')}
          </button>

          <div className="pagination-pages-list">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              // Show first, last, and window around current page
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= page - 2 && pageNum <= page + 2)
              ) {
                return (
                  <button
                    key={pageNum}
                    type="button"
                    className={`pagination-page-number ${pageNum === page ? 'active' : ''}`}
                    onClick={() => onPageChange(pageNum)}
                    aria-current={pageNum === page ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              } else if (pageNum === page - 3 || pageNum === page + 3) {
                return (
                  <span key={pageNum} className="pagination-ellipsis">
                    …
                  </span>
                );
              }
              return null;
            })}
          </div>

          <button
            type="button"
            className="pagination-btn pagination-next"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label={L('pageNext')}
          >
            {L('pageNext')} →
          </button>
        </nav>
      )}
    </div>
  );
}
