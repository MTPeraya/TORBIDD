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
  const { language, L, getLocalized } = useLanguage();
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
