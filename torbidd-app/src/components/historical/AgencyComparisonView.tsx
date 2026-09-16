'use client';

import React, { useState, useMemo } from 'react';
import { AgencyComparisonMetrics } from '@/types/historical';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBudget, formatBudgetFull } from '@/lib/utils';
import { AgencyBudgetChart, AgencyCategoryChart } from '@/components/charts/HistoricalCharts';
import { CATEGORY_LABELS } from '@/lib/labels';

interface AgencyComparisonViewProps {
  agencyMetrics: AgencyComparisonMetrics[];
}

export function AgencyComparisonView({ agencyMetrics }: AgencyComparisonViewProps) {
  const { language, L, getLocalized } = useLanguage();

  const [sortField, setSortField] = useState<'totalBudget' | 'avgBudget' | 'projectCount'>('totalBudget');
  const [sortAsc, setSortAsc] = useState(false);

  // Side-by-side agency comparator selection
  const [agencyKey1, setAgencyKey1] = useState<string>(agencyMetrics[0]?.departmentKey || '');
  const [agencyKey2, setAgencyKey2] = useState<string>(agencyMetrics[1]?.departmentKey || '');

  // Sorted list
  const sortedMetrics = useMemo(() => {
    return [...agencyMetrics].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [agencyMetrics, sortField, sortAsc]);

  const totalOverallSpend = useMemo(() => {
    return agencyMetrics.reduce((sum, a) => sum + a.totalBudget, 0);
  }, [agencyMetrics]);

  const agency1 = useMemo(() => {
    return agencyMetrics.find((a) => a.departmentKey === agencyKey1) || agencyMetrics[0];
  }, [agencyMetrics, agencyKey1]);

  const agency2 = useMemo(() => {
    return agencyMetrics.find((a) => a.departmentKey === agencyKey2) || agencyMetrics[1];
  }, [agencyMetrics, agencyKey2]);

  const handleSort = (field: 'totalBudget' | 'avgBudget' | 'projectCount') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="agency-comparison-wrapper">
      <div className="agency-header">
        <div>
          <h3 className="agency-title">{L('agencyComparisonTitle')}</h3>
          <p className="agency-subtitle">{L('agencyComparisonSub')}</p>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="agency-charts-grid">
        <div className="chart-panel">
          <h4 className="chart-heading">{L('agencyBudgetChartTitle')}</h4>
          <AgencyBudgetChart agencyMetrics={agencyMetrics} />
        </div>

        <div className="chart-panel">
          <h4 className="chart-heading">{L('agencyCategoryChartTitle')}</h4>
          <AgencyCategoryChart agencyMetrics={agencyMetrics} />
        </div>
      </div>

      {/* Side-by-Side Agency Comparator Card */}
      {agency1 && agency2 && (
        <div className="side-by-side-card">
          <div className="card-header-flex">
            <div>
              <h4 className="card-heading-bold">{L('compareAgencies')}</h4>
              <span className="card-sub-text">
                {language === 'th'
                  ? 'เปรียบเทียบสถิติการจัดซื้อจัดจ้างซอฟต์แวร์ระหว่าง 2 หน่วยงานแบบเคียงข้างกัน'
                  : 'Direct head-to-head procurement comparison between two BMA departments'}
              </span>
            </div>
          </div>

          <div className="comparator-selectors">
            <div className="selector-column">
              <label htmlFor="selectAgencyA" className="selector-label">
                {L('selectAgency1')}
              </label>
              <select
                id="selectAgencyA"
                className="selector-select"
                value={agency1.departmentKey}
                onChange={(e) => setAgencyKey1(e.target.value)}
              >
                {agencyMetrics.map((a) => (
                  <option key={a.departmentKey} value={a.departmentKey}>
                    {getLocalized(a.department) as string}
                  </option>
                ))}
              </select>
            </div>

            <div className="vs-badge">VS</div>

            <div className="selector-column">
              <label htmlFor="selectAgencyB" className="selector-label">
                {L('selectAgency2')}
              </label>
              <select
                id="selectAgencyB"
                className="selector-select"
                value={agency2.departmentKey}
                onChange={(e) => setAgencyKey2(e.target.value)}
              >
                {agencyMetrics.map((a) => (
                  <option key={a.departmentKey} value={a.departmentKey}>
                    {getLocalized(a.department) as string}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="comparator-grid">
            {/* Agency 1 Stats Column */}
            <div className="comparator-side side-left">
              <h5 className="agency-name-tag">{getLocalized(agency1.department) as string}</h5>

              <div className="metric-row">
                <span className="m-label">{L('totalSpend')}</span>
                <strong className="m-val text-primary">
                  {formatBudget(agency1.totalBudget, language)}
                </strong>
              </div>

              <div className="metric-row">
                <span className="m-label">{L('avgTender')}</span>
                <strong className="m-val">{formatBudget(agency1.avgBudget, language)}</strong>
              </div>

              <div className="metric-row">
                <span className="m-label">{L('projectVolume')}</span>
                <strong className="m-val">{agency1.projectCount} {L('projects')}</strong>
              </div>

              <div className="metric-row">
                <span className="m-label">{L('dominantTech')}</span>
                <span className="m-badge">
                  {CATEGORY_LABELS[language][agency1.primaryCategory]}
                </span>
              </div>

              <div className="metric-row top-project-row">
                <span className="m-label">{L('largestProject')}</span>
                <div className="top-proj-box">
                  <span className="top-proj-title">
                    {getLocalized(agency1.topProject.title) as string}
                  </span>
                  <span className="top-proj-cost">
                    {formatBudget(agency1.topProject.budget, language)} (
                    {agency1.topProject.year + (language === 'th' ? 543 : 0)})
                  </span>
                </div>
              </div>
            </div>

            {/* Agency 2 Stats Column */}
            <div className="comparator-side side-right">
              <h5 className="agency-name-tag">{getLocalized(agency2.department) as string}</h5>

              <div className="metric-row">
                <span className="m-label">{L('totalSpend')}</span>
                <strong className="m-val text-primary">
                  {formatBudget(agency2.totalBudget, language)}
                </strong>
              </div>

              <div className="metric-row">
                <span className="m-label">{L('avgTender')}</span>
                <strong className="m-val">{formatBudget(agency2.avgBudget, language)}</strong>
              </div>

              <div className="metric-row">
                <span className="m-label">{L('projectVolume')}</span>
                <strong className="m-val">{agency2.projectCount} {L('projects')}</strong>
              </div>

              <div className="metric-row">
                <span className="m-label">{L('dominantTech')}</span>
                <span className="m-badge">
                  {CATEGORY_LABELS[language][agency2.primaryCategory]}
                </span>
              </div>

              <div className="metric-row top-project-row">
                <span className="m-label">{L('largestProject')}</span>
                <div className="top-proj-box">
                  <span className="top-proj-title">
                    {getLocalized(agency2.topProject.title) as string}
                  </span>
                  <span className="top-proj-cost">
                    {formatBudget(agency2.topProject.budget, language)} (
                    {agency2.topProject.year + (language === 'th' ? 543 : 0)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Agency Summary Table */}
      <div className="agency-table-card">
        <h4 className="table-card-title">{L('agencyMetricsTableTitle')}</h4>

        <div className="table-responsive">
          <table className="agency-table">
            <thead>
              <tr>
                <th>{L('department')}</th>
                <th
                  className="clickable-th"
                  onClick={() => handleSort('totalBudget')}
                  title="Click to sort"
                >
                  {L('totalSpend')} {sortField === 'totalBudget' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  className="clickable-th"
                  onClick={() => handleSort('projectCount')}
                  title="Click to sort"
                >
                  {L('projectVolume')} {sortField === 'projectCount' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  className="clickable-th"
                  onClick={() => handleSort('avgBudget')}
                  title="Click to sort"
                >
                  {L('avgTender')} {sortField === 'avgBudget' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th>{L('dominantTech')}</th>
                <th>{L('largestProject')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedMetrics.map((agency) => {
                const sharePercent =
                  totalOverallSpend > 0
                    ? ((agency.totalBudget / totalOverallSpend) * 100).toFixed(1)
                    : '0';

                return (
                  <tr key={agency.departmentKey}>
                    <td className="agency-cell">
                      <strong>{getLocalized(agency.department) as string}</strong>
                      <div className="share-bar-wrapper">
                        <div
                          className="share-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(5, Number(sharePercent) * 2))}%` }}
                        />
                        <span className="share-label">{sharePercent}% {language === 'th' ? 'ของงบ กทม.' : 'of BMA'}</span>
                      </div>
                    </td>
                    <td className="budget-cell">
                      <strong>{formatBudgetFull(agency.totalBudget, language)}</strong>
                    </td>
                    <td className="count-cell">
                      <span className="count-badge">{agency.projectCount}</span>
                    </td>
                    <td className="avg-cell">{formatBudget(agency.avgBudget, language)}</td>
                    <td>
                      <span className="cat-pill">
                        {CATEGORY_LABELS[language][agency.primaryCategory]}
                      </span>
                    </td>
                    <td className="top-proj-cell">
                      <div className="top-cell-title">
                        {getLocalized(agency.topProject.title) as string}
                      </div>
                      <span className="top-cell-budget">
                        {formatBudget(agency.topProject.budget, language)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
