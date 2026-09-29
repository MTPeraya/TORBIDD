'use client';

// =============================================================================
// components/procurement-filters/AgencyFilter.tsx
// (Supports Issue #149: Implement Government Agency Filter)
// =============================================================================

import React, { useState, useMemo } from 'react';
import { BANGKOK_AGENCIES } from '@/types/agency';
import { useLanguage } from '@/contexts/LanguageContext';

interface AgencyFilterProps {
  selectedAgencies: string[];
  onChange: (agencies: string[]) => void;
  onClear?: () => void;
  availableAgencies?: { th: string; en: string }[];
  id?: string;
}

export function AgencyFilter({
  selectedAgencies,
  onChange,
  onClear,
  availableAgencies,
  id = 'agency-filter',
}: AgencyFilterProps) {
  const { language, L } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  // Merge known reference agencies with any dynamically provided available agencies
  const allAgencyItems = useMemo(() => {
    const list: { id: string; th: string; en: string; code?: string }[] = BANGKOK_AGENCIES.map(
      (a) => ({
        id: a.id,
        th: a.name.th,
        en: a.name.en,
        code: a.code,
      }),
    );

    if (availableAgencies) {
      for (const av of availableAgencies) {
        if (!list.some((l) => l.th === av.th || l.en === av.en)) {
          list.push({
            id: av.th,
            th: av.th,
            en: av.en,
          });
        }
      }
    }

    return list;
  }, [availableAgencies]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return allAgencyItems;
    const q = searchTerm.toLowerCase().trim();
    return allAgencyItems.filter(
      (a) =>
        a.th.toLowerCase().includes(q) ||
        a.en.toLowerCase().includes(q) ||
        (a.code && a.code.toLowerCase().includes(q)),
    );
  }, [allAgencyItems, searchTerm]);

  const handleToggle = (agencyNameOrId: string) => {
    if (selectedAgencies.includes(agencyNameOrId)) {
      onChange(selectedAgencies.filter((a) => a !== agencyNameOrId));
    } else {
      onChange([...selectedAgencies, agencyNameOrId]);
    }
  };

  const handleClear = () => {
    onChange([]);
    setSearchTerm('');
    onClear?.();
  };

  return (
    <div className="filter-group agency-filter-group" id={id}>
      <div className="filter-group-header">
        <label className="filter-group-label">{L('filterAgency')}</label>
        {selectedAgencies.length > 0 && (
          <button
            type="button"
            className="filter-group-reset-btn"
            onClick={handleClear}
            aria-label="Clear agency filter"
          >
            {L('clearFilters')}
          </button>
        )}
      </div>

      {/* Autocomplete / Search Input for agencies */}
      <div className="agency-search-box">
        <input
          type="text"
          className="agency-search-input"
          placeholder={L('searchAgencyPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label={L('searchAgencyPlaceholder')}
        />
        {searchTerm && (
          <button
            type="button"
            className="agency-search-clear"
            onClick={() => setSearchTerm('')}
            aria-label="Clear agency search term"
          >
            ×
          </button>
        )}
      </div>

      {/* Selected agency pills */}
      {selectedAgencies.length > 0 && (
        <div className="selected-agency-tags" aria-label="Selected agencies">
          {selectedAgencies.map((agencyKey) => {
            const found = allAgencyItems.find(
              (a) => a.id === agencyKey || a.th === agencyKey || a.en === agencyKey,
            );
            const displayName = found ? (language === 'th' ? found.th : found.en) : agencyKey;

            return (
              <span key={agencyKey} className="agency-selected-tag">
                <span className="agency-tag-label">{displayName}</span>
                <button
                  type="button"
                  className="agency-tag-remove"
                  onClick={() => handleToggle(agencyKey)}
                  aria-label={`Remove ${displayName}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Agency list checkboxes / options */}
      <div className="agency-list-scrollable" role="listbox">
        {filteredOptions.length === 0 ? (
          <div className="agency-empty-message">
            {language === 'th' ? 'ไม่พบหน่วยงานที่ค้นหา' : 'No agencies found'}
          </div>
        ) : (
          filteredOptions.map((agency) => {
            const isChecked =
              selectedAgencies.includes(agency.id) ||
              selectedAgencies.includes(agency.th) ||
              selectedAgencies.includes(agency.en);
            const agencyKey = agency.th; // Match by canonical department name

            return (
              <label
                key={agency.id}
                className={`agency-option-row ${isChecked ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  className="agency-checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(agencyKey)}
                />
                <span className="agency-option-name">
                  {language === 'th' ? agency.th : agency.en}
                </span>
                {agency.code && <span className="agency-option-code">{agency.code}</span>}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
