'use client';

// =============================================================================
// components/procurement-filters/BudgetFilter.tsx
// (Supports Issue #150: Implement Budget Filter)
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BudgetFilterProps {
  minBudget: number | null;
  maxBudget: number | null;
  budgetPreset: string;
  onChange: (options: {
    minBudget: number | null;
    maxBudget: number | null;
    budgetPreset: string;
  }) => void;
  onClear?: () => void;
  id?: string;
}

export function BudgetFilter({
  minBudget,
  maxBudget,
  budgetPreset,
  onChange,
  onClear,
  id = 'budget-filter',
}: BudgetFilterProps) {
  const { L } = useLanguage();

  const [minInput, setMinInput] = useState<string>(
    minBudget !== null && minBudget !== undefined ? String(minBudget) : '',
  );
  const [maxInput, setMaxInput] = useState<string>(
    maxBudget !== null && maxBudget !== undefined ? String(maxBudget) : '',
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setMinInput(minBudget !== null && minBudget !== undefined ? String(minBudget) : '');
  }, [minBudget]);

  useEffect(() => {
    setMaxInput(maxBudget !== null && maxBudget !== undefined ? String(maxBudget) : '');
  }, [maxBudget]);

  // Validate range: min <= max
  const validateAndNotify = (minStr: string, maxStr: string, preset: string) => {
    const minVal = minStr.trim() !== '' ? Number(minStr) : null;
    const maxVal = maxStr.trim() !== '' ? Number(maxStr) : null;

    if (minVal !== null && maxVal !== null && minVal > maxVal) {
      setValidationError(L('invalidBudgetRange'));
      return false;
    }

    setValidationError(null);
    onChange({
      minBudget: minVal,
      maxBudget: maxVal,
      budgetPreset: preset,
    });
    return true;
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setMinInput(raw);
    validateAndNotify(raw, maxInput, '');
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setMaxInput(raw);
    validateAndNotify(minInput, raw, '');
  };

  const handlePresetSelect = (presetKey: string) => {
    if (budgetPreset === presetKey) {
      // Toggle off
      onChange({ minBudget: null, maxBudget: null, budgetPreset: '' });
      setMinInput('');
      setMaxInput('');
      setValidationError(null);
    } else {
      let min: number | null = null;
      let max: number | null = null;
      switch (presetKey) {
        case 'under5m':
          max = 5000000;
          break;
        case '5to10':
          min = 5000000;
          max = 10000000;
          break;
        case '10to20':
          min = 10000000;
          max = 20000000;
          break;
        case 'above20m':
          min = 20000000;
          break;
      }
      setMinInput(min !== null ? String(min) : '');
      setMaxInput(max !== null ? String(max) : '');
      setValidationError(null);
      onChange({ minBudget: min, maxBudget: max, budgetPreset: presetKey });
    }
  };

  const handleClear = () => {
    setMinInput('');
    setMaxInput('');
    setValidationError(null);
    onChange({ minBudget: null, maxBudget: null, budgetPreset: '' });
    onClear?.();
  };

  const hasActiveBudget =
    minBudget !== null || maxBudget !== null || Boolean(budgetPreset);

  return (
    <div className="filter-group budget-filter-group" id={id}>
      <div className="filter-group-header">
        <label className="filter-group-label">{L('budgetRange')}</label>
        {hasActiveBudget && (
          <button
            type="button"
            className="filter-group-reset-btn"
            onClick={handleClear}
            aria-label="Clear budget filter"
          >
            {L('clearFilters')}
          </button>
        )}
      </div>

      {/* Preset range buttons */}
      <div className="budget-presets-row" role="group" aria-label="Budget presets">
        <button
          type="button"
          className={`budget-preset-chip ${budgetPreset === 'under5m' ? 'active' : ''}`}
          onClick={() => handlePresetSelect('under5m')}
        >
          {L('under5m')}
        </button>
        <button
          type="button"
          className={`budget-preset-chip ${budgetPreset === '5to10' ? 'active' : ''}`}
          onClick={() => handlePresetSelect('5to10')}
        >
          {L('range5to10')}
        </button>
        <button
          type="button"
          className={`budget-preset-chip ${budgetPreset === '10to20' ? 'active' : ''}`}
          onClick={() => handlePresetSelect('10to20')}
        >
          {L('range10to20')}
        </button>
        <button
          type="button"
          className={`budget-preset-chip ${budgetPreset === 'above20m' ? 'active' : ''}`}
          onClick={() => handlePresetSelect('above20m')}
        >
          {L('above20m')}
        </button>
      </div>

      {/* Custom min/max inputs */}
      <div className="budget-inputs-row">
        <div className="budget-input-field">
          <span className="budget-input-label">{L('minBudget')}</span>
          <div className="budget-input-wrapper">
            <span className="budget-currency-symbol">฿</span>
            <input
              type="text"
              id="minBudgetInput"
              className={`budget-number-input ${validationError ? 'input-error' : ''}`}
              placeholder={L('budgetMinPlaceholder')}
              value={minInput}
              onChange={handleMinChange}
              aria-label={L('minBudget')}
            />
          </div>
        </div>

        <span className="budget-input-separator">–</span>

        <div className="budget-input-field">
          <span className="budget-input-label">{L('maxBudget')}</span>
          <div className="budget-input-wrapper">
            <span className="budget-currency-symbol">฿</span>
            <input
              type="text"
              id="maxBudgetInput"
              className={`budget-number-input ${validationError ? 'input-error' : ''}`}
              placeholder={L('budgetMaxPlaceholder')}
              value={maxInput}
              onChange={handleMaxChange}
              aria-label={L('maxBudget')}
            />
          </div>
        </div>
      </div>

      {/* Inline validation feedback */}
      {validationError && (
        <div className="budget-validation-error" role="alert">
          {validationError}
        </div>
      )}
    </div>
  );
}
