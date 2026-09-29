'use client';

// =============================================================================
// components/procurement-search/ProcurementSearchBar.tsx
// (Supports Issues #155, #156)
// =============================================================================

import React, { useState, useEffect } from 'react';
import { ICONS } from '@/components/ui/Icons';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProcurementSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: (val: string) => void;
  placeholder?: string;
  id?: string;
}

export function ProcurementSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  id = 'procurement-search-input',
}: ProcurementSearchBarProps) {
  const { L } = useLanguage();
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInternalValue(nextVal);
    onChange(nextVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.(internalValue);
    }
  };

  const handleClear = () => {
    setInternalValue('');
    onChange('');
    onSubmit?.('');
  };

  return (
    <div className="procurement-search-bar" role="search">
      <div className="search-input-wrapper">
        <span className="search-icon" aria-hidden="true">
          {ICONS.search}
        </span>
        <input
          type="text"
          id={id}
          className="search-input"
          value={internalValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || L('searchPlaceholder')}
          aria-label={placeholder || L('searchPlaceholder')}
        />
        {internalValue && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            aria-label="Clear search"
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
