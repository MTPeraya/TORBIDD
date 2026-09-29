// =============================================================================
// components/procurement-filters/__tests__/ProcurementComponents.test.tsx
// UI Component Tests for Issues #147, #149, #150, #152, #154, #156
// =============================================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { CategoryFilter } from '../CategoryFilter';
import { AgencyFilter } from '../AgencyFilter';
import { BudgetFilter } from '../BudgetFilter';
import { ActiveFilterChips } from '../ActiveFilterChips';
import { ProcurementSort } from '@/components/procurement-sort/ProcurementSort';
import { ProcurementList } from '@/components/procurement-list/ProcurementList';
import { Project } from '@/types/project';

import { ToastProvider } from '@/contexts/ToastContext';

// Mock useRouter from next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue(null),
    getAll: jest.fn().mockReturnValue([]),
  }),
}));

const MOCK_PROJECTS: Project[] = [
  {
    externalId: 201,
    title: { th: 'ระบบ AI เมืองอัจฉริยะ', en: 'Smart City AI System' },
    department: { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic and Transport Dept.' },
    budget: 12000000,
    publishDate: '2026-08-15',
    deadline: '2026-09-15',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: { th: 'รายละเอียด', en: 'Description' },
    scope: { th: ['scope'], en: ['scope'] },
    qualifications: { th: ['qual'], en: ['qual'] },
    historicalAvg: 11500000,
    sourceDocument: 'doc.pdf',
    processedDate: '2026-08-15',
    aiConfidence: 'High',
  },
];

function renderWithLanguage(ui: React.ReactElement, initialLang: 'th' | 'en' = 'en') {
  if (typeof window !== 'undefined') {
    localStorage.setItem('torbidd_lang', initialLang);
  }
  return render(
    <ToastProvider>
      <LanguageProvider>
        {ui}
      </LanguageProvider>
    </ToastProvider>
  );
}

describe('Procurement Discovery UI Components', () => {
  // ─── Issue #147: CategoryFilter Component ───────────────────────────────────
  describe('Issue #147: CategoryFilter Component', () => {
    it('renders category options and marks selected categories as active', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <CategoryFilter selectedCategories={['AI']} onChange={handleChange} />,
      );

      const aiBtn = screen.getByRole('button', { name: /AI/i });
      expect(aiBtn).toHaveClass('active');
      expect(aiBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('invokes onChange when a category button is clicked', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <CategoryFilter selectedCategories={[]} onChange={handleChange} isMultiSelect={true} />,
      );

      const aiBtn = screen.getByRole('button', { name: /AI/i });
      fireEvent.click(aiBtn);
      expect(handleChange).toHaveBeenCalledWith(['AI']);
    });

    it('displays clear button when at least one category is selected and resets', () => {
      const handleChange = jest.fn();
      const handleClear = jest.fn();
      renderWithLanguage(
        <CategoryFilter
          selectedCategories={['Website', 'Mobile App']}
          onChange={handleChange}
          onClear={handleClear}
        />,
      );

      const clearBtn = screen.getByLabelText(/Clear category filter/i);
      expect(clearBtn).toBeInTheDocument();
      fireEvent.click(clearBtn);
      expect(handleChange).toHaveBeenCalledWith([]);
      expect(handleClear).toHaveBeenCalled();
    });
  });

  // ─── Issue #149: AgencyFilter Component ─────────────────────────────────────
  describe('Issue #149: AgencyFilter Component', () => {
    it('renders agency options and allows searching', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <AgencyFilter selectedAgencies={[]} onChange={handleChange} />,
      );

      const searchInput = screen.getByPlaceholderText(/Search agencies/i);
      expect(searchInput).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'Education' } });
      expect(screen.getByText(/Education Dept/i)).toBeInTheDocument();
    });

    it('toggles agency checkbox on click', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <AgencyFilter selectedAgencies={[]} onChange={handleChange} />,
      );

      const checkbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(checkbox);
      expect(handleChange).toHaveBeenCalled();
    });

    it('renders selected agency tags and allows individual removal', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <AgencyFilter
          selectedAgencies={['สำนักการศึกษา']}
          onChange={handleChange}
        />,
      );

      const removeBtn = screen.getByRole('button', { name: /Remove/i });
      expect(removeBtn).toBeInTheDocument();
      fireEvent.click(removeBtn);
      expect(handleChange).toHaveBeenCalledWith([]);
    });
  });

  // ─── Issue #150: BudgetFilter Component ─────────────────────────────────────
  describe('Issue #150: BudgetFilter Component', () => {
    it('updates min and max budget inputs', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <BudgetFilter
          minBudget={null}
          maxBudget={null}
          budgetPreset=""
          onChange={handleChange}
        />,
      );

      const minInput = screen.getByLabelText(/Min Budget/i);
      fireEvent.change(minInput, { target: { value: '5000000' } });
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ minBudget: 5000000 }),
      );
    });

    it('displays validation error when min budget exceeds max budget', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <BudgetFilter
          minBudget={null}
          maxBudget={null}
          budgetPreset=""
          onChange={handleChange}
        />,
      );

      const minInput = screen.getByLabelText(/Min Budget/i);
      const maxInput = screen.getByLabelText(/Max Budget/i);

      fireEvent.change(minInput, { target: { value: '20000000' } });
      fireEvent.change(maxInput, { target: { value: '5000000' } });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/Minimum budget cannot exceed maximum budget/i);
    });

    it('selects and triggers budget presets', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <BudgetFilter
          minBudget={null}
          maxBudget={null}
          budgetPreset=""
          onChange={handleChange}
        />,
      );

      const presetBtn = screen.getByText(/Under 5M/i);
      fireEvent.click(presetBtn);
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ budgetPreset: 'under5m', maxBudget: 5000000 }),
      );
    });
  });

  // ─── Issues #152 & #155: ActiveFilterChips Component ───────────────────────
  describe('Issues #152 & #155: ActiveFilterChips Component', () => {
    it('renders chips for active filters and handles individual removal and clear all', () => {
      const handleRemoveSearch = jest.fn();
      const handleRemoveCategory = jest.fn();
      const handleRemoveAgency = jest.fn();
      const handleRemoveBudget = jest.fn();
      const handleRemoveDeadline = jest.fn();
      const handleClearAll = jest.fn();

      renderWithLanguage(
        <ActiveFilterChips
          filters={{
            search: 'portal',
            categories: ['AI'],
            agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
            minBudget: 5000000,
            maxBudget: 10000000,
            budgetPreset: '',
          }}
          onRemoveSearch={handleRemoveSearch}
          onRemoveCategory={handleRemoveCategory}
          onRemoveAgency={handleRemoveAgency}
          onRemoveBudget={handleRemoveBudget}
          onRemoveDeadline={handleRemoveDeadline}
          onClearAll={handleClearAll}
        />,
      );

      // Verify active chips
      expect(screen.getByText(/"portal"/i)).toBeInTheDocument();
      expect(screen.getByText(/AI/i)).toBeInTheDocument();

      // Test individual search remove
      const removeSearchBtn = screen.getByLabelText(/Remove search filter/i);
      fireEvent.click(removeSearchBtn);
      expect(handleRemoveSearch).toHaveBeenCalledTimes(1);

      // Test individual category remove
      const removeCategoryBtn = screen.getByLabelText(/Remove category filter/i);
      fireEvent.click(removeCategoryBtn);
      expect(handleRemoveCategory).toHaveBeenCalledWith('AI');

      // Test Clear All
      const clearAllBtn = screen.getByRole('button', { name: /Clear All/i });
      fireEvent.click(clearAllBtn);
      expect(handleClearAll).toHaveBeenCalledTimes(1);
    });

    it('returns null when no filters are active', () => {
      const { container } = renderWithLanguage(
        <ActiveFilterChips
          filters={{
            search: '',
            categories: [],
            agencies: [],
            minBudget: null,
            maxBudget: null,
            budgetPreset: '',
          }}
          onRemoveSearch={jest.fn()}
          onRemoveCategory={jest.fn()}
          onRemoveAgency={jest.fn()}
          onRemoveBudget={jest.fn()}
          onRemoveDeadline={jest.fn()}
          onClearAll={jest.fn()}
        />,
      );

      expect(container.querySelector('.active-filters-bar')).toBeNull();
    });
  });

  // ─── Issue #154: ProcurementSort Component ─────────────────────────────────
  describe('Issue #154: ProcurementSort Component', () => {
    it('renders sort dropdown with Newest Published as default', () => {
      const handleChange = jest.fn();
      renderWithLanguage(
        <ProcurementSort value="publishDate_desc" onChange={handleChange} />,
      );

      const select = screen.getByLabelText(/Sort By/i) as HTMLSelectElement;
      expect(select.value).toBe('publishDate_desc');

      fireEvent.change(select, { target: { value: 'publishDate_asc' } });
      expect(handleChange).toHaveBeenCalledWith('publishDate_asc');
    });
  });

  // ─── Issue #156: ProcurementList Component (Feedback & UX States) ──────────
  describe('Issue #156: ProcurementList Component', () => {
    it('renders skeleton loading state during query updates', () => {
      renderWithLanguage(
        <ProcurementList
          projects={[]}
          isLoading={true}
          totalCount={0}
        />,
      );

      const loadingGrid = screen.getByLabelText(/Loading opportunities/i);
      expect(loadingGrid).toBeInTheDocument();
      expect(loadingGrid).toHaveAttribute('aria-busy', 'true');
    });

    it('renders dedicated empty-result state when no items match criteria', () => {
      const handleClear = jest.fn();
      renderWithLanguage(
        <ProcurementList
          projects={[]}
          isLoading={false}
          totalCount={0}
          onClearFilters={handleClear}
        />,
      );

      expect(screen.getByText(/No matching procurement opportunities found/i)).toBeInTheDocument();
      const clearBtn = screen.getByRole('button', { name: /Clear All/i });
      fireEvent.click(clearBtn);
      expect(handleClear).toHaveBeenCalledTimes(1);
    });

    it('renders dedicated error state with retry action on network/query failure', () => {
      const handleRetry = jest.fn();
      renderWithLanguage(
        <ProcurementList
          projects={[]}
          isLoading={false}
          error="Network connection timeout"
          onRetry={handleRetry}
          totalCount={0}
        />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Network connection timeout/i)).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Try Again/i });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('renders results counter and paginated project list with pagination controls', () => {
      const handlePageChange = jest.fn();
      renderWithLanguage(
        <ProcurementList
          projects={MOCK_PROJECTS}
          isLoading={false}
          totalCount={25}
          page={1}
          totalPages={3}
          onPageChange={handlePageChange}
        />,
      );

      expect(screen.getByText(/Showing/i)).toBeInTheDocument();
      expect(screen.getByText(/25/i)).toBeInTheDocument();
      expect(screen.getByText(/Smart City AI System/i)).toBeInTheDocument();

      const nextBtn = screen.getByRole('button', { name: /Next/i });
      fireEvent.click(nextBtn);
      expect(handlePageChange).toHaveBeenCalledWith(2);
    });
  });
});
