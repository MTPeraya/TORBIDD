'use client';

import React, { useState, useMemo } from 'react';
import { Project, ProjectCategory } from '@/types/project';
import { HistoricalProject } from '@/types/historical';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  findSimilarHistoricalProcurements,
  estimateScopePrice,
} from '@/lib/historicalAnalytics';
import { formatBudget, formatBudgetFull } from '@/lib/utils';
import { CATEGORY_LABELS, CATEGORIES } from '@/lib/labels';

interface SimilarProcurementEstimatorProps {
  projects: Project[];
  historicalData: HistoricalProject[];
}

export function SimilarProcurementEstimator({
  projects,
  historicalData,
}: SimilarProcurementEstimatorProps) {
  const { language, L, getLocalized } = useLanguage();

  const [selectedProjectId, setSelectedProjectId] = useState<number | string>(
    projects[0]?.externalId || 1,
  );
  const [keywordFilter, setKeywordFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | ''>('');
  const [modalProject, setModalProject] = useState<HistoricalProject | null>(null);

  // Active target project
  const targetProject = useMemo(() => {
    return (
      projects.find(
        (p) => p.externalId === Number(selectedProjectId) || p._id === selectedProjectId,
      ) || projects[0]
    );
  }, [projects, selectedProjectId]);

  // Filter pool of historical data if category selected
  const historicalPool = useMemo(() => {
    let pool = historicalData;
    if (selectedCategory) {
      pool = pool.filter((h) => h.category === selectedCategory);
    }
    return pool;
  }, [historicalData, selectedCategory]);

  // Find similar items
  const similarItems = useMemo(() => {
    if (!targetProject) return [];
    return findSimilarHistoricalProcurements(
      {
        title: targetProject.title,
        category: selectedCategory || targetProject.category,
        budget: targetProject.budget,
        description: keywordFilter
          ? `${targetProject.description.th} ${keywordFilter}`
          : targetProject.description,
      },
      historicalPool,
      4,
    );
  }, [targetProject, selectedCategory, keywordFilter, historicalPool]);

  // Cost estimation breakdown
  const costEstimation = useMemo(() => {
    return estimateScopePrice(similarItems, targetProject?.budget);
  }, [similarItems, targetProject]);

  // Primary top match for side-by-side comparison
  const topMatch = similarItems[0]?.project;

  return (
    <div className="similar-estimator-wrapper">
      <div className="estimator-header">
        <div>
          <h3 className="estimator-title">{L('similarProcurementsTitle')}</h3>
          <p className="estimator-subtitle">{L('similarProcurementsSub')}</p>
        </div>
      </div>

      {/* Filter and Selection Toolbar */}
      <div className="estimator-toolbar">
        <div className="toolbar-group">
          <label htmlFor="targetProjectSelect" className="control-label">
            {L('selectProjectToEvaluate')}
          </label>
          <select
            id="targetProjectSelect"
            className="control-input"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.externalId || p._id} value={p.externalId}>
                #{p.externalId} {getLocalized(p.title) as string} ({formatBudget(p.budget, language)})
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-group">
          <label htmlFor="categoryFilter" className="control-label">
            {L('filterCategory')}
          </label>
          <select
            id="categoryFilter"
            className="control-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ProjectCategory | '')}
          >
            <option value="">{L('allCategories')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[language][c]}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-group">
          <label htmlFor="keywordSearch" className="control-label">
            {language === 'th' ? 'ค้นหาคำสำคัญขอบเขตงาน' : 'Search Scope Keywords'}
          </label>
          <input
            id="keywordSearch"
            type="text"
            className="control-input"
            placeholder="e.g. CCTV, GIS, Cloud, LMS, API..."
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Expected Pricing & Work Packages Estimate Box */}
      <div className="pricing-estimate-card">
        <div className="pricing-card-header">
          <div>
            <h4 className="card-title-highlight">{L('pricingEstimationTitle')}</h4>
            <span className="card-subtitle-small">
              {language === 'th'
                ? `ประเมินจากข้อมูลโครงการย้อนหลังที่คล้ายคลึงกัน ${costEstimation.similarProjectsCount} รายการ`
                : `Benchmarked against ${costEstimation.similarProjectsCount} similar historical public procurements`}
            </span>
          </div>

          <div className="pricing-stat-chips">
            <div className="chip-box">
              <span className="chip-label">Min</span>
              <span className="chip-val">{formatBudget(costEstimation.estimatedTotalMin, language)}</span>
            </div>
            <div className="chip-box highlight">
              <span className="chip-label">{language === 'th' ? 'ราคาคาดการณ์ (Median)' : 'Median'}</span>
              <span className="chip-val">{formatBudget(costEstimation.estimatedTotalMedian, language)}</span>
            </div>
            <div className="chip-box">
              <span className="chip-label">Max</span>
              <span className="chip-val">{formatBudget(costEstimation.estimatedTotalMax, language)}</span>
            </div>
          </div>
        </div>

        {/* Work Package Progress Bars */}
        <div className="work-packages-grid">
          {costEstimation.workPackages.map((wp, i) => (
            <div key={i} className="package-item">
              <div className="package-info">
                <span className="package-name">{getLocalized(wp.name) as string}</span>
                <span className="package-budget">
                  {formatBudget(wp.estimatedAmount, language)} ({wp.percentage}%)
                </span>
              </div>
              <div className="package-bar-track">
                <div className="package-bar-fill" style={{ width: `${wp.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-Side Scope Deliverables Comparison */}
      {topMatch && targetProject && (
        <div className="scope-comparison-panel">
          <h4 className="panel-title">{L('scopeComparisonTitle')}</h4>
          <div className="scope-split-grid">
            {/* Target Project Scope */}
            <div className="scope-column target">
              <div className="column-header">
                <span className="tag-source">{L('targetScope')}</span>
                <h5 className="proj-heading">{getLocalized(targetProject.title) as string}</h5>
                <span className="proj-cost">
                  {L('budget')}: {formatBudgetFull(targetProject.budget, language)}
                </span>
              </div>
              <ul className="scope-list">
                {(targetProject.scope[language] || targetProject.scope.th || []).map((item, idx) => (
                  <li key={idx} className="scope-bullet">
                    <span className="bullet-icon">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Top Historical Matched Scope */}
            <div className="scope-column historical">
              <div className="column-header">
                <div className="flex-between">
                  <span className="tag-source historical-tag">{L('historicalScope')}</span>
                  <span className="similarity-pill">
                    {similarItems[0].similarityScore}% {L('similarityMatch')}
                  </span>
                </div>
                <h5 className="proj-heading">{getLocalized(topMatch.title) as string}</h5>
                <span className="proj-cost">
                  {L('budget')}: {formatBudgetFull(topMatch.budget, language)} (
                  {topMatch.year + (language === 'th' ? 543 : 0)})
                </span>
              </div>
              <ul className="scope-list">
                {topMatch.scope ? (
                  (topMatch.scope[language] || topMatch.scope.th || []).map((item, idx) => (
                    <li key={idx} className="scope-bullet">
                      <span className="bullet-icon">✦</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="scope-bullet empty">
                    {language === 'th'
                      ? 'ไม่มีข้อมูลขอบเขตงานโดยละเอียดสำหรับรายการนี้'
                      : 'No detailed scope records available for this item'}
                  </li>
                )}
              </ul>

              <button
                type="button"
                className="btn-view-full-scope"
                onClick={() => setModalProject(topMatch)}
              >
                {L('viewFullScopeDetails')} ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matched Historical Procurements Cards Grid */}
      <div className="matched-procurements-section">
        <h4 className="section-title">
          {language === 'th'
            ? `โครงการในอดีตที่ตรวจพบ (${similarItems.length} รายการ)`
            : `Detected Historical Procurements (${similarItems.length} records)`}
        </h4>

        <div className="similar-cards-grid">
          {similarItems.map((item, index) => {
            const h = item.project;
            return (
              <div key={h._id || index} className="similar-card">
                <div className="card-top">
                  <span className="cat-tag">{CATEGORY_LABELS[language][h.category]}</span>
                  <span className="similarity-badge">
                    {item.similarityScore}% {L('similarityMatch')}
                  </span>
                </div>

                <h5 className="card-proj-title">{getLocalized(h.title) as string}</h5>
                <span className="card-dept">
                  {getLocalized(h.department) as string} · {h.year + (language === 'th' ? 543 : 0)}
                </span>

                <div className="card-budget-row">
                  <div>
                    <span className="label-sm">{L('budget')}</span>
                    <div className="budget-val">{formatBudget(h.budget, language)}</div>
                  </div>
                  {targetProject && (
                    <span
                      className={`diff-tag ${
                        item.budgetDifference > 0 ? 'higher' : 'lower'
                      }`}
                    >
                      {item.budgetDifference > 0 ? '+' : ''}
                      {(
                        ((h.budget - targetProject.budget) / targetProject.budget) *
                        100
                      ).toFixed(0)}
                      %
                    </span>
                  )}
                </div>

                {item.matchedKeywords.length > 0 && (
                  <div className="matched-keywords-wrapper">
                    <span className="kw-label">{L('matchedKeywordsLabel')}:</span>
                    <div className="kw-chips">
                      {item.matchedKeywords.map((kw, ki) => (
                        <span key={ki} className="kw-chip">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="card-inspect-btn"
                  onClick={() => setModalProject(h)}
                >
                  {L('viewFullScopeDetails')} →
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scope Inspector Modal */}
      {modalProject && (
        <div className="modal-backdrop" onClick={() => setModalProject(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-category">
                  {CATEGORY_LABELS[language][modalProject.category]} ·{' '}
                  {modalProject.year + (language === 'th' ? 543 : 0)}
                </span>
                <h3 className="modal-title">{getLocalized(modalProject.title) as string}</h3>
                <span className="modal-dept">{getLocalized(modalProject.department) as string}</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalProject(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-meta-grid">
                <div className="meta-box">
                  <span className="meta-label">{L('budget')}</span>
                  <strong className="meta-value text-primary">
                    {formatBudgetFull(modalProject.budget, language)}
                  </strong>
                </div>
                <div className="meta-box">
                  <span className="meta-label">{L('procurementType')}</span>
                  <strong className="meta-value">{modalProject.procurementType || 'e-Bidding'}</strong>
                </div>
                {modalProject.awardedVendor && (
                  <div className="meta-box full-width">
                    <span className="meta-label">{L('awardedVendorLabel')}</span>
                    <strong className="meta-value text-success">
                      {getLocalized(modalProject.awardedVendor) as string}
                    </strong>
                  </div>
                )}
              </div>

              {modalProject.description && (
                <div className="modal-section">
                  <h4 className="section-subtitle">{L('projectDesc')}</h4>
                  <p className="modal-desc-text">
                    {getLocalized(modalProject.description) as string}
                  </p>
                </div>
              )}

              <div className="modal-section">
                <h4 className="section-subtitle">{L('scopeOfWork')}</h4>
                <ul className="modal-scope-list">
                  {modalProject.scope ? (
                    (modalProject.scope[language] || modalProject.scope.th || []).map((item, idx) => (
                      <li key={idx} className="modal-scope-item">
                        <span className="bullet-check">✓</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li>{language === 'th' ? 'ไม่มีข้อมูลขอบเขตงาน' : 'No scope data recorded'}</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setModalProject(null)}
              >
                {L('closeModal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
