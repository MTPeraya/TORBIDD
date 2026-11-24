'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AgencyComparisonMetrics, HistoricalProject } from '@/types/historical';
import { Project, ProjectCategory } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { BudgetBarChart, ComparisonChart } from '@/components/charts/HistoricalCharts';
import { BudgetReasonablenessChecker } from '@/components/historical/BudgetReasonablenessChecker';
import { SimilarProcurementEstimator } from '@/components/historical/SimilarProcurementEstimator';
import { AgencyComparisonView } from '@/components/historical/AgencyComparisonView';
import { aggregateAgencyMetrics } from '@/lib/historicalAnalytics';
import { formatBudget, formatBudgetFull, getCategoryAvg, getOutlierStatus } from '@/lib/utils';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/labels';
import { translateProcurementType } from '@/services/translation/dictionary';
import { fetchPublicProjects } from '@/lib/public-project-cache';
import { ICONS } from '@/components/ui/Icons';

export default function HistoricalPage() {
  const router = useRouter();
  const { language, L, getLocalized } = useLanguage();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [historicalData, setHistoricalData] = useState<HistoricalProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [apiAgencyMetrics, setApiAgencyMetrics] = useState<AgencyComparisonMetrics[] | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'benchmark' | 'similar' | 'agencies' | 'explorer'>(
    'benchmark',
  );

  // Table & Chart Filters
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | ''>('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [kpiModalProject, setKpiModalProject] = useState<HistoricalProject | null>(null);

  // Escape key handler for KPI modal
  useEffect(() => {
    if (!kpiModalProject) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKpiModalProject(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [kpiModalProject]);

  // Client-side auth guard (middleware is the primary guard)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?from=/historical');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    fetch('/api/historical?stats=true&agencies=true')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setHistoricalData(json.data);
        }
        if (json.agencies && Array.isArray(json.agencies)) {
          setApiAgencyMetrics(json.agencies);
        }
      })
      .catch(() => {});

    fetchPublicProjects<{ data?: Project[] }>('/api/projects?limit=1000&all=true')
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setProjects(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // Compute agency metrics reactively
  const agencyMetrics = useMemo(() => {
    if (apiAgencyMetrics && apiAgencyMetrics.length > 0) {
      return apiAgencyMetrics;
    }
    return aggregateAgencyMetrics(historicalData, projects);
  }, [apiAgencyMetrics, historicalData, projects]);

  const departments = useMemo(() => {
    return Array.from(
      new Set(historicalData.map((d) => getLocalized(d.department) as string)),
    );
  }, [historicalData, getLocalized]);

  const years = useMemo(() => {
    return Array.from(new Set(historicalData.map((d) => d.year))).sort((a, b) => b - a);
  }, [historicalData]);

  // Overall KPI Statistics
  const kpiStats = useMemo(() => {
    const totalSpend = historicalData.reduce((sum, d) => sum + d.budget, 0);
    const avgSpend = historicalData.length > 0 ? totalSpend / historicalData.length : 0;
    const maxBudget = historicalData.reduce((max, d) => (d.budget > max ? d.budget : max), 0);
    const maxBudgetProject = historicalData.reduce<HistoricalProject | null>(
      (max, d) => (!max || d.budget > max.budget ? d : max),
      null,
    );

    // Calculate outlier rate using canonical corridor
    let outlierCount = 0;
    historicalData.forEach((d) => {
      const catAvg = getCategoryAvg(d.category, historicalData);
      const status = getOutlierStatus(d.budget, catAvg);
      if (status !== 'normal') outlierCount++;
    });
    const outlierRate =
      historicalData.length > 0 ? Math.round((outlierCount / historicalData.length) * 100) : 0;

    return { totalSpend, avgSpend, maxBudget, maxBudgetProject, outlierRate };
  }, [historicalData]);

  const filteredHistorical = useMemo(() => {
    let result = [...historicalData];

    if (selectedCategory) {
      result = result.filter((d) => d.category === selectedCategory);
    }

    if (selectedDept) {
      result = result.filter(
        (d) =>
          (getLocalized(d.department) as string) === selectedDept ||
          d.department.th === selectedDept ||
          d.department.en === selectedDept,
      );
    }

    if (selectedYear) {
      result = result.filter((d) => d.year === parseInt(selectedYear, 10));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.title.th.toLowerCase().includes(q) ||
          d.title.en.toLowerCase().includes(q) ||
          d.department.th.toLowerCase().includes(q) ||
          d.department.en.toLowerCase().includes(q) ||
          (d.description?.th && d.description.th.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [historicalData, selectedCategory, selectedDept, selectedYear, searchQuery, getLocalized]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Project Title (TH)',
      'Project Title (EN)',
      'Department (TH)',
      'Department (EN)',
      'Category',
      'Fiscal Year',
      'Budget (THB)',
      'Procurement Type',
      'Outlier Status',
    ];

    const rows = filteredHistorical.map((d) => {
      const catAvg = getCategoryAvg(d.category, historicalData);
      const outlierStatus = getOutlierStatus(d.budget, catAvg);
      return [
        `"${d.title.th.replace(/"/g, '""')}"`,
        `"${d.title.en.replace(/"/g, '""')}"`,
        `"${d.department.th.replace(/"/g, '""')}"`,
        `"${d.department.en.replace(/"/g, '""')}"`,
        `"${d.category}"`,
        d.year,
        d.budget,
        `"${d.procurementType || 'e-Bidding'}"`,
        `"${outlierStatus}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `BMA_Software_Procurement_Historical_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Show nothing while auth is loading to avoid flicker
  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="page-content hist-studio-page">
      {/* Studio Header & Meta Bar */}
      <div className="hist-studio-header anim-fade-up">
        <div className="hist-header-left">
          <div className="hist-meta-pill">
            <span className="hist-meta-dot pulse"></span>
            <span>{L('histLastUpdatedBadge')}</span>
          </div>
          <h1 className="page-title">{L('historicalTitle')}</h1>
          <p className="page-subtitle">{L('historicalSub')}</p>
        </div>
        <div className="hist-header-actions">
          <button
            type="button"
            className="btn-export-csv"
            onClick={handleExportCSV}
            title={L('exportCSV')}
          >
            📥 {L('exportCSV')}
          </button>
        </div>
      </div>

      {/* Top Level KPI Stat Cards */}
      <div className="historical-kpi-grid anim-fade-up">
        <div className="kpi-card hist-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">{L('kpiTotalHistoricalSpend')}</span>
            <span className="kpi-badge-pill primary">{L('kpiPillTotalSpend')}</span>
          </div>
          <strong className="kpi-value text-primary">
            {formatBudget(kpiStats.totalSpend, language)}
          </strong>
          <span className="kpi-sub">
            {historicalData.length} {language === 'th' ? 'โครงการที่จัดซื้อแล้ว' : 'completed tenders'}
          </span>
        </div>

        <div className="kpi-card hist-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">{L('kpiAvgProjectSize')}</span>
            <span className="kpi-badge-pill neutral">{L('kpiPillMeanBenchmark')}</span>
          </div>
          <strong className="kpi-value">
            {formatBudget(kpiStats.avgSpend, language)}
          </strong>
          <span className="kpi-sub">
            {language === 'th' ? 'ราคากลางเฉลี่ยต่อสัญญา' : 'Average budget per award'}
          </span>
        </div>

        <div
          className={`kpi-card hist-kpi-card ${kpiStats.maxBudgetProject ? 'clickable' : ''}`}
          onClick={() => {
            if (kpiStats.maxBudgetProject) {
              setKpiModalProject(kpiStats.maxBudgetProject);
            }
          }}
          role={kpiStats.maxBudgetProject ? 'button' : undefined}
          tabIndex={kpiStats.maxBudgetProject ? 0 : undefined}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && kpiStats.maxBudgetProject) {
              e.preventDefault();
              setKpiModalProject(kpiStats.maxBudgetProject);
            }
          }}
          title={
            kpiStats.maxBudgetProject
              ? language === 'th'
                ? 'คลิกเพื่อดูรายละเอียดโครงการมูลค่าสูงสุด'
                : 'Click to view largest recorded tender'
              : undefined
          }
        >
          <div className="kpi-card-header">
            <span className="kpi-label">{L('kpiHighestTender')}</span>
            <span className="kpi-badge-pill warning">{L('kpiPillMaxAward')} 👁️</span>
          </div>
          <strong className="kpi-value text-warning">
            {formatBudget(kpiStats.maxBudget, language)}
          </strong>
          <span className="kpi-sub">
            {language === 'th'
              ? 'โครงการสเกลใหญ่สุด (คลิกเพื่อดูรายละเอียด 👁️)'
              : 'Largest recorded procurement (Click to view 👁️)'}
          </span>
        </div>

        <div className="kpi-card hist-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">{L('kpiOutlierRate')}</span>
            <span className="kpi-badge-pill danger">{L('kpiPillCorridor')}</span>
          </div>
          <strong className="kpi-value text-error">
            {kpiStats.outlierRate}%
          </strong>
          <span className="kpi-sub">
            {language === 'th' ? 'โครงการที่ราคาสูง/ต่ำกว่าเกณฑ์' : 'Above or below normal corridors'}
          </span>
        </div>
      </div>

      {/* High-Clarity Segmented Studio Tab Navigation */}
      <div className="historical-segmented-tabs anim-fade-up">
        <button
          type="button"
          className={`hist-tab-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
          onClick={() => setActiveTab('benchmark')}
        >
          <span className="hist-tab-icon">{ICONS.chart}</span>
          <span>{L('tabBenchmark')}</span>
        </button>
        <button
          type="button"
          className={`hist-tab-btn ${activeTab === 'similar' ? 'active' : ''}`}
          onClick={() => setActiveTab('similar')}
        >
          <span className="hist-tab-icon">{ICONS.search}</span>
          <span>{L('tabSimilar')}</span>
        </button>
        <button
          type="button"
          className={`hist-tab-btn ${activeTab === 'agencies' ? 'active' : ''}`}
          onClick={() => setActiveTab('agencies')}
        >
          <span className="hist-tab-icon">{ICONS.dashboard}</span>
          <span>{L('tabAgencies')}</span>
        </button>
        <button
          type="button"
          className={`hist-tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          <span className="hist-tab-icon">{ICONS.file}</span>
          <span>{L('tabExplorer')}</span>
          <span className="hist-tab-count">{filteredHistorical.length}</span>
        </button>
      </div>

      {/* TAB 1: Benchmark & Outlier Analysis — always mounted, hidden via CSS */}
      <div className="tab-pane-content" style={{ display: activeTab === 'benchmark' ? 'block' : 'none' }}>
          {/* Interactive Announced Budget Reasonableness Checker */}
          <BudgetReasonablenessChecker projects={projects} historicalData={historicalData} />

          {/* Chart 1: Historical Budgets Bar Chart */}
          <div className="chart-container" style={{ marginTop: 28 }}>
            <div className="chart-header">
              <h2 className="chart-title">{L('budgetChart')}</h2>
              <div className="chart-filters">
                <select
                  className="filter-select"
                  id="histFilterCategory"
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

                <select
                  className="filter-select"
                  id="histFilterDept"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="">{L('allDepts')}</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <select
                  className="filter-select"
                  id="histFilterYear"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <option value="">{L('allYears')}</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y + (language === 'th' ? 543 : 0)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <BudgetBarChart data={filteredHistorical} />
          </div>

          {/* Chart 2: Current Projects vs Historical Average */}
          <div className="chart-container" style={{ marginTop: 28 }}>
            <h2
              className="chart-title"
              style={{
                marginBottom: 16,
                borderBottom: '1px solid var(--gray-200)',
                paddingBottom: 8,
              }}
            >
              {L('currentProjects')}
            </h2>
            <ComparisonChart projects={projects} />
          </div>
        </div>

      {/* TAB 2: Similar Procurements & Scope Estimator — always mounted, hidden via CSS */}
      <div className="tab-pane-content" style={{ display: activeTab === 'similar' ? 'block' : 'none' }}>
          <SimilarProcurementEstimator projects={projects} historicalData={historicalData} />
        </div>

      {/* TAB 3: Cross-Agency Budget Comparison — always mounted, hidden via CSS */}
      <div className="tab-pane-content" style={{ display: activeTab === 'agencies' ? 'block' : 'none' }}>
          <AgencyComparisonView agencyMetrics={agencyMetrics} />
        </div>

      {/* TAB 4: Historical Data Explorer — always mounted, hidden via CSS */}
      <div className="tab-pane-content" style={{ display: activeTab === 'explorer' ? 'block' : 'none' }}>
          <div className="chart-container hist-explorer-container">
            <div className="chart-header hist-explorer-header">
              <div>
                <h2 className="chart-title">{L('historicalData')}</h2>
                <span className="text-muted-sm">
                  {language === 'th'
                    ? `พบข้อมูลจัดซื้อจัดจ้างย้อนหลัง ${filteredHistorical.length} รายการ`
                    : `Showing ${filteredHistorical.length} historical records`}
                </span>
              </div>

              <div className="explorer-controls">
                <input
                  type="text"
                  className="filter-input-search"
                  placeholder={language === 'th' ? 'ค้นหาชื่อโครงการ, หน่วยงาน...' : 'Search records...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <select
                  className="filter-select"
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

                <select
                  className="filter-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="">{L('allDepts')}</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn-export-csv"
                  onClick={handleExportCSV}
                  title={L('exportCSV')}
                >
                  📥 {L('exportCSV')}
                </button>
              </div>
            </div>

            <div className="historical-table-wrapper">
              <table className="historical-table">
                <thead>
                  <tr>
                    <th>{L('projectName')}</th>
                    <th>{L('department')}</th>
                    <th>{L('category')}</th>
                    <th>{L('year')}</th>
                    <th>{L('budget')}</th>
                    <th>{L('budgetAnalysis')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistorical.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: 'center',
                          padding: '48px 16px',
                          color: 'var(--text-secondary)',
                          fontSize: '0.9rem',
                        }}
                      >
                        {language === 'th'
                          ? 'ไม่พบข้อมูลประวัติโครงการจัดซื้อจัดจ้างที่ตรงกับเงื่อนไข'
                          : 'No historical procurement records match the criteria'}
                      </td>
                    </tr>
                  ) : (
                    filteredHistorical.map((d, index) => {
                      const catAvg = getCategoryAvg(d.category, historicalData);
                      const outlierStatus = getOutlierStatus(d.budget, catAvg);
                      const rowKey = d._id || String(index);
                      const isExpanded = expandedRowId === rowKey;

                      let outlierText = L('outlierNormal');
                      if (outlierStatus === 'high') outlierText = L('outlierHigh');
                      if (outlierStatus === 'low') outlierText = L('outlierLow');

                      return (
                        <React.Fragment key={rowKey}>
                          <tr
                            className={`explorer-row ${isExpanded ? 'row-expanded' : ''}`}
                            onClick={() => setExpandedRowId(isExpanded ? null : rowKey)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setExpandedRowId(isExpanded ? null : rowKey);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-expanded={isExpanded}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{ fontWeight: 600, color: 'var(--gray-950)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--primary-600)', transition: 'transform 0.2s' }}>
                                  {isExpanded ? '▼' : '►'}
                                </span>
                                <span>{getLocalized(d.title) as string}</span>
                              </div>
                            </td>
                            <td>{getLocalized(d.department) as string}</td>
                            <td>
                              <span className="tag category">
                                {CATEGORY_LABELS[language][d.category]}
                              </span>
                            </td>
                            <td>{d.year + (language === 'th' ? 543 : 0)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--gray-950)' }}>
                              {formatBudgetFull(d.budget, language)}
                            </td>
                            <td>
                              <span className={`outlier-badge ${outlierStatus}`}>{outlierText}</span>
                            </td>
                            <td>
                              <span className="expand-indicator">
                                {isExpanded ? (language === 'th' ? 'ย่อ' : 'Collapse') : (language === 'th' ? 'ขยาย' : 'Expand')}
                              </span>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="expanded-details-row">
                              <td colSpan={7}>
                                <div className="row-expansion-content">
                                  {d.description && (
                                    <div className="expansion-block">
                                      <strong>{L('projectDesc')}:</strong>{' '}
                                      {getLocalized(d.description) as string}
                                    </div>
                                  )}

                                  {d.awardedVendor && (
                                    <div className="expansion-block">
                                      <strong>{L('awardedVendorLabel')}:</strong>{' '}
                                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                                        {getLocalized(d.awardedVendor) as string}
                                      </span>{' '}
                                      ({(language === 'en' ? translateProcurementType(d.procurementType) : d.procurementType) || 'e-Bidding'})
                                    </div>
                                  )}

                                  {d.scope && (
                                    <div className="expansion-block">
                                      <strong>{L('scopeOfWork')}:</strong>
                                      <ul className="expansion-scope-list">
                                        {(d.scope[language] || d.scope.th || []).map((s, si) => (
                                          <li key={si}>✓ {s}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <span className="analysis-disclaimer" style={{ marginTop: 16 }}>
              {L('budgetDisclaimer')}
            </span>
          </div>
        </div>

      {/* Largest Tender Inspector Modal from KPI Card */}
      {kpiModalProject && (
        <div className="modal-backdrop" onClick={() => setKpiModalProject(null)}>
          <div
            className="modal-content-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kpi-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="modal-category">
                  {kpiModalProject.category
                    ? CATEGORY_LABELS[language][kpiModalProject.category]
                    : L('kpiHighestTender')}{' '}
                  · {kpiModalProject.year + (language === 'th' ? 543 : 0)}
                </span>
                <h3 id="kpi-modal-title" className="modal-title">{getLocalized(kpiModalProject.title) as string}</h3>
                <span className="modal-dept">
                  {kpiModalProject.department ? (getLocalized(kpiModalProject.department) as string) : ''}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setKpiModalProject(null)}
                title="Close modal"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-meta-grid">
                <div className="meta-card">
                  <span className="meta-label">{L('budget')}</span>
                  <strong className="meta-value text-primary">
                    {formatBudgetFull(kpiModalProject.budget, language)}
                  </strong>
                </div>
                <div className="meta-card">
                  <span className="meta-label">
                    {language === 'th' ? 'วิธีการจัดหา' : 'Procurement Type'}
                  </span>
                  <strong className="meta-value">
                    {(language === 'en' ? translateProcurementType(kpiModalProject.procurementType) : kpiModalProject.procurementType) || 'e-Bidding'}
                  </strong>
                </div>
                {kpiModalProject.awardedVendor && (
                  <div className="meta-card">
                    <span className="meta-label">{L('awardedVendor')}</span>
                    <strong className="meta-value">
                      {getLocalized(kpiModalProject.awardedVendor) as string}
                    </strong>
                  </div>
                )}
              </div>

              {kpiModalProject.description && (
                <div className="modal-section">
                  <h4 className="section-subtitle">{L('projectDesc')}</h4>
                  <p className="modal-desc-text">
                    {getLocalized(kpiModalProject.description) as string}
                  </p>
                </div>
              )}

              <div className="modal-section">
                <h4 className="section-subtitle">{L('scopeOfWork')}</h4>
                <ul className="modal-scope-list">
                  {kpiModalProject.scope &&
                  ((kpiModalProject.scope[language] && kpiModalProject.scope[language].length > 0) ||
                    (kpiModalProject.scope.th && kpiModalProject.scope.th.length > 0)) ? (
                    (kpiModalProject.scope[language] || kpiModalProject.scope.th || []).map((item, idx) => (
                      <li key={idx} className="modal-scope-item">
                        <span className="bullet-check">✓</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li>
                      {language === 'th'
                        ? 'ไม่มีข้อมูลขอบเขตงานโดยละเอียดสำหรับโครงการนี้'
                        : 'No detailed scope records available for this project'}
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setKpiModalProject(null)}
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
