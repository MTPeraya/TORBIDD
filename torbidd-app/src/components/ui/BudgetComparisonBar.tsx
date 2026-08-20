'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { formatBudget, getBudgetStatus } from '@/lib/utils';

interface BudgetComparisonBarProps {
  budget: number;
  historicalAvg: number;
}

export function BudgetComparisonBar({ budget, historicalAvg }: BudgetComparisonBarProps) {
  const { language, L } = useLanguage();

  const budgetStatus = getBudgetStatus(budget, historicalAvg);
  const maxVal = Math.max(budget, historicalAvg);
  const budgetPct = Math.round((budget / maxVal) * 100);
  const avgPct = Math.round((historicalAvg / maxVal) * 100);

  const statusLabel =
    budgetStatus === 'above' ? L('aboveAvg') : budgetStatus === 'below' ? L('belowAvg') : L('withinRange');
  const statusIcon =
    budgetStatus === 'above' ? ICONS.trendUp : budgetStatus === 'below' ? ICONS.trendDown : ICONS.check;

  return (
    <div className="detail-card budget-comparison">
      <h2 className="detail-card-title">
        {ICONS.chart}
        <span>{L('budgetComparison')}</span>
      </h2>

      <div className={`budget-comparison-indicator ${budgetStatus}`}>
        {statusIcon}
        <span>{statusLabel}</span>
      </div>

      <div className="budget-bar-chart">
        <div className="budget-bar-row">
          <div className="budget-bar-label">{L('currentProject')}</div>
          <div className="budget-bar-track">
            <div className="budget-bar-fill current" style={{ width: `${budgetPct}%` }}>
              {formatBudget(budget, language)}
            </div>
          </div>
        </div>

        <div className="budget-bar-row">
          <div className="budget-bar-label">{L('historicalAvg')}</div>
          <div className="budget-bar-track">
            <div className="budget-bar-fill avg" style={{ width: `${avgPct}%` }}>
              {formatBudget(historicalAvg, language)}
            </div>
          </div>
        </div>
      </div>

      <span className="analysis-disclaimer">{L('budgetDisclaimer')}</span>
    </div>
  );
}
