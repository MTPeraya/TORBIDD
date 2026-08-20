'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { HistoricalProject } from '@/types/historical';
import { Project, ProjectCategory } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { BudgetBarChart, ComparisonChart } from '@/components/charts/HistoricalCharts';
import { formatBudget, getCategoryAvg, getOutlierStatus } from '@/lib/utils';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/labels';
import { INITIAL_HISTORICAL, INITIAL_PROJECTS } from '@/lib/initialData';

export default function HistoricalPage() {
  const { language, L, getLocalized } = useLanguage();
  const [historicalData, setHistoricalData] = useState<HistoricalProject[]>(INITIAL_HISTORICAL);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);

  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | ''>('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    fetch('/api/historical')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setHistoricalData(json.data);
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

  const departments = useMemo(() => {
    return Array.from(new Set(historicalData.map((d) => (getLocalized(d.department) as string))));
  }, [historicalData, getLocalized]);

  const years = useMemo(() => {
    return Array.from(new Set(historicalData.map((d) => d.year))).sort((a, b) => b - a);
  }, [historicalData]);

  const filteredHistorical = useMemo(() => {
    let result = [...historicalData];

    if (selectedCategory) {
      result = result.filter((d) => d.category === selectedCategory);
    }

    if (selectedDept) {
      result = result.filter(
        (d) => (getLocalized(d.department) as string) === selectedDept || d.department.th === selectedDept
      );
    }

    if (selectedYear) {
      result = result.filter((d) => d.year === parseInt(selectedYear, 10));
    }

    return result;
  }, [historicalData, selectedCategory, selectedDept, selectedYear, getLocalized]);

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">{L('historicalTitle')}</h1>
        <p className="page-subtitle">{L('historicalSub')}</p>
      </div>

      {/* Chart 1: Historical Budgets Bar Chart */}
      <div className="chart-container">
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
        <h2 className="chart-title" style={{ marginBottom: 16, borderBottom: '1px solid var(--gray-200)', paddingBottom: 8 }}>
          {L('currentProjects')}
        </h2>
        <ComparisonChart projects={projects} />
      </div>

      {/* Historical Data Table */}
      <div className="chart-container" style={{ marginTop: 24 }}>
        <h2 className="chart-title" style={{ marginBottom: 16, borderBottom: '1px solid var(--gray-200)', paddingBottom: 8 }}>
          {L('historicalData')}
        </h2>

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
              </tr>
            </thead>
            <tbody>
              {filteredHistorical.map((d, index) => {
                const catAvg = getCategoryAvg(d.category, historicalData);
                const outlierStatus = getOutlierStatus(d.budget, catAvg);

                let outlierText = L('outlierNormal');
                if (outlierStatus === 'high') outlierText = L('outlierHigh');
                if (outlierStatus === 'low') outlierText = L('outlierLow');

                return (
                  <tr key={d._id || index}>
                    <td style={{ fontWeight: 600, color: 'var(--gray-950)' }}>
                      {getLocalized(d.title) as string}
                    </td>
                    <td>{getLocalized(d.department) as string}</td>
                    <td>
                      <span className="tag category">
                        {CATEGORY_LABELS[language][d.category]}
                      </span>
                    </td>
                    <td>{d.year + (language === 'th' ? 543 : 0)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--gray-950)' }}>
                      {formatBudget(d.budget, language)}
                    </td>
                    <td>
                      <span className={`outlier-badge ${outlierStatus}`}>{outlierText}</span>
                    </td>
                  </tr>
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
  );
}
