/**
 * E2E: Auth Gating — UI Component Tests
 *
 * Verifies that UI components correctly:
 *  1. Allow unauthenticated visitors to browse public content (listing cards).
 *  2. Prompt unauthenticated visitors with an AuthPromptModal when they attempt
 *     protected actions: Bookmark, Compare, Set Alert.
 *  3. Allow the modal to be dismissed via close button or Escape key.
 *
 * Runs in jsdom environment (default). Does NOT import NextRequest/middleware —
 * those are covered in auth-gating-middleware.test.ts (node environment).
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectCard } from '@/components/ui/ProjectCard';
import ProjectDetailPage from '@/app/opportunities/[id]/page';
import { SetAlertModal } from '@/components/ui/SetAlertModal';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Project } from '@/types/project';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — must be before any imports that rely on them
// ─────────────────────────────────────────────────────────────────────────────

// AuthContext — factory mock; updated per-test via `mockAuthValues`
let mockAuthValues = {
  user: null as null | { email: string },
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshUser: jest.fn(),
  updateProfile: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthValues,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  usePathname: () => '/opportunities',
  useSearchParams: () => new URLSearchParams(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Sample project fixture
// ─────────────────────────────────────────────────────────────────────────────
const sampleProject: Project = {
  _id: 'proj_cloud_001',
  externalId: 67119538991,
  title: {
    th: 'โครงการจัดหาระบบคลาวด์กลาง กทม. และศูนย์สำรองข้อมูล',
    en: 'BMA Central Cloud System & Disaster Recovery Center',
  },
  department: {
    th: 'สำนักยุทธศาสตร์และประเมินผล',
    en: 'Strategy and Evaluation Department',
  },
  budget: 50_000_000,
  historicalAvg: 50_000_000,
  contractPrice: 48_000_000,
  deadline: '2026-12-31T17:00:00.000Z',
  publishDate: '2026-01-15T09:00:00.000Z',
  category: 'Cloud',
  procurementType: 'ประกวดราคาอิเล็กทรอนิกส์ (e-Bidding)',
  torStatus: 'AVAILABLE',
  aiConfidence: 'High',
  description: {
    th: 'จัดหาระบบคลาวด์และศูนย์ข้อมูลสำรองสำหรับหน่วยงาน กทม.',
    en: 'Central cloud infrastructure and DR center for BMA',
  },
  scope: {
    th: ['จัดหาระบบคลาวด์'],
    en: ['Cloud procurement'],
  },
  qualifications: {
    th: ['มีประสบการณ์'],
    en: ['Experienced'],
  },
  sourceDocument: 'TOR-Cloud.pdf',
  processedDate: '2026-01-15T09:00:00.000Z',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function renderCard(isAuthenticated = false) {
  mockAuthValues = { ...mockAuthValues, isAuthenticated, user: isAuthenticated ? { email: 'u@example.com' } : null };
  return render(
    <LanguageProvider>
      <ProjectCard project={sampleProject} />
    </LanguageProvider>,
  );
}

function renderSetAlert(isAuthenticated = false) {
  mockAuthValues = { ...mockAuthValues, isAuthenticated, user: isAuthenticated ? { email: 'u@example.com' } : null };
  return render(
    <LanguageProvider>
      <SetAlertModal project={sampleProject} isOpen onClose={jest.fn()} />
    </LanguageProvider>,
  );
}

async function renderDetail(isAuthenticated = false) {
  mockAuthValues = { ...mockAuthValues, isAuthenticated, user: isAuthenticated ? { email: 'u@example.com' } : null };
  await act(async () => {
    render(
      <ToastProvider>
        <LanguageProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <ProjectDetailPage params={Promise.resolve({ id: '67119538991' })} />
          </Suspense>
        </LanguageProvider>
      </ToastProvider>,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Auth Gating — UI Components', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to unauthenticated guest by default
    mockAuthValues = {
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      updateProfile: jest.fn(),
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/projects/')) {
        return {
          ok: true,
          json: async () => ({ data: sampleProject }),
        };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Public Feature Access (Unauthenticated)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Public Feature Access (Unauthenticated)', () => {
    it('1.1 allows an unauthenticated visitor to view a listing card without redirect', () => {
      renderCard(false);

      // Card title is visible
      expect(
        screen.getByText(/โครงการจัดหาระบบคลาวด์กลาง กทม\.|BMA Central Cloud System/i),
      ).toBeInTheDocument();

      // Department is visible
      expect(
        screen.getByText(/สำนักยุทธศาสตร์และประเมินผล|Strategy and Evaluation/i),
      ).toBeInTheDocument();

      // No auth modal shown on load
      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Protected Features: Bookmarks
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Protected Features: Bookmarks Gating', () => {
    it('2.1 shows sign-in modal when unauthenticated visitor clicks Bookmark on a listing card', () => {
      renderCard(false);

      const bookmarkBtn = screen.getByTestId('bookmark-btn');
      expect(bookmarkBtn).toBeInTheDocument();

      // Modal absent before interaction
      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();

      fireEvent.click(bookmarkBtn);

      // Auth modal appears
      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
      expect(screen.getByTestId('auth-modal-title')).toHaveTextContent(/เข้าสู่ระบบ|Sign In/i);
      expect(screen.getByTestId('auth-modal-desc')).toHaveTextContent(/บันทึก|bookmark/i);
    });

    it('2.2 Sign-In link in bookmark modal points to /login with a `from` parameter', () => {
      renderCard(false);
      fireEvent.click(screen.getByTestId('bookmark-btn'));

      const signInLink = screen.getByTestId('auth-modal-signin-btn');
      expect(signInLink.getAttribute('href')).toContain('/login?from=');
    });

    it('2.3 does NOT show auth modal when an authenticated user clicks Bookmark', () => {
      renderCard(true);
      fireEvent.click(screen.getByTestId('bookmark-btn'));

      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });

    it('2.4 shows sign-in modal when unauthenticated visitor clicks Bookmark on detail page', async () => {
      await renderDetail(false);

      await waitFor(() => {
        expect(screen.getByTestId('detail-bookmark-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('detail-bookmark-btn'));

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
      expect(screen.getByTestId('auth-modal-title')).toHaveTextContent(/เข้าสู่ระบบ|Sign In/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Protected Features: Comparisons
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Protected Features: Comparisons Gating', () => {
    it('3.1 shows sign-in modal when unauthenticated visitor clicks Compare on a listing card', () => {
      renderCard(false);

      const compareBtn = screen.getByTestId('card-compare-btn');
      expect(compareBtn).toBeInTheDocument();

      fireEvent.click(compareBtn);

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
      expect(screen.getByTestId('auth-modal-title')).toHaveTextContent(/เปรียบเทียบ|Compare/i);
    });

    it('3.2 Sign-In link in comparison modal points to /login', () => {
      renderCard(false);
      fireEvent.click(screen.getByTestId('card-compare-btn'));

      const signInLink = screen.getByTestId('auth-modal-signin-btn');
      expect(signInLink.getAttribute('href')).toContain('/login');
    });

    it('3.3 shows sign-in modal when unauthenticated visitor clicks Compare on detail page', async () => {
      await renderDetail(false);

      await waitFor(() => {
        expect(screen.getByTestId('detail-compare-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('detail-compare-btn'));

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
      expect(screen.getByTestId('auth-modal-title')).toHaveTextContent(/เปรียบเทียบ|Compare/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Protected Features: Alerts (via SetAlertModal)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Protected Features: Alerts Gating', () => {
    it('4.1 shows sign-in modal when unauthenticated user tries to save alert settings', () => {
      renderSetAlert(false);

      // Save button is present
      const saveBtn = screen.getByText(/Save Alert Settings|บันทึกการตั้งค่าการแจ้งเตือน/i);
      expect(saveBtn).toBeInTheDocument();

      // Clicking save while unauthenticated triggers auth modal
      fireEvent.click(saveBtn);

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
      expect(screen.getByTestId('auth-modal-title')).toHaveTextContent(/แจ้งเตือน|Alert/i);
    });

    it('4.2 Sign-In link in alert modal points to /login', () => {
      renderSetAlert(false);
      fireEvent.click(screen.getByText(/Save Alert Settings|บันทึกการตั้งค่าการแจ้งเตือน/i));

      const signInLink = screen.getByTestId('auth-modal-signin-btn');
      expect(signInLink.getAttribute('href')).toContain('/login?from=');
    });

    it('4.3 shows sign-in modal when unauthenticated visitor clicks Set Alert on detail page', async () => {
      await renderDetail(false);

      await waitFor(() => {
        expect(screen.getByTestId('detail-alert-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('detail-alert-btn'));

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
      expect(screen.getByTestId('auth-modal-title')).toHaveTextContent(/แจ้งเตือน|Alert/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Modal Dismissal & Interaction
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Modal Dismissal & Interaction', () => {
    it('5.1 visitor can dismiss the auth modal using the close button', () => {
      renderCard(false);

      fireEvent.click(screen.getByTestId('bookmark-btn'));
      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('auth-modal-close-btn'));

      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });

    it('5.2 visitor can dismiss the auth modal by pressing Escape', () => {
      renderCard(false);

      fireEvent.click(screen.getByTestId('bookmark-btn'));
      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });

    it('5.3 visitor can dismiss the auth modal using the "Maybe Later" cancel button', () => {
      renderCard(false);

      fireEvent.click(screen.getByTestId('bookmark-btn'));
      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('auth-modal-cancel-btn'));

      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });
  });
});

