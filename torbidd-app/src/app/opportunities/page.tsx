'use client';

// =============================================================================
// app/opportunities/page.tsx - BMA Procurement Opportunities Discovery Page
// (Integrates Issues #147, #149, #150, #152, #154, #155, #156)
// =============================================================================

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Project } from '@/types/project';
import { SoftwareCategory, isSoftwareCategory } from '@/types/procurement-category';
import { ProcurementSortOption } from '@/types/procurement';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { StatCard } from '@/components/ui/StatCard';
import { formatBudget, isNew } from '@/lib/utils';
import { INITIAL_PROJECTS, INITIAL_DEPARTMENTS } from '@/lib/initialData';
import { executeProcurementSearch } from '@/services/procurement-search';

// Discovery Components
import { ProcurementSearchBar } from '@/components/procurement-search/ProcurementSearchBar';
import { ProcurementSort } from '@/components/procurement-sort/ProcurementSort';
import { ProcurementFilterPanel } from '@/components/procurement-filters/ProcurementFilterPanel';
import { ActiveFilterChips } from '@/components/procurement-filters/ActiveFilterChips';
import { ProcurementList } from '@/components/procurement-list/ProcurementList';

function OpportunitiesContent() {
  const searchParams = useSearchParams();
  const { language, L, getLocalized } = useLanguage();

  // Read initial query params from URL
  const initialSearch = searchParams.get('search') || '';
  const initialCategoryParam = searchParams.get('category') || searchParams.get('categories') || '';
  const initialCategories: SoftwareCategory[] = initialCategoryParam
    ? (initialCategoryParam.split(',').filter(isSoftwareCategory) as SoftwareCategory[])
    : [];

  const initialAgencyParam = searchParams.get('agency') || searchParams.get('agencies') || searchParams.get('department') || '';
  const initialAgencies = initialAgencyParam
    ? initialAgencyParam.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const initialMinBudget = searchParams.get('minBudget') ? Number(searchParams.get('minBudget')) : null;
  const initialMaxBudget = searchParams.get('maxBudget') ? Number(searchParams.get('maxBudget')) : null;
  const initialBudgetPreset = searchParams.get('budget') || '';
  const initialDeadline = searchParams.get('deadline') || '';
  const initialSortBy = (searchParams.get('sortBy') as ProcurementSortOption) || 'publishDate_desc';
  const initialPage = searchParams.get('page') ? Number(searchParams.get('page')) : 1;

  // State Management
  const [allProjects, setAllProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategories, setSelectedCategories] = useState<SoftwareCategory[]>(initialCategories);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>(initialAgencies);
  const [minBudget, setMinBudget] = useState<number | null>(initialMinBudget);
  const [maxBudget, setMaxBudget] = useState<number | null>(initialMaxBudget);
  const [budgetPreset, setBudgetPreset] = useState<string>(initialBudgetPreset);
  const [selectedDeadline, setSelectedDeadline] = useState<string>(initialDeadline);
  const [sortBy, setSortBy] = useState<ProcurementSortOption>(initialSortBy);
  const [page, setPage] = useState<number>(initialPage);

  // UX Feedback States (Issue #156)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Dynamic result count & items
  const [resultItems, setResultItems] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Sync state to URL without reloading
  const updateUrlParams = useCallback(
    (params: Record<string, string | number | null | undefined>) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);

      Object.entries(params).forEach(([key, val]) => {
        if (val === null || val === undefined || val === '') {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, String(val));
        }
      });

      window.history.replaceState(null, '', url.pathname + url.search);
    },
    [],
  );

  // Fetch or Compute Filtered Results
  const fetchOpportunities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const queryParams = new URLSearchParams();
    if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());
    if (selectedCategories.length > 0) queryParams.set('categories', selectedCategories.join(','));
    if (selectedAgencies.length > 0) queryParams.set('agencies', selectedAgencies.join(','));
    if (minBudget !== null) queryParams.set('minBudget', String(minBudget));
    if (maxBudget !== null) queryParams.set('maxBudget', String(maxBudget));
    if (budgetPreset) queryParams.set('budget', budgetPreset);
    if (selectedDeadline) queryParams.set('deadline', selectedDeadline);
    queryParams.set('sortBy', sortBy);
    queryParams.set('page', String(page));
    queryParams.set('limit', '12');

    // Update browser URL
    updateUrlParams({
      search: searchQuery.trim() || null,
      categories: selectedCategories.length > 0 ? selectedCategories.join(',') : null,
      agencies: selectedAgencies.length > 0 ? selectedAgencies.join(',') : null,
      minBudget: minBudget !== null ? minBudget : null,
      maxBudget: maxBudget !== null ? maxBudget : null,
      budget: budgetPreset || null,
      deadline: selectedDeadline || null,
      sortBy: sortBy !== 'publishDate_desc' ? sortBy : null,
      page: page > 1 ? page : null,
    });

    try {
      const res = await fetch(`/api/procurements?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();

      if (json.data && Array.isArray(json.data)) {
        setResultItems(json.data);
        setTotalCount(json.total || json.data.length);
        setTotalPages(json.totalPages || Math.max(1, Math.ceil((json.total || json.data.length) / 12)));
      } else {
        throw new Error('Invalid response structure');
      }
    } catch {
      // Offline fallback: Run in-memory query service directly
      const fallbackResult = executeProcurementSearch(allProjects, {
        search: searchQuery.trim(),
        categories: selectedCategories,
        agencies: selectedAgencies,
        minBudget,
        maxBudget,
        budgetPreset: budgetPreset as any,
        deadline: selectedDeadline as any,
        sortBy,
        page,
        limit: 12,
      });

      setResultItems(fallbackResult.items);
      setTotalCount(fallbackResult.total);
      setTotalPages(fallbackResult.totalPages);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    selectedCategories,
    selectedAgencies,
    minBudget,
    maxBudget,
    budgetPreset,
    selectedDeadline,
    sortBy,
    page,
    allProjects,
    updateUrlParams,
  ]);

  // Trigger query on parameter change
  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Initial load to fetch all projects for stats and agency/category counts
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setAllProjects(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // Compute category counts for badge counters
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Website: 0,
      'Mobile App': 0,
      AI: 0,
      Database: 0,
    };
    allProjects.forEach((p) => {
      if (p.category && p.category in counts) {
        counts[p.category]++;
      }
    });
    return counts;
  }, [allProjects]);

  // Available agencies for autocomplete
  const availableAgencies = useMemo(() => {
    const map = new Map<string, { th: string; en: string }>();
    INITIAL_DEPARTMENTS.forEach((d) => map.set(d.th, d));
    allProjects.forEach((p) => {
      if (p.department?.th && !map.has(p.department.th)) {
        map.set(p.department.th, p.department);
      }
    });
    return Array.from(map.values());
  }, [allProjects]);

  // Stats Counters
  const newCount = useMemo(() => {
    return allProjects.filter((p) => isNew(p.publishDate)).length;
  }, [allProjects]);

  const totalBudgetSum = useMemo(() => {
    return allProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  }, [allProjects]);

  // Clear Individual Filters (Issue #155)
  const handleRemoveSearch = () => {
    setSearchQuery('');
    setPage(1);
  };

  const handleRemoveCategory = (cat: SoftwareCategory) => {
    setSelectedCategories((prev) => prev.filter((c) => c !== cat));
    setPage(1);
  };

  const handleRemoveAgency = (ag: string) => {
    setSelectedAgencies((prev) => prev.filter((a) => a !== ag));
    setPage(1);
  };

  const handleRemoveBudget = () => {
    setMinBudget(null);
    setMaxBudget(null);
    setBudgetPreset('');
    setPage(1);
  };

  const handleRemoveDeadline = () => {
    setSelectedDeadline('');
    setPage(1);
  };

  // Global "Clear All" Action (Issues #147, #149, #150, #152, #155, #156)
  const handleClearAll = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedAgencies([]);
    setMinBudget(null);
    setMaxBudget(null);
    setBudgetPreset('');
    setSelectedDeadline('');
    setPage(1);
  };

  // Filter change handlers that reset page to 1
  const handleCategoryChange = (categories: SoftwareCategory[]) => {
    setSelectedCategories(categories);
    setPage(1);
  };

  const handleAgencyChange = (agencies: string[]) => {
    setSelectedAgencies(agencies);
    setPage(1);
  };

  const handleBudgetChange = (options: {
    minBudget: number | null;
    maxBudget: number | null;
    budgetPreset: string;
  }) => {
    setMinBudget(options.minBudget);
    setMaxBudget(options.maxBudget);
    setBudgetPreset(options.budgetPreset);
    setPage(1);
  };

  const handleDeadlineChange = (deadline: string) => {
    setSelectedDeadline(deadline);
    setPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleSortChange = (newSort: ProcurementSortOption) => {
    setSortBy(newSort);
    setPage(1);
  };

  const totalActiveFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    selectedCategories.length +
    selectedAgencies.length +
    (minBudget !== null || maxBudget !== null || budgetPreset ? 1 : 0) +
    (selectedDeadline ? 1 : 0);

  return (
    <div className="page-content" id="opportunities-discovery-page">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">{L('dashboardTitle')}</h1>
        <p className="page-subtitle">{L('dashboardSub')}</p>
      </div>

      {/* Stats Cards Row */}
      <div className="stats-row">
        <StatCard
          label={L('totalOpps')}
          value={allProjects.length}
          change={`+${newCount} ${L('newThisWeek')}`}
          changeType="positive"
          icon={ICONS.target}
          iconColor="blue"
        />

        <StatCard
          label={L('newPublished')}
          value={newCount}
          change={L('inPast3days')}
          changeType="positive"
          icon={ICONS.star}
          iconColor="green"
        />

        <StatCard
          label={L('totalBudget')}
          value={formatBudget(totalBudgetSum, language)}
          change={`${allProjects.length} ${L('projects')}`}
          changeType="neutral"
          icon={ICONS.dollarSign}
          iconColor="amber"
        />
      </div>

      <div className="procurement-discovery-wrapper">
        {/* Top Controls: Search Bar + Mobile Filter Toggle + Sort Dropdown */}
        <div className="procurement-top-controls">
          <div className="procurement-search-area">
            <ProcurementSearchBar
              value={searchQuery}
              onChange={handleSearchChange}
              onSubmit={handleSearchChange}
            />
          </div>

          <div className="procurement-sort-and-toggle">
            {/* Mobile Filter Drawer Toggle Button */}
            <button
              type="button"
              className="mobile-filter-toggle-btn"
              onClick={() => setIsMobileFilterOpen(true)}
              aria-label="Open filter options"
              id="mobile-filter-toggle-btn"
            >
              <span>⚙ {L('filterDrawerTitle')}</span>
              {totalActiveFilterCount > 0 && (
                <span className="filter-badge-count">{totalActiveFilterCount}</span>
              )}
            </button>

            {/* Publication Date & Budget Sorting Dropdown (Issue #154) */}
            <ProcurementSort value={sortBy} onChange={handleSortChange} />
          </div>
        </div>

        {/* Active Filter Chips Bar (Issues #152, #155, #156) */}
        <ActiveFilterChips
          filters={{
            search: searchQuery,
            categories: selectedCategories,
            agencies: selectedAgencies,
            minBudget,
            maxBudget,
            budgetPreset,
            deadline: selectedDeadline,
          }}
          onRemoveSearch={handleRemoveSearch}
          onRemoveCategory={handleRemoveCategory}
          onRemoveAgency={handleRemoveAgency}
          onRemoveBudget={handleRemoveBudget}
          onRemoveDeadline={handleRemoveDeadline}
          onClearAll={handleClearAll}
        />

        {/* Two-Column Discovery Layout: Filter Sidebar + Procurement List */}
        <div className="procurement-discovery-grid">
          {/* Filter Sidebar / Mobile Drawer (Issue #152) */}
          <ProcurementFilterPanel
            selectedCategories={selectedCategories}
            onCategoryChange={handleCategoryChange}
            selectedAgencies={selectedAgencies}
            onAgencyChange={handleAgencyChange}
            minBudget={minBudget}
            maxBudget={maxBudget}
            budgetPreset={budgetPreset}
            onBudgetChange={handleBudgetChange}
            selectedDeadline={selectedDeadline}
            onDeadlineChange={handleDeadlineChange}
            onClearAll={handleClearAll}
            isOpenMobile={isMobileFilterOpen}
            onCloseMobile={() => setIsMobileFilterOpen(false)}
            categoryCounts={categoryCounts}
            availableAgencies={availableAgencies}
          />

          {/* Results Area with Loading Skeleton, Empty State, and Pagination (Issue #156) */}
          <ProcurementList
            projects={resultItems}
            isLoading={isLoading}
            error={error}
            onRetry={fetchOpportunities}
            onClearFilters={handleClearAll}
            totalCount={totalCount}
            page={page}
            totalPages={totalPages}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      </div>
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="page-content">
          <p>Loading procurement opportunities...</p>
        </div>
      }
    >
      <OpportunitiesContent />
    </Suspense>
  );
}
