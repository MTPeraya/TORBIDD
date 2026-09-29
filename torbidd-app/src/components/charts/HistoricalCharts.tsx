'use client';

import React, { useEffect, useRef } from 'react';
import ChartJS from 'chart.js/auto';
import { HistoricalProject } from '@/types/historical';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getCategoryAvg } from '@/lib/utils';

// ─── Chart 1: Historical Budgets Bar Chart ───────────────────────────────────

interface BudgetBarChartProps {
  data: HistoricalProject[];
}

export function BudgetBarChart({ data }: BudgetBarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);
  const { language, getLocalized } = useLanguage();
  const { theme } = useTheme();

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const isDark = theme === 'dark';
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: data.map((d) => {
          const text = (getLocalized(d.title) as string) || '';
          return text.length > 22 ? text.substring(0, 22) + '...' : text;
        }),
        datasets: [
          {
            label: language === 'th' ? 'งบประมาณ (ล้านบาท)' : 'Budget (M THB)',
            data: data.map((d) => d.budget / 1_000_000),
            backgroundColor: data.map((d) => {
              const avg = getCategoryAvg(d.category, data);
              const ratio = d.budget / avg;
              if (ratio > 1.3) return isDark ? 'rgba(248, 113, 113, 0.8)' : 'rgba(196, 69, 69, 0.8)';
              if (ratio < 0.7) return isDark ? 'rgba(75, 156, 203, 0.5)' : 'rgba(39, 115, 165, 0.5)';
              return isDark ? 'rgba(75, 156, 203, 0.8)' : 'rgba(39, 115, 165, 0.8)';
            }),
            borderColor: data.map((d) => {
              const avg = getCategoryAvg(d.category, data);
              const ratio = d.budget / avg;
              if (ratio > 1.3) return isDark ? 'rgb(248, 113, 113)' : 'rgb(196, 69, 69)';
              if (ratio < 0.7) return isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)';
              return isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)';
            }),
            borderWidth: 1.5,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => ` ${(item.parsed.y ?? 0).toFixed(2)} M THB`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: language === 'th' ? 'ล้านบาท (M THB)' : 'Budget (M THB)',
              font: { family: 'Noto Sans Thai, sans-serif', weight: 'bold' },
              color: isDark ? '#f1f5f9' : '#24313d',
            },
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ticks: { color: isDark ? '#94a3b8' : '#71808c' },
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 9.5, family: 'Noto Sans Thai, sans-serif' },
              maxRotation: 20,
              color: isDark ? '#94a3b8' : '#71808c',
            },
          },
        },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [data, language, theme, getLocalized]);

  return (
    <div style={{ position: 'relative', height: 300, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── Chart 2: Current Projects vs Historical Average ─────────────────────────

interface ComparisonChartProps {
  projects: Project[];
}

export function ComparisonChart({ projects }: ComparisonChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);
  const { language, getLocalized } = useLanguage();
  const { theme } = useTheme();

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const isDark = theme === 'dark';
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: projects.map((p) => {
          const text = (getLocalized(p.title) as string) || '';
          return text.length > 22 ? text.substring(0, 22) + '...' : text;
        }),
        datasets: [
          {
            label: language === 'th' ? 'งบประมาณโครงการ' : 'Project Budget',
            data: projects.map((p) => p.budget / 1_000_000),
            backgroundColor: isDark ? 'rgba(75, 156, 203, 0.85)' : 'rgba(39, 115, 165, 0.85)',
            borderColor: isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)',
            borderWidth: 1.5,
            borderRadius: 3,
          },
          {
            label: language === 'th' ? 'ค่าเฉลี่ยประเภทโครงการย้อนหลัง' : 'Historical Average',
            data: projects.map((p) => p.historicalAvg / 1_000_000),
            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(113, 128, 140, 0.6)',
            borderColor: isDark ? 'rgb(148, 163, 184)' : 'rgb(113, 128, 140)',
            borderWidth: 1.5,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Noto Sans Thai, sans-serif', size: 12, weight: 'bold' },
              usePointStyle: true,
              pointStyle: 'rectRounded',
              color: isDark ? '#cbd5e1' : '#4b5965',
            },
          },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(2)} M THB`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: language === 'th' ? 'ล้านบาท (M THB)' : 'M THB',
              font: { family: 'Noto Sans Thai, sans-serif', weight: 'bold' },
              color: isDark ? '#f1f5f9' : '#24313d',
            },
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ticks: { color: isDark ? '#94a3b8' : '#71808c' },
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 9.5, family: 'Noto Sans Thai, sans-serif' },
              maxRotation: 20,
              color: isDark ? '#94a3b8' : '#71808c',
            },
          },
        },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [projects, language, theme, getLocalized]);

  return (
    <div style={{ position: 'relative', height: 280, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── Chart 3: Cross-Agency Total & Average Spend Chart ───────────────────────

interface AgencyBudgetChartProps {
  agencyMetrics: import('@/types/historical').AgencyComparisonMetrics[];
}

export function AgencyBudgetChart({ agencyMetrics }: AgencyBudgetChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);
  const { language, getLocalized } = useLanguage();
  const { theme } = useTheme();

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const isDark = theme === 'dark';
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const topAgencies = agencyMetrics.slice(0, 8);

    chartInstanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: topAgencies.map((a) => {
          const name = (getLocalized(a.department) as string) || '';
          return name.length > 20 ? name.substring(0, 18) + '...' : name;
        }),
        datasets: [
          {
            label: language === 'th' ? 'งบประมาณรวม (ล้านบาท)' : 'Total Budget (M THB)',
            data: topAgencies.map((a) => a.totalBudget / 1_000_000),
            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.85)' : 'rgba(33, 101, 143, 0.85)',
            borderColor: isDark ? 'rgb(56, 189, 248)' : 'rgb(33, 101, 143)',
            borderWidth: 1.5,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            label: language === 'th' ? 'ขนาดโครงการเฉลี่ย (ล้านบาท)' : 'Avg Tender Size (M THB)',
            data: topAgencies.map((a) => a.avgBudget / 1_000_000),
            backgroundColor: isDark ? 'rgba(251, 191, 36, 0.85)' : 'rgba(183, 121, 31, 0.85)',
            borderColor: isDark ? 'rgb(251, 191, 36)' : 'rgb(183, 121, 31)',
            borderWidth: 1.5,
            borderRadius: 4,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Noto Sans Thai, sans-serif', size: 12, weight: 'bold' },
              usePointStyle: true,
              pointStyle: 'rectRounded',
              color: isDark ? '#cbd5e1' : '#4b5965',
            },
          },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(2)} M THB`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: language === 'th' ? 'ล้านบาท (M THB)' : 'M THB',
              font: { family: 'Noto Sans Thai, sans-serif', weight: 'bold' },
              color: isDark ? '#f1f5f9' : '#24313d',
            },
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ticks: { color: isDark ? '#94a3b8' : '#71808c' },
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 9.5, family: 'Noto Sans Thai, sans-serif' },
              maxRotation: 25,
              color: isDark ? '#94a3b8' : '#71808c',
            },
          },
        },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [agencyMetrics, language, theme, getLocalized]);

  return (
    <div style={{ position: 'relative', height: 320, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── Chart 4: Agency Technology Category Breakdown ───────────────────────────

export function AgencyCategoryChart({ agencyMetrics }: AgencyBudgetChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);
  const { language, getLocalized } = useLanguage();
  const { theme } = useTheme();

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const isDark = theme === 'dark';
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const topAgencies = agencyMetrics.slice(0, 7);

    chartInstanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: topAgencies.map((a) => {
          const name = (getLocalized(a.department) as string) || '';
          return name.length > 18 ? name.substring(0, 16) + '...' : name;
        }),
        datasets: [
          {
            label: language === 'th' ? 'เว็บไซต์ / พอร์ทัล' : 'Website',
            data: topAgencies.map((a) => a.categories.Website || 0),
            backgroundColor: isDark ? '#38bdf8' : '#2773a5',
          },
          {
            label: language === 'th' ? 'แอปมือถือ' : 'Mobile App',
            data: topAgencies.map((a) => a.categories['Mobile App'] || 0),
            backgroundColor: isDark ? '#a78bfa' : '#7c3aed',
          },
          {
            label: language === 'th' ? 'AI / GIS' : 'AI / GIS',
            data: topAgencies.map((a) => a.categories.AI || 0),
            backgroundColor: isDark ? '#34d399' : '#10b981',
          },
          {
            label: language === 'th' ? 'ฐานข้อมูล' : 'Database',
            data: topAgencies.map((a) => a.categories.Database || 0),
            backgroundColor: isDark ? '#fb923c' : '#f97316',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Noto Sans Thai, sans-serif', size: 11, weight: 'bold' },
              usePointStyle: true,
              pointStyle: 'circle',
              color: isDark ? '#cbd5e1' : '#4b5965',
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { size: 9, family: 'Noto Sans Thai, sans-serif' },
              color: isDark ? '#94a3b8' : '#71808c',
            },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: {
              display: true,
              text: language === 'th' ? 'จำนวนโครงการ' : 'Projects Count',
              font: { family: 'Noto Sans Thai, sans-serif', weight: 'bold' },
              color: isDark ? '#f1f5f9' : '#24313d',
            },
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ticks: { stepSize: 1, color: isDark ? '#94a3b8' : '#71808c' },
          },
        },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [agencyMetrics, language, theme, getLocalized]);

  return (
    <div style={{ position: 'relative', height: 280, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── Visual Component: Benchmark Spectrum Bar ────────────────────────────────

interface BenchmarkSpectrumBarProps {
  stats: import('@/types/historical').CategoryBenchmarkStats;
  currentBudget: number;
  status: 'reasonable' | 'high_outlier' | 'low_outlier';
}

export function BenchmarkSpectrumBar({ stats, currentBudget, status }: BenchmarkSpectrumBarProps) {
  const { language } = useLanguage();

  const min = Math.min(stats.min, currentBudget * 0.9);
  const max = Math.max(stats.max, currentBudget * 1.1);
  const range = max - min || 1;

  const toPercent = (val: number) => Math.max(2, Math.min(98, ((val - min) / range) * 100));

  const q1Pos = toPercent(stats.q1);
  const q3Pos = toPercent(stats.q3);
  const medianPos = toPercent(stats.median);
  const curPos = toPercent(currentBudget);

  const statusColor =
    status === 'high_outlier'
      ? '#ef4444'
      : status === 'low_outlier'
        ? '#f59e0b'
        : '#10b981';

  return (
    <div style={{ padding: '16px 8px 8px 8px' }}>
      <div
        style={{
          position: 'relative',
          height: 28,
          background: 'var(--gray-200)',
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {/* Reasonable Benchmark Range Highlight (Q1 to Q3) */}
        <div
          style={{
            position: 'absolute',
            left: `${q1Pos}%`,
            width: `${Math.max(4, q3Pos - q1Pos)}%`,
            top: 0,
            bottom: 0,
            background: 'rgba(16, 185, 129, 0.25)',
            borderLeft: '2px dashed #10b981',
            borderRight: '2px dashed #10b981',
          }}
          title={language === 'th' ? 'ช่วงราคากลางปกติ (Q1-Q3)' : 'Standard Benchmark (Q1-Q3)'}
        />

        {/* Median Line */}
        <div
          style={{
            position: 'absolute',
            left: `${medianPos}%`,
            top: 0,
            bottom: 0,
            width: 3,
            background: '#2563eb',
            zIndex: 2,
          }}
          title={`${language === 'th' ? 'ค่ามัธยฐาน' : 'Median'}: ${(stats.median / 1_000_000).toFixed(1)}M`}
        />

        {/* Current Budget Marker Indicator */}
        <div
          style={{
            position: 'absolute',
            left: `${curPos}%`,
            top: 2,
            bottom: 2,
            width: 12,
            marginLeft: -6,
            background: statusColor,
            borderRadius: 6,
            boxShadow: '0 0 8px rgba(0,0,0,0.4)',
            zIndex: 3,
            transition: 'left 0.4s ease',
          }}
        />
      </div>

      {/* Legend & Labels under the bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: 'var(--gray-600)',
        }}
      >
        <span>
          <strong>Min:</strong> {(stats.min / 1_000_000).toFixed(1)}M
        </span>
        <span style={{ color: '#10b981' }}>
          <strong>Q1:</strong> {(stats.q1 / 1_000_000).toFixed(1)}M
        </span>
        <span style={{ color: '#2563eb', fontWeight: 'bold' }}>
          <strong>Median:</strong> {(stats.median / 1_000_000).toFixed(1)}M
        </span>
        <span style={{ color: '#10b981' }}>
          <strong>Q3:</strong> {(stats.q3 / 1_000_000).toFixed(1)}M
        </span>
        <span>
          <strong>Max:</strong> {(stats.max / 1_000_000).toFixed(1)}M
        </span>
      </div>

      <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.85rem' }}>
        <span style={{ color: statusColor, fontWeight: 'bold' }}>
          ● {language === 'th' ? 'งบประมาณที่ประเมิน' : 'Evaluated Budget'}:{' '}
          {(currentBudget / 1_000_000).toFixed(2)} M THB
        </span>
      </div>
    </div>
  );
}

