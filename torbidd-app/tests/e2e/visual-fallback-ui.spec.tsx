/**
 * E2E: Visual Fallback UI Displays (Empty States & Error Prompts)
 *
 * Verifies that the system renders visual fallback UI displays gracefully:
 *  1. Empty-state messages when no active software opportunities exist:
 *     - ProcurementList: Friendly empty-state card with search icon, localized message,
 *       helpful search suggestion, and a working "Clear All Filters" CTA button.
 *     - ProjectCarousel: Carousel empty-state notification when feed contains no active items.
 *     - SavedPage: Friendly bookmark empty state with browsing recommendation and CTA link.
 *     - Detail Page: Graceful fallback when a requested project cannot be located.
 *  2. Error prompts during network/database retrieval failures:
 *     - ProcurementList: Role="alert" error card with warning icon and localized title.
 *     - Descriptive error prompt with server/network message.
 *     - Interactive retry button (onRetry) allowing users to re-attempt data retrieval.
 *  3. Visual loading skeleton states during in-flight database/network queries.
 *  4. Dual-language support (Thai <-> English) across all fallback states.
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProcurementList } from '@/components/procurement-list/ProcurementList';
import { ProjectCarousel } from '@/components/ui/ProjectCarousel';
import SavedPage from '@/app/saved/page';
import ProjectDetailPage from '@/app/opportunities/[id]/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation & Context Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  usePathname: () => '/opportunities',
  useSearchParams: () => new URLSearchParams(),
}));

const mockAuth = {
  user: { email: 'user@example.com', id: 'usr-123' },
  isAuthenticated: true,
  isAdmin: false,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshUser: jest.fn(),
  updateProfile: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useBookmarks', () => ({
  useBookmarks: () => ({
    bookmarks: [],
    isBookmarked: jest.fn().mockReturnValue(false),
    toggleBookmark: jest.fn(),
    bookmarkCount: 0,
    clearBookmarks: jest.fn(),
    bookmarkedIds: [],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Render Helper
// ─────────────────────────────────────────────────────────────────────────────

function renderWithProviders(ui: React.ReactElement, lang: 'th' | 'en' = 'th') {
  if (typeof window !== 'undefined') {
    localStorage.setItem('torbidd_lang', lang);
    document.documentElement.lang = lang;
  }
  return render(
    <ToastProvider>
      <LanguageProvider>
        <Suspense fallback={<div>Loading...</div>}>
          {ui}
        </Suspense>
      </LanguageProvider>
    </ToastProvider>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Visual Fallback UI Displays (Empty States & Error Prompts)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // Section 1: Empty-State Messages When No Active Opportunities Exist
  // ===========================================================================
  describe('1. Empty-State Visual Displays (No Active Opportunities)', () => {
    it('1.1 renders friendly empty-state card in ProcurementList when no listings match (Thai)', () => {
      renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={0}
          page={1}
          totalPages={0}
        />,
        'th',
      );

      // 1. Accessible container
      const emptyState = screen.getByRole('region', { name: /Empty results/i });
      expect(emptyState).toBeInTheDocument();
      expect(emptyState).toHaveClass('procurement-empty-state');

      // 2. Friendly headline
      expect(screen.getByText('ไม่พบโครงการจัดซื้อจัดจ้างที่ตรงกับเงื่อนไข')).toBeInTheDocument();

      // 3. Helpful suggestion description
      expect(
        screen.getByText(/ลองปรับเปลี่ยนคำค้นหา หรือล้างตัวกรองบางรายการ/i),
      ).toBeInTheDocument();
    });

    it('1.2 renders friendly empty-state card in ProcurementList when no listings match (English)', () => {
      renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={0}
          page={1}
          totalPages={0}
        />,
        'en',
      );

      expect(screen.getByText('No matching procurement opportunities found')).toBeInTheDocument();
      expect(
        screen.getByText(/Try adjusting your search terms or clearing some filters/i),
      ).toBeInTheDocument();
    });

    it('1.3 renders "Clear All Filters" button and triggers callback when clicked', () => {
      const mockClearFilters = jest.fn();

      renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={0}
          onClearFilters={mockClearFilters}
        />,
        'th',
      );

      const clearBtn = screen.getByRole('button', { name: /ล้างทั้งหมด|Clear All/i });
      expect(clearBtn).toBeInTheDocument();
      expect(clearBtn).toHaveAttribute('id', 'empty-state-clear-btn');

      fireEvent.click(clearBtn);
      expect(mockClearFilters).toHaveBeenCalledTimes(1);
    });

    it('1.4 renders carousel empty-state message when dashboard feed has zero projects', () => {
      // Thai
      const { unmount } = renderWithProviders(<ProjectCarousel projects={[]} />, 'th');
      expect(screen.getByText('ไม่มีรายการประกาศในขณะนี้')).toBeInTheDocument();
      unmount();

      // English
      renderWithProviders(<ProjectCarousel projects={[]} />, 'en');
      expect(screen.getByText('No opportunities available at this time.')).toBeInTheDocument();
    });

    it('1.5 renders friendly empty state on Saved Projects page when user has no bookmarks', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await act(async () => {
        renderWithProviders(<SavedPage />, 'th');
      });

      await waitFor(() => {
        expect(screen.getByText('ยังไม่มีรายการที่บันทึก')).toBeInTheDocument();
      });

      // Contains helpful guidance
      expect(
        screen.getByText(/กดปุ่มบันทึกในหน้ารายละเอียดโครงการ/i),
      ).toBeInTheDocument();

      // Contains CTA button to browse opportunities
      const browseBtn = screen.getByRole('button', { name: /ดูโอกาสทั้งหมด|Browse/i });
      expect(browseBtn).toBeInTheDocument();

      fireEvent.click(browseBtn);
      expect(mockPush).toHaveBeenCalledWith('/opportunities');
    });
  });

  // ===========================================================================
  // Section 2: Error Prompts During Network / Database Retrieval Failures
  // ===========================================================================
  describe('2. Error Prompts During Network/Database Retrieval Failures', () => {
    it('2.1 renders prominent error prompt (role="alert") when database/network retrieval fails (Thai)', () => {
      renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={0}
          error="Network timeout: MongoDB Atlas unreachable"
        />,
        'th',
      );

      // 1. Accessibility alert role
      const alertElem = screen.getByRole('alert');
      expect(alertElem).toBeInTheDocument();
      expect(alertElem).toHaveClass('procurement-error-state');

      // 2. Warning icon
      expect(screen.getByText('⚠️')).toBeInTheDocument();

      // 3. Localized error title
      expect(screen.getByText('เกิดข้อผิดพลาดในการโหลดข้อมูล')).toBeInTheDocument();

      // 4. Custom error message preserved
      expect(screen.getByText('Network timeout: MongoDB Atlas unreachable')).toBeInTheDocument();
    });

    it('2.2 renders localized error prompt in English when language is set to "en"', () => {
      renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={0}
          error="Database connection failed"
        />,
        'en',
      );

      expect(screen.getByText('Failed to load procurement opportunities')).toBeInTheDocument();
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });

    it('2.3 displays custom server error message safely in the error state card', () => {
      renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={0}
          error="Network Error: MongoDB connection pool exhausted"
        />,
        'th',
      );

      // Displays the specific technical error message safely without crashing
      expect(
        screen.getByText('Network Error: MongoDB connection pool exhausted'),
      ).toBeInTheDocument();
      expect(screen.getByText('เกิดข้อผิดพลาดในการโหลดข้อมูล')).toBeInTheDocument();
    });

    it('2.4 provides interactive Retry button (#procurement-retry-btn) that triggers onRetry callback', () => {
      const mockRetry = jest.fn();

      renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={0}
          error="Failed to fetch from /api/projects"
          onRetry={mockRetry}
        />,
        'th',
      );

      const retryBtn = screen.getByRole('button', { name: /ลองใหม่อีกครั้ง|Try Again/i });
      expect(retryBtn).toBeInTheDocument();
      expect(retryBtn).toHaveAttribute('id', 'procurement-retry-btn');

      fireEvent.click(retryBtn);
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('2.5 displays error state even when totalCount is non-zero to prioritize error visibility', () => {
      renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={50}
          error="HTTP 500: Internal Server Error"
        />,
        'en',
      );

      // Error UI takes precedence
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Internal Server Error/i)).toBeInTheDocument();
      expect(screen.queryByText(/Showing/i)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 3: Project Detail Page (/opportunities/[id]) Retrieval Failures
  // ===========================================================================
  describe('3. Project Detail Page Retrieval Failures & Visual Fallbacks', () => {
    it('3.1 renders "Project Not Found" visual fallback when project does not exist', async () => {
      // Mock API returning 404 or null
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      let container: HTMLElement;
      await act(async () => {
        const res = renderWithProviders(
          <ProjectDetailPage
            params={Promise.resolve({ id: '99999999999' })}
          />,
          'th',
        );
        container = res.container;
      });

      // Verify friendly fallback UI
      await waitFor(() => {
        expect(screen.getByText('Project Not Found')).toBeInTheDocument();
      });

      expect(
        screen.getByText('The procurement opportunity requested could not be located.'),
      ).toBeInTheDocument();

      // Verify safe back navigation button
      const backBtn = container!.querySelector('.detail-back-btn')!;
      expect(backBtn).toBeInTheDocument();

      fireEvent.click(backBtn);
      expect(mockPush).toHaveBeenCalledWith('/opportunities');
    });

    it('3.2 renders "Project Not Found" visual fallback in English when locale is "en"', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await act(async () => {
        renderWithProviders(
          <ProjectDetailPage
            params={Promise.resolve({ id: '99999999999' })}
          />,
          'en',
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Project Not Found')).toBeInTheDocument();
      });

      expect(
        screen.getByText('The procurement opportunity requested could not be located.'),
      ).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 4: Loading Skeleton State Visual Fallbacks
  // ===========================================================================
  describe('4. Loading Skeleton Visual Fallback Display', () => {
    it('4.1 renders loading skeleton placeholders with aria-busy="true" while retrieval is pending', () => {
      const { container } = renderWithProviders(
        <ProcurementList
          projects={[]}
          totalCount={0}
          isLoading={true}
        />,
        'th',
      );

      // 1. Accessibility busy state
      const loadingGrid = screen.getByLabelText(/Loading opportunities/i);
      expect(loadingGrid).toBeInTheDocument();
      expect(loadingGrid).toHaveAttribute('aria-busy', 'true');

      // 2. Multiple skeleton cards rendered
      const skeletonCards = container.querySelectorAll('.project-card-skeleton');
      expect(skeletonCards.length).toBe(6);

      // 3. Each skeleton card contains placeholder layout lines
      skeletonCards.forEach((card) => {
        expect(card.querySelector('.skeleton-tag')).toBeInTheDocument();
        expect(card.querySelector('.skeleton-title')).toBeInTheDocument();
        expect(card.querySelector('.skeleton-budget-box')).toBeInTheDocument();
        expect(card.querySelector('.skeleton-footer')).toBeInTheDocument();
      });
    });
  });
});
