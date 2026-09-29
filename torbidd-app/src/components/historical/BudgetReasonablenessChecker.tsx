'use client';

import React, { useState, useMemo } from 'react';
import { Project, ProjectCategory } from '@/types/project';
import { HistoricalProject } from '@/types/historical';
import { useLanguage } from '@/contexts/LanguageContext';
import { evaluateBudgetReasonableness } from '@/lib/historicalAnalytics';
import { BenchmarkSpectrumBar } from '@/components/charts/HistoricalCharts';
import { formatBudget, formatBudgetFull } from '@/lib/utils';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/labels';

interface BudgetReasonablenessCheckerProps {
  projects: Project[];
  historicalData: HistoricalProject[];
}

export function BudgetReasonablenessChecker({
  projects,
  historicalData,
}: BudgetReasonablenessCheckerProps) {
  const { language, L, getLocalized } = useLanguage();

  const [mode, setMode] = useState<'select' | 'custom'>('select');
  const [selectedProjectId, setSelectedProjectId] = useState<number | string>(
    projects[0]?.externalId || 1,
  );

  // Custom input state
  const [customTitle, setCustomTitle] = useState('โครงการพัฒนาระบบคลาวด์ กทม.');
  const [customCategory, setCustomCategory] = useState<ProjectCategory>('Website');
  const [customBudget, setCustomBudget] = useState<number>(15_000_000);

  // Active evaluation parameters
  const { evalTitle, evalCategory, evalBudget } = useMemo(() => {
    if (mode === 'select') {
      const p = projects.find(
        (proj) => proj.externalId === Number(selectedProjectId) || proj._id === selectedProjectId,
      ) || projects[0];

      return {
        evalTitle: p ? (getLocalized(p.title) as string) : '',
        evalCategory: p?.category || 'Website',
        evalBudget: p?.budget || 10_000_000,
      };
    } else {
      return {
        evalTitle: customTitle || 'Custom Project',
        evalCategory: customCategory,
        evalBudget: customBudget > 0 ? customBudget : 1_000_000,
      };
    }
  }, [mode, selectedProjectId, projects, customTitle, customCategory, customBudget, getLocalized]);

  const evaluation = useMemo(() => {
    return evaluateBudgetReasonableness(evalBudget, evalCategory, historicalData);
  }, [evalBudget, evalCategory, historicalData]);

  // Find closest historical projects in same category
  const closestHistorical = useMemo(() => {
    const sameCat = historicalData.filter((d) => d.category === evalCategory);
    return [...sameCat]
      .sort((a, b) => Math.abs(a.budget - evalBudget) - Math.abs(b.budget - evalBudget))
      .slice(0, 3);
  }, [historicalData, evalCategory, evalBudget]);

  const statusBadgeClass =
    evaluation.status === 'high_outlier'
      ? 'badge-high'
      : evaluation.status === 'low_outlier'
        ? 'badge-low'
        : 'badge-normal';

  const statusText =
    evaluation.status === 'high_outlier'
      ? L('statusHighOutlier')
      : evaluation.status === 'low_outlier'
        ? L('statusLowOutlier')
        : L('statusReasonable');

  return (
    <div className="reasonableness-checker-card">
      <div className="reasonableness-header">
        <div>
          <h3 className="checker-title">{L('budgetReasonablenessTitle')}</h3>
          <p className="checker-subtitle">{L('budgetReasonablenessSub')}</p>
        </div>

        {/* Mode Toggle */}
        <div className="segmented-toggle">
          <button
            type="button"
            className={`toggle-btn ${mode === 'select' ? 'active' : ''}`}
            onClick={() => setMode('select')}
          >
            {L('selectExistingTab')}
          </button>
          <button
            type="button"
            className={`toggle-btn ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >
            {L('customInputTab')}
          </button>
        </div>
      </div>

      {/* Input Controls */}
      <div className="checker-controls-panel">
        {mode === 'select' ? (
          <div className="control-group">
            <label htmlFor="projectSelector" className="control-label">
              {L('selectProjectToEvaluate')}
            </label>
            <select
              id="projectSelector"
              className="control-input"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.externalId || p._id} value={p.externalId}>
                  #{p.externalId} {getLocalized(p.title) as string} —{' '}
                  {formatBudget(p.budget, language)} (
                  {CATEGORY_LABELS[language][p.category]})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="custom-input-grid">
            <div className="control-group">
              <label htmlFor="customTitleInput" className="control-label">
                {L('customTitle')}
              </label>
              <input
                id="customTitleInput"
                type="text"
                className="control-input"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Cloud Portal Project"
              />
            </div>

            <div className="control-group">
              <label htmlFor="customCatSelect" className="control-label">
                {L('filterCategory')}
              </label>
              <select
                id="customCatSelect"
                className="control-input"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as ProjectCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[language][c]}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label htmlFor="customBudgetInput" className="control-label">
                {L('customBudget')}
              </label>
              <input
                id="customBudgetInput"
                type="number"
                step="500000"
                min="100000"
                className="control-input"
                value={customBudget}
                onChange={(e) => setCustomBudget(Number(e.target.value))}
              />
              <div className="preset-budget-buttons">
                {[5_000_000, 12_000_000, 25_000_000, 45_000_000].map((b) => (
                  <button
                    key={b}
                    type="button"
                    className="preset-btn"
                    onClick={() => setCustomBudget(b)}
                  >
                    {formatBudget(b, language)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Results Banner */}
      <div className="evaluation-result-box">
        <div className="eval-result-header">
          <div className="eval-title-block">
            <span className="eval-badge-category">
              {CATEGORY_LABELS[language][evalCategory]}
            </span>
            <h4 className="eval-project-name">{evalTitle}</h4>
            <div className="eval-announced-budget">
              {L('budget')}: <strong>{formatBudgetFull(evalBudget, language)}</strong>
            </div>
          </div>

          <div className={`eval-status-badge ${statusBadgeClass}`}>
            <span className="status-dot" />
            <span className="status-label">{statusText}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="eval-metrics-grid">
          <div className="eval-metric-card">
            <span className="metric-label">{L('varianceVsMedian')}</span>
            <span
              className={`metric-value ${
                evaluation.variancePercentage > 20
                  ? 'text-error'
                  : evaluation.variancePercentage < -20
                    ? 'text-warning'
                    : 'text-success'
              }`}
            >
              {evaluation.variancePercentage > 0 ? '+' : ''}
              {evaluation.variancePercentage}%
            </span>
            <span className="metric-sub">
              {language === 'th' ? 'มัธยฐาน:' : 'Median:'}{' '}
              {formatBudget(evaluation.categoryStats.median, language)}
            </span>
          </div>

          <div className="eval-metric-card">
            <span className="metric-label">{L('percentileRankLabel')}</span>
            <span className="metric-value">{evaluation.percentileRank}%</span>
            <span className="metric-sub">
              {language === 'th'
                ? `อันดับในหมวด ${CATEGORY_LABELS[language][evalCategory]}`
                : `Rank in ${CATEGORY_LABELS[language][evalCategory]}`}
            </span>
          </div>

          <div className="eval-metric-card">
            <span className="metric-label">Z-Score</span>
            <span className="metric-value">{evaluation.zScore}σ</span>
            <span className="metric-sub">
              {language === 'th' ? 'ส่วนเบี่ยงเบนมาตรฐาน' : 'Standard deviations from mean'}
            </span>
          </div>

          <div className="eval-metric-card">
            <span className="metric-label">{L('recommendedRange')}</span>
            <span className="metric-value range-val">
              {formatBudget(evaluation.recommendedBudgetRange.min, language)} –{' '}
              {formatBudget(evaluation.recommendedBudgetRange.max, language)}
            </span>
            <span className="metric-sub">
              {language === 'th' ? 'ช่วงราคากลางปกติ' : 'Normal benchmark corridor'}
            </span>
          </div>
        </div>

        {/* Visual Benchmark Spectrum Gauge */}
        <div className="eval-spectrum-wrapper">
          <BenchmarkSpectrumBar
            stats={evaluation.categoryStats}
            currentBudget={evalBudget}
            status={evaluation.status}
          />
        </div>

        {/* Analytical Insights & Reasoning */}
        <div className="eval-insights-card">
          <div className="insights-header">
            <span className="insights-icon">💡</span>
            <h5 className="insights-title">{L('analyticalInsights')}</h5>
          </div>
          <p className="insights-text">
            {language === 'th' ? evaluation.reasoning.th : evaluation.reasoning.en}
          </p>
        </div>

        {/* Closest Historical Reference Projects */}
        <div className="closest-projects-section">
          <h5 className="closest-title">{L('closestPastProjects')}</h5>
          <div className="closest-projects-list">
            {closestHistorical.map((h, idx) => (
              <div key={h._id || idx} className="closest-project-item">
                <div className="closest-proj-info">
                  <span className="closest-proj-title">
                    {getLocalized(h.title) as string}
                  </span>
                  <span className="closest-proj-dept">
                    {getLocalized(h.department) as string} ·{' '}
                    {h.year + (language === 'th' ? 543 : 0)}
                  </span>
                </div>
                <div className="closest-proj-budget">
                  <strong>{formatBudget(h.budget, language)}</strong>
                  <span className="closest-variance">
                    {h.budget > evalBudget ? '+' : ''}
                    {(
                      ((h.budget - evalBudget) / evalBudget) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
