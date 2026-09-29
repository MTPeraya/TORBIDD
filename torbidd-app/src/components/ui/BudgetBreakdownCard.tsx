'use client';

import React from 'react';
import { BudgetBreakdownItem } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { formatBudgetFull, formatBudget } from '@/lib/utils';

interface BudgetBreakdownCardProps {
  budget: number;
  historicalAvg: number;
  budgetBreakdown?: BudgetBreakdownItem[];
}

export function BudgetBreakdownCard({
  budget,
  historicalAvg,
  budgetBreakdown,
}: BudgetBreakdownCardProps) {
  const { language, L, getLocalized } = useLanguage();

  const diff = budget - historicalAvg;
  const diffPct = historicalAvg > 0 ? Math.round((Math.abs(diff) / historicalAvg) * 100) : 0;
  const isHigher = diff > 0;
  const isWithin = Math.abs(diff) / historicalAvg <= 0.1;

  const barPalette = [
    'var(--primary-600)',
    '#0ea5e9', // sky-500
    '#8b5cf6', // purple-500
    '#10b981', // emerald-500
  ];

  return (
    <div className="detail-card budget-breakdown-card">
      <div className="budget-breakdown-header">
        <h2 className="detail-card-title" style={{ marginBottom: 4, borderBottom: 'none', paddingBottom: 0 }}>
          {ICONS.chart}
          <span>{L('budgetBreakdownTitle')}</span>
        </h2>
        <p className="budget-breakdown-subtitle">{L('budgetBreakdownSub')}</p>
      </div>

      {/* Variance Alert Chip */}
      <div className={`budget-variance-chip ${isWithin ? 'normal' : isHigher ? 'higher' : 'lower'}`}>
        {isHigher ? ICONS.trendUp : isWithin ? ICONS.check : ICONS.trendDown}
        <span>
          {isWithin
            ? `${L('withinRange')} (${formatBudget(budget, language)})`
            : `${isHigher ? L('budgetHigher') : L('budgetLower')} ${diffPct}% (${isHigher ? '+' : '-'}${formatBudget(Math.abs(diff), language)})`}
        </span>
      </div>

      {/* Allocation Bars */}
      {budgetBreakdown && budgetBreakdown.length > 0 && (
        <div className="budget-allocation-section">
          <div className="budget-stacked-bar">
            {budgetBreakdown.map((item, idx) => (
              <div
                key={idx}
                className="stacked-slice"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: barPalette[idx % barPalette.length],
                }}
                title={`${getLocalized(item.category)}: ${item.percentage}%`}
              />
            ))}
          </div>

          <div className="budget-item-list">
            {budgetBreakdown.map((item, idx) => (
              <div key={idx} className="budget-breakdown-item">
                <div className="item-label-group">
                  <span
                    className="item-color-dot"
                    style={{ backgroundColor: barPalette[idx % barPalette.length] }}
                  />
                  <span className="item-name">{getLocalized(item.category) as string}</span>
                </div>
                <div className="item-value-group">
                  <span className="item-amount">{formatBudgetFull(item.amount, language)}</span>
                  <span className="item-percentage">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <span className="analysis-disclaimer">{L('budgetDisclaimer')}</span>
    </div>
  );
}
