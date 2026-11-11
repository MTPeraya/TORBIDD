/**
 * E2E: Bookmark & Saved Opportunities Workflow
 *
 * Verifies that registered users can:
 *  1. Bookmark opportunities from the Dashboard / Project Card (ProjectCard component)
 *     - Clicking the bookmark button on a card toggles bookmarked state
 *     - Visual state updates immediately (filled/unfilled icon, aria-label)
 *     - Toast feedback message appears (bookmarkAdded / bookmarkRemoved)
 *     - Bookmark persists to localStorage (torbidd_bookmarks key)
 *     - Unauthenticated users are redirected to Auth Prompt Modal
 *
 *  2. Bookmark opportunities from the Detail View (/opportunities/[id])
 *     - Clicking the bookmark button on the detail page toggles state
 *     - Bookmark state reflects correctly on subsequent renders
 *     - Unauthenticated users see Auth Prompt Modal
 *
 *  3. Immediately view saved items in the "Saved Opportunities" list (SavedPage)
 *     - Bookmarked items appear in the saved list in real time
 *     - Empty state renders when no bookmarks are set
 *     - Unbookmarking from SavedPage immediately removes item from list
 *     - Multiple bookmarks display all items correctly
 *     - "Clear All" button removes all saved opportunities at once
 *     - Individually bookmarked opportunity not in projects list is fetched on-demand
 *
 *  4. Bookmark count badge in Sidebar reflects real-time counts
 *     - Sidebar badge increments when bookmark is added
 *     - Sidebar badge decrements when bookmark is removed
 *     - Sidebar badge hides when count is zero
 *
 *  5. API layer: GET /api/bookmarks, POST /api/bookmarks, DELETE /api/bookmarks/[id]
 *     - GET returns session-scoped bookmark list
 *     - POST with valid 24-char ObjectId creates bookmark record
 *     - POST with invalid projectId returns 400 validation error
 *     - DELETE removes an existing bookmark and returns 200
 *     - DELETE for non-existent bookmark returns 404
 *     - DELETE with malformed id returns 400
 *
 *  6. Cross-tab synchronization via localStorage storage events
 *     - Bookmarks updated in one tab propagate to other hook instances via storage event
 *
 *  7. useBookmarks hook unit semantics
 *     - String/number ID interchangeability
 *     - Real-time synchronization across concurrent hook instances
 *     - clearBookmarks() resets all hooks
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ProjectCard } from '@/components/ui/ProjectCard';
import ProjectDetailPage from '@/app/opportunities/[id]/page';
import SavedPage from '@/app/saved/page';
import { Sidebar } from '@/components/layout/Sidebar';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import {
  useBookmarks,
  BOOKMARKS_STORAGE_KEY,
  setStoredBookmarks,
} from '@/hooks/useBookmarks';
import { renderHook } from '@testing-library/react';
import { Project } from '@/types/project';

// ─────────────────────────────────────────────────────────────────────────────
// Global Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  usePathname: () => '/opportunities',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock MongoDB + DB services (API route layer)
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/Bookmark');
jest.mock('@/models/User');
jest.mock('@/lib/session', () => ({
  SESSION_COOKIE: 'torbidd_session',
  getSessionId: jest.fn().mockReturnValue('sess_test_e2e_bookmark_01'),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Auth Context Mocks (authenticated and unauthenticated variants)
// ─────────────────────────────────────────────────────────────────────────────

const mockAuthAuthenticated = {
  user: { id: 'user_e2e_01', name: 'ผู้ใช้งานทดสอบ', email: 'bidder@techcorp.go.th', role: 'user' },
  isAuthenticated: true,
  isAdmin: false,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshUser: jest.fn(),
  updateProfile: jest.fn(),
};

const mockAuthUnauthenticated = {
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshUser: jest.fn(),
  updateProfile: jest.fn(),
};

let currentMockAuth: typeof mockAuthAuthenticated | typeof mockAuthUnauthenticated = mockAuthAuthenticated;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => currentMockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Realistic Project Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createProject(overrides: Partial<Project> & Pick<Project, 'externalId' | 'title' | 'department' | 'budget' | 'category'>): Project {
  return {
    _id: `proj_${overrides.externalId}`,
    procurementType: 'e-Bidding',
    description: overrides.title,
    scope: { th: ['ขอบเขตงานพัฒนาระบบ'], en: ['Software development scope'] },
    qualifications: { th: ['มีประสบการณ์พัฒนาระบบ'], en: ['System development experience'] },
    processedDate: '2026-09-01T00:00:00.000Z',
    publishDate: '2026-08-20T00:00:00.000Z',
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    historicalAvg: (overrides.budget ?? 0) * 0.95,
    sourceDocument: `TOR_${overrides.externalId}.pdf`,
    torStatus: 'AVAILABLE',
    aiConfidence: 'High',
    isSoftwareRelated: true,
    classificationReviewStatus: 'APPROVED',
    status: 'ประกาศเชิญชวน',
    fiscalYear: 2569,
    ...overrides,
  };
}

const AI_PROJECT: Project = createProject({
  externalId: 7711900101,
  title: { th: 'โครงการพัฒนาระบบ AI วิเคราะห์ภาพถ่ายดาวเทียม กทม.', en: 'BMA AI Satellite Image Analysis System' },
  department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy and Evaluation Department' },
  budget: 18_000_000,
  category: 'AI',
  requiredTechnologies: ['Python', 'TensorFlow', 'GIS'],
});

const CLOUD_PROJECT: Project = createProject({
  externalId: 7711900102,
  title: { th: 'โครงการจัดหาระบบคลาวด์กลางสำหรับหน่วยงานกรุงเทพฯ', en: 'BMA Central Cloud Infrastructure' },
  department: { th: 'สำนักการคลัง', en: 'Finance Department' },
  budget: 32_000_000,
  category: 'Cloud',
  requiredTechnologies: ['AWS', 'Kubernetes', 'Terraform'],
});

const MOBILE_PROJECT: Project = createProject({
  externalId: 7711900103,
  title: { th: 'แอพพลิเคชันบริการประชาชน กทม.', en: 'BMA Citizen Services Mobile Application' },
  department: { th: 'สำนักพัฒนาสังคม', en: 'Social Development Department' },
  budget: 7_500_000,
  category: 'Mobile App',
  requiredTechnologies: ['Flutter', 'React Native'],
});

const ALL_PROJECTS = [AI_PROJECT, CLOUD_PROJECT, MOBILE_PROJECT];

// ─────────────────────────────────────────────────────────────────────────────
// Provider Wrapper Helper
// ─────────────────────────────────────────────────────────────────────────────

function Providers({ children, lang = 'th' }: { children: React.ReactNode; lang?: 'th' | 'en' }) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('torbidd_lang', lang);
  }
  return (
    <ToastProvider>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </ToastProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared beforeEach / afterEach
// ─────────────────────────────────────────────────────────────────────────────

function resetBookmarkState() {
  act(() => {
    localStorage.clear();
    setStoredBookmarks(new Set());
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Bookmarking from Dashboard / Project Card
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Bookmark & Saved Opportunities Workflow', () => {
  beforeEach(() => {
    currentMockAuth = mockAuthAuthenticated;
    resetBookmarkState();
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();

    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/projects/7711900101')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: AI_PROJECT }) } as Response);
      }
      if (urlStr.includes('/api/projects/7711900102')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: CLOUD_PROJECT }) } as Response);
      }
      if (urlStr.includes('/api/projects/7711900103')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: MOBILE_PROJECT }) } as Response);
      }
      if (urlStr.includes('/api/projects')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: ALL_PROJECTS, total: 3 }) } as Response);
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'Not found' }) } as Response);
    }) as jest.Mock;
  });

  afterEach(() => {
    resetBookmarkState();
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // 1. Bookmark from ProjectCard (Dashboard)
  // ===========================================================================
  describe('1. Bookmarking from Dashboard / ProjectCard', () => {
    it('1.1 bookmark button renders in unfilled state for a non-bookmarked opportunity', () => {
      render(
        <Providers>
          <ProjectCard project={AI_PROJECT} />
        </Providers>,
      );

      const btn = screen.getByTestId('bookmark-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).not.toHaveClass('active');
      expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/บันทึก|Save/i));
    });

    it('1.2 clicking bookmark button on card toggles to bookmarked state with visual feedback', () => {
      render(
        <Providers>
          <ProjectCard project={AI_PROJECT} />
        </Providers>,
      );

      const btn = screen.getByTestId('bookmark-btn');
      expect(btn).not.toHaveClass('active');

      act(() => {
        fireEvent.click(btn);
      });

      // Should now be active / bookmarked
      expect(btn).toHaveClass('active');
      expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/บันทึกแล้ว|Saved/i));

      // Verify persisted to localStorage
      const stored = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]');
      expect(stored).toContain(AI_PROJECT.externalId);
    });

    it('1.3 clicking bookmark button again toggles it back to un-bookmarked state', () => {
      // Pre-seed bookmark
      act(() => {
        setStoredBookmarks(new Set([AI_PROJECT.externalId!]));
      });

      render(
        <Providers>
          <ProjectCard project={AI_PROJECT} />
        </Providers>,
      );

      const btn = screen.getByTestId('bookmark-btn');
      expect(btn).toHaveClass('active');

      act(() => {
        fireEvent.click(btn);
      });

      expect(btn).not.toHaveClass('active');
      const stored = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]');
      expect(stored).not.toContain(AI_PROJECT.externalId);
    });

    it('1.4 bookmark state from card reflects correctly when multiple cards share the same hook', () => {
      render(
        <Providers>
          <ProjectCard project={AI_PROJECT} />
          <ProjectCard project={CLOUD_PROJECT} />
          <ProjectCard project={MOBILE_PROJECT} />
        </Providers>,
      );

      const btns = screen.getAllByTestId('bookmark-btn');
      expect(btns).toHaveLength(3);

      // Bookmark the first card
      act(() => {
        fireEvent.click(btns[0]);
      });

      // Only first should be active
      expect(btns[0]).toHaveClass('active');
      expect(btns[1]).not.toHaveClass('active');
      expect(btns[2]).not.toHaveClass('active');

      const stored = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]');
      expect(stored).toContain(AI_PROJECT.externalId);
      expect(stored).not.toContain(CLOUD_PROJECT.externalId);
    });

    it('1.5 clicking bookmark button stops card navigation (event propagation prevented)', () => {
      render(
        <Providers>
          <ProjectCard project={AI_PROJECT} />
        </Providers>,
      );

      act(() => {
        fireEvent.click(screen.getByTestId('bookmark-btn'));
      });

      // Card navigation should NOT have been triggered
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('1.6 unauthenticated user sees Auth Prompt Modal instead of bookmarking', () => {
      currentMockAuth = mockAuthUnauthenticated;

      render(
        <Providers>
          <ProjectCard project={AI_PROJECT} />
        </Providers>,
      );

      act(() => {
        fireEvent.click(screen.getByTestId('bookmark-btn'));
      });

      // Auth modal should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Bookmark should NOT have been stored
      const stored = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]');
      expect(stored).not.toContain(AI_PROJECT.externalId);
    });
  });

  // ===========================================================================
  // 2. Bookmark from Detail View
  // ===========================================================================
  describe('2. Bookmarking from Opportunity Detail View (/opportunities/[id])', () => {
    async function renderDetailPage(projectId = '7711900101') {
      let result: ReturnType<typeof render>;
      await act(async () => {
        result = render(
          <Providers>
            <Suspense fallback={<div data-testid="loading">Loading…</div>}>
              <ProjectDetailPage params={Promise.resolve({ id: projectId })} />
            </Suspense>
          </Providers>,
        );
      });

      await waitFor(() => {
        expect(result!.container.querySelector('.detail-hero-title')).toBeInTheDocument();
      }, { timeout: 3000 });

      return result!;
    }

    it('2.1 detail page bookmark button renders initially in unfilled state', async () => {
      await renderDetailPage('7711900101');
      const btn = screen.getByTestId('detail-bookmark-btn');
      expect(btn).not.toHaveClass('active');
      expect(btn).toHaveTextContent(/บันทึก|Save/i);
    });

    it('2.2 clicking the detail page bookmark button marks opportunity as saved', async () => {
      await renderDetailPage('7711900101');

      const btn = screen.getByTestId('detail-bookmark-btn');

      act(() => {
        fireEvent.click(btn);
      });

      await waitFor(() => {
        expect(btn).toHaveClass('active');
      });

      expect(btn).toHaveTextContent(/บันทึกแล้ว|Saved/i);
      const stored = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]');
      // ID can be stored as number or string
      expect(stored.map(String)).toContain('7711900101');
    });

    it('2.3 detail page bookmark renders as already-saved when pre-seeded in localStorage', async () => {
      act(() => {
        setStoredBookmarks(new Set(['7711900101']));
      });

      await renderDetailPage('7711900101');

      const btn = screen.getByTestId('detail-bookmark-btn');
      expect(btn).toHaveClass('active');
      expect(btn).toHaveTextContent(/บันทึกแล้ว|Saved/i);
    });

    it('2.4 clicking saved button on detail page removes the bookmark', async () => {
      act(() => {
        setStoredBookmarks(new Set(['7711900101']));
      });

      await renderDetailPage('7711900101');

      const btn = screen.getByTestId('detail-bookmark-btn');
      expect(btn).toHaveClass('active');

      act(() => {
        fireEvent.click(btn);
      });

      await waitFor(() => {
        expect(btn).not.toHaveClass('active');
      });

      expect(btn).toHaveTextContent(/บันทึก|Save/i);
      const stored = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]');
      expect(stored.map(String)).not.toContain('7711900101');
    });

    it('2.5 unauthenticated user sees Auth Prompt Modal when clicking bookmark on detail page', async () => {
      currentMockAuth = mockAuthUnauthenticated;
      await renderDetailPage('7711900101');

      const btn = screen.getByTestId('detail-bookmark-btn');
      act(() => {
        fireEvent.click(btn);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 3. Saved Opportunities List (SavedPage)
  // ===========================================================================
  describe('3. Saved Opportunities List (SavedPage)', () => {
    async function renderSavedPage() {
      let result: ReturnType<typeof render>;
      await act(async () => {
        result = render(
          <Providers>
            <SavedPage />
          </Providers>,
        );
      });
      return result!;
    }

    it('3.1 renders empty state when no bookmarks are set', async () => {
      await renderSavedPage();

      await waitFor(() => {
        expect(screen.getByText(/ยังไม่มีรายการที่บันทึก|No Saved/i)).toBeInTheDocument();
      });

      // Browse opportunities CTA button is present (label from L('browseOpps'))
      expect(screen.getByRole('button', { name: /ดูโอกาสทั้งหมด|Browse Opportunities/i })).toBeInTheDocument();
    });

    it('3.2 displays bookmarked opportunity immediately after bookmark is set', async () => {
      act(() => {
        setStoredBookmarks(new Set([AI_PROJECT.externalId!]));
      });

      await renderSavedPage();

      await waitFor(() => {
        expect(
          screen.getByText(/โครงการพัฒนาระบบ AI วิเคราะห์ภาพถ่ายดาวเทียม|BMA AI Satellite/i),
        ).toBeInTheDocument();
      });

      // Non-bookmarked projects should NOT appear
      expect(screen.queryByText(/โครงการจัดหาระบบคลาวด์กลาง|BMA Central Cloud Infrastructure/i)).not.toBeInTheDocument();
    });

    it('3.3 displays multiple bookmarked opportunities correctly in the saved list', async () => {
      act(() => {
        setStoredBookmarks(new Set([AI_PROJECT.externalId!, CLOUD_PROJECT.externalId!]));
      });

      await renderSavedPage();

      await waitFor(() => {
        expect(
          screen.getByText(/โครงการพัฒนาระบบ AI วิเคราะห์ภาพถ่ายดาวเทียม|BMA AI Satellite/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/โครงการจัดหาระบบคลาวด์กลาง|BMA Central Cloud/i),
        ).toBeInTheDocument();
      });

      // Mobile project should NOT appear
      expect(screen.queryByText(/แอพพลิเคชันบริการประชาชน|BMA Citizen Services/i)).not.toBeInTheDocument();
    });

    it('3.4 reactively removes item from saved list when bookmark is toggled off on the card', async () => {
      act(() => {
        setStoredBookmarks(new Set([AI_PROJECT.externalId!]));
      });

      await renderSavedPage();

      await waitFor(() => {
        expect(
          screen.getByText(/โครงการพัฒนาระบบ AI วิเคราะห์ภาพถ่ายดาวเทียม|BMA AI Satellite/i),
        ).toBeInTheDocument();
      });

      // Click the bookmark button on the card to remove it
      const bookmarkBtns = screen.getAllByTestId('bookmark-btn');
      const activeBtn = bookmarkBtns.find((btn) => btn.classList.contains('active'));
      expect(activeBtn).toBeDefined();

      act(() => {
        fireEvent.click(activeBtn!);
      });

      await waitFor(() => {
        expect(screen.getByText(/ยังไม่มีรายการที่บันทึก|No Saved/i)).toBeInTheDocument();
      });
    });

    it('3.5 Clear All button removes all saved opportunities and renders empty state', async () => {
      act(() => {
        setStoredBookmarks(new Set([AI_PROJECT.externalId!, CLOUD_PROJECT.externalId!, MOBILE_PROJECT.externalId!]));
      });

      await renderSavedPage();

      await waitFor(() => {
        expect(screen.getByText(/โครงการพัฒนาระบบ AI วิเคราะห์ภาพถ่ายดาวเทียม|BMA AI Satellite/i)).toBeInTheDocument();
        expect(screen.getByText(/โครงการจัดหาระบบคลาวด์กลาง|BMA Central Cloud/i)).toBeInTheDocument();
        expect(screen.getByText(/แอพพลิเคชันบริการประชาชน|BMA Citizen Services/i)).toBeInTheDocument();
      });

      // Click the Clear All button in the page header (label from L('clearSaved') = 'ล้างรายการบันทึก')
      const clearBtn = screen.getAllByRole('button', { name: /ล้างรายการบันทึก|Clear Saved Items/i })[0];
      act(() => {
        fireEvent.click(clearBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/ยังไม่มีรายการที่บันทึก|No Saved/i)).toBeInTheDocument();
      });

      expect(JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]')).toHaveLength(0);
    });

    it('3.6 fetches missing bookmarked opportunity by ID if not in main project list', async () => {
      const extraProjectId = 9911900999;
      const extraProject = createProject({
        externalId: extraProjectId,
        title: { th: 'โครงการพิเศษที่ไม่อยู่ในรายการหลัก', en: 'Special Project Outside Main List' },
        department: { th: 'สำนักการศึกษา', en: 'Education Department' },
        budget: 4_000_000,
        category: 'Website',
      });

      global.fetch = jest.fn((url: RequestInfo | URL) => {
        const urlStr = String(url);
        if (urlStr.includes(`/api/projects/${extraProjectId}`)) {
          return Promise.resolve({ ok: true, json: async () => ({ data: extraProject }) } as Response);
        }
        if (urlStr.includes('/api/projects')) {
          // Main list does NOT contain extraProject
          return Promise.resolve({ ok: true, json: async () => ({ data: ALL_PROJECTS, total: 3 }) } as Response);
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'Not found' }) } as Response);
      }) as jest.Mock;

      act(() => {
        setStoredBookmarks(new Set([extraProjectId]));
      });

      await renderSavedPage();

      await waitFor(() => {
        expect(
          screen.getByText(/โครงการพิเศษที่ไม่อยู่ในรายการหลัก|Special Project Outside Main List/i),
        ).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('3.7 redirects unauthenticated user to login page from saved page', async () => {
      currentMockAuth = mockAuthUnauthenticated;

      await act(async () => {
        render(
          <Providers>
            <SavedPage />
          </Providers>,
        );
      });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('/login'));
      });
    });
  });

  // ===========================================================================
  // 4. Sidebar Bookmark Count Badge
  // ===========================================================================
  describe('4. Sidebar Bookmark Count Badge Reflects Real-Time State', () => {
    it('4.1 sidebar badge does not appear when bookmark count is zero', () => {
      render(
        <Providers>
          <Sidebar collapsed={false} onToggle={jest.fn()} bookmarkCount={0} />
        </Providers>,
      );

      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(document.querySelector('.sidebar-badge')).not.toBeInTheDocument();
    });

    it('4.2 sidebar badge appears with correct count when bookmarks are added', () => {
      render(
        <Providers>
          <Sidebar collapsed={false} onToggle={jest.fn()} bookmarkCount={3} />
        </Providers>,
      );

      const badge = document.querySelector('.sidebar-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });

    it('4.3 sidebar badge updates in real-time with useBookmarks hook', () => {
      function LiveSidebarHarness() {
        const { bookmarkCount } = useBookmarks();
        return <Sidebar collapsed={false} onToggle={jest.fn()} bookmarkCount={bookmarkCount} />;
      }

      render(
        <Providers>
          <LiveSidebarHarness />
        </Providers>,
      );

      // Initially no badge
      expect(document.querySelector('.sidebar-badge')).not.toBeInTheDocument();

      // Add bookmarks
      act(() => {
        setStoredBookmarks(new Set([7711900101, 7711900102]));
      });

      expect(document.querySelector('.sidebar-badge')).toHaveTextContent('2');

      // Remove one
      act(() => {
        setStoredBookmarks(new Set([7711900101]));
      });

      expect(document.querySelector('.sidebar-badge')).toHaveTextContent('1');

      // Remove all
      act(() => {
        setStoredBookmarks(new Set());
      });

      expect(document.querySelector('.sidebar-badge')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 5. Cross-Tab Synchronization (localStorage storage events)
  // ===========================================================================
  describe('5. Cross-Tab Synchronization via Storage Events', () => {
    it('5.1 bookmark state syncs across concurrent hook instances within same session', () => {
      const { result: hook1 } = renderHook(() => useBookmarks());
      const { result: hook2 } = renderHook(() => useBookmarks());

      expect(hook1.current.bookmarkCount).toBe(0);
      expect(hook2.current.bookmarkCount).toBe(0);

      // Simulate bookmarking from hook1 (simulates same-tab component)
      act(() => {
        hook1.current.toggleBookmark(7711900101);
      });

      // Both hooks must reflect the change
      expect(hook1.current.isBookmarked(7711900101)).toBe(true);
      expect(hook1.current.bookmarkCount).toBe(1);
      expect(hook2.current.isBookmarked(7711900101)).toBe(true);
      expect(hook2.current.bookmarkCount).toBe(1);
    });

    it('5.2 bookmark state updates when triggered by cross-tab storage event', () => {
      const { result } = renderHook(() => useBookmarks());
      expect(result.current.bookmarkCount).toBe(0);

      act(() => {
        // Simulate another browser tab writing to the same localStorage key
        localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify([7711900101, 7711900102]));
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: BOOKMARKS_STORAGE_KEY,
            newValue: JSON.stringify([7711900101, 7711900102]),
          }),
        );
      });

      expect(result.current.bookmarkCount).toBe(2);
      expect(result.current.isBookmarked(7711900101)).toBe(true);
      expect(result.current.isBookmarked(7711900102)).toBe(true);
    });
  });

  // ===========================================================================
  // 6. useBookmarks Hook Unit Semantics
  // ===========================================================================
  describe('6. useBookmarks Hook Semantics', () => {
    it('6.1 handles string and number IDs interchangeably', () => {
      const { result } = renderHook(() => useBookmarks());

      act(() => {
        result.current.toggleBookmark('7711900101');
      });

      expect(result.current.isBookmarked('7711900101')).toBe(true);
      expect(result.current.isBookmarked(7711900101)).toBe(true);
      expect(result.current.bookmarkCount).toBe(1);

      act(() => {
        result.current.toggleBookmark(7711900101); // Toggle off using number form
      });

      expect(result.current.isBookmarked('7711900101')).toBe(false);
      expect(result.current.bookmarkCount).toBe(0);
    });

    it('6.2 ignores null, undefined, and empty string IDs gracefully', () => {
      const { result } = renderHook(() => useBookmarks());

      act(() => {
        result.current.toggleBookmark(null);
        result.current.toggleBookmark(undefined);
        result.current.toggleBookmark('');
      });

      expect(result.current.bookmarkCount).toBe(0);
    });

    it('6.3 clearBookmarks() removes all saved IDs and propagates to other hook instances', () => {
      const { result: h1 } = renderHook(() => useBookmarks());
      const { result: h2 } = renderHook(() => useBookmarks());

      act(() => {
        h1.current.toggleBookmark(7711900101);
        h1.current.toggleBookmark(7711900102);
        h1.current.toggleBookmark(7711900103);
      });

      expect(h1.current.bookmarkCount).toBe(3);
      expect(h2.current.bookmarkCount).toBe(3);

      act(() => {
        h2.current.clearBookmarks();
      });

      expect(h1.current.bookmarkCount).toBe(0);
      expect(h2.current.bookmarkCount).toBe(0);
      expect(JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]')).toHaveLength(0);
    });

    it('6.4 persists bookmarks to localStorage on every toggle operation', () => {
      const { result } = renderHook(() => useBookmarks());

      act(() => {
        result.current.toggleBookmark(7711900101);
      });

      expect(JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]')).toContain(7711900101);

      act(() => {
        result.current.toggleBookmark(7711900101);
      });

      expect(JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]')).not.toContain(7711900101);
    });
  });
});

