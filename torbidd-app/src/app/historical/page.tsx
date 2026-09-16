'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AgencyComparisonMetrics, HistoricalProject } from '@/types/historical';
import { Project, ProjectCategory } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { BudgetBarChart, ComparisonChart } from '@/components/charts/HistoricalCharts';
import { BudgetReasonablenessChecker } from '@/components/historical/BudgetReasonablenessChecker';
import { SimilarProcurementEstimator } from '@/components/historical/SimilarProcurementEstimator';
import { AgencyComparisonView } from '@/components/historical/AgencyComparisonView';
import { aggregateAgencyMetrics } from '@/lib/historicalAnalytics';
import { formatBudget, formatBudgetFull, getCategoryAvg, getOutlierStatus } from '@/lib/utils';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/labels';
import { INITIAL_HISTORICAL, INITIAL_PROJECTS } from '@/lib/initialData';

export default function HistoricalPage() {
  const { language, L, getLocalized } = useLanguage();
  const [historicalData, setHistoricalData] = useState<HistoricalProject[]>(INITIAL_HISTORICAL);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
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

  useEffect(() => {
    fetch('/api/historical?stats=true&agencies=true')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setHistoricalData(json.data);
        }
        if (json.agencies && Array.isArray(json.agencies) && json.agencies.length > 0) {
          setApiAgencyMetrics(json.agencies);
        }
      })
      .catch(() => {});

    fetch('/api/projects')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
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

    // Calculate outlier rate
    let outlierCount = 0;
    historicalData.forEach((d) => {
      const catAvg = getCategoryAvg(d.category, historicalData);
      const status = getOutlierStatus(d.budget, catAvg);
      if (status !== 'normal') outlierCount++;
    });
    const outlierRate =
      historicalData.length > 0 ? Math.round((outlierCount / historicalData.length) * 100) : 0;

    return { totalSpend, avgSpend, maxBudget, outlierRate };
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

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">{L('historicalTitle')}</h1>
        <p className="page-subtitle">{L('historicalSub')}</p>
      </div>

      {/* Top Level KPI Stat Cards */}
      <div className="historical-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">{L('kpiTotalHistoricalSpend')}</span>
          <strong className="kpi-value text-primary">
            {formatBudget(kpiStats.totalSpend, language)}
          </strong>
          <span className="kpi-sub">
            {historicalData.length} {language === 'th' ? 'โครงการที่จัดซื้อแล้ว' : 'completed tenders'}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">{L('kpiAvgProjectSize')}</span>
          <strong className="kpi-value">
            {formatBudget(kpiStats.avgSpend, language)}
          </strong>
          <span className="kpi-sub">
            {language === 'th' ? 'ราคากลางเฉลี่ยต่อสัญญา' : 'Average budget per award'}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">{L('kpiHighestTender')}</span>
          <strong className="kpi-value text-warning">
            {formatBudget(kpiStats.maxBudget, language)}
          </strong>
          <span className="kpi-sub">
            {language === 'th' ? 'โครงการสเกลใหญ่สุดของ กทม.' : 'Largest recorded procurement'}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">{L('kpiOutlierRate')}</span>
          <strong className="kpi-value text-error">
            {kpiStats.outlierRate}%
          </strong>
          <span className="kpi-sub">
            {language === 'th' ? 'โครงการที่ราคาสูง/ต่ำกว่าเกณฑ์' : 'Above or below normal corridors'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tab-bar">
        <button
          type="button"
          className={`dash-tab-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
          onClick={() => setActiveTab('benchmark')}
        >
          {L('tabBenchmark')}
        </button>
        <button
          type="button"
          className={`dash-tab-btn ${activeTab === 'similar' ? 'active' : ''}`}
          onClick={() => setActiveTab('similar')}
        >
          {L('tabSimilar')}
        </button>
        <button
          type="button"
          className={`dash-tab-btn ${activeTab === 'agencies' ? 'active' : ''}`}
          onClick={() => setActiveTab('agencies')}
        >
          {L('tabAgencies')}
        </button>
        <button
          type="button"
          className={`dash-tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          {L('tabExplorer')}
        </button>
      </div>

      {/* TAB 1: Benchmark & Outlier Analysis (User Story 1) */}
      {activeTab === 'benchmark' && (
        <div className="tab-pane-content">
          {/* Interactive Announced Budget Reasonableness Checker */}
          <BudgetReasonablenessChecker projects={projects} historicalData={historicalData} />

          {/* Chart 1: Historical Budgets Bar Chart */}
          <div className="chart-container" style={{ marginTop: 24 }}>
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
          <div className="chart-container" style={{ marginTop: 24 }}>
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
      )}

      {/* TAB 2: Similar Procurements & Scope Estimator (User Story 2) */}
      {activeTab === 'similar' && (
        <div className="tab-pane-content">
          <SimilarProcurementEstimator projects={projects} historicalData={historicalData} />
        </div>
      )}

      {/* TAB 3: Cross-Agency Budget Comparison (User Story 3) */}
      {activeTab === 'agencies' && (
        <div className="tab-pane-content">
          <AgencyComparisonView agencyMetrics={agencyMetrics} />
        </div>
      )}

      {/* TAB 4: Historical Data Explorer */}
      {activeTab === 'explorer' && (
        <div className="tab-pane-content">
          <div className="chart-container">
            <div className="chart-header">
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
                  title="Download CSV"
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
                  {filteredHistorical.map((d, index) => {
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
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ fontWeight: 600, color: 'var(--gray-950)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
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
                                    ({d.procurementType || 'e-Bidding'})
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
                  })}
                </tbody>
              </table>
            </div>

            <span className="analysis-disclaimer" style={{ marginTop: 14 }}>
              {L('budgetDisclaimer')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
