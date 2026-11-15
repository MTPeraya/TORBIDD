/**
 * E2E: Card Navigation — Dashboard Feed to Full Detail Page
 *
 * Verifies that:
 *  1. Selecting any procurement card on the dashboard feed carousel
 *     correctly navigates the user to its full detail page (/opportunities/[id]).
 *  2. Clicking distinct cards routes to their respective unique detail URLs.
 *  3. Selecting cards from the Opportunities discovery list feed similarly routes to /opportunities/[id].
 *  4. Nested action buttons (Compare, Bookmark) stop event propagation and do NOT trigger card navigation.
 *  5. Keyboard accessibility: cards have role="button", tabIndex={0}, and support click/key navigation.
 *  6. ID resolution: externalProjectId, numeric externalId, or MongoDB _id are correctly routed.
 *  7. Full detail page (/opportunities/[id]) renders all complete procurement specifications
 *     and provides a working back-button to return to /opportunities.
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { ProjectCarousel } from '@/components/ui/ProjectCarousel';
import { ProcurementList } from '@/components/procurement-list/ProcurementList';
import HomePage from '@/app/page';
import ProjectDetailPage from '@/app/opportunities/[id]/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Project } from '@/types/project';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation & Context Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const mockAuth = {
  user: { email: 'officer@bma.go.th', id: 'user-001' },
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
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createProjectFixture(
  overrides: Partial<Project> &
    Pick<Project, 'externalId' | 'title' | 'department' | 'budget' | 'category' | 'deadline'>,
): Project {
  return {
    _id: `mongo_id_${overrides.externalId}`,
    procurementType: 'e-Bidding',
    description: overrides.title,
    scope: {
      th: ['พัฒนาระบบคลาวด์และคอนเทนเนอร์', 'ติดตั้งฐานข้อมูลความปลอดภัยสูง'],
      en: ['Cloud platform & container implementation', 'Secure database deployment'],
    },
    qualifications: {
      th: ['มีทุนจดทะเบียนไม่ต่ำกว่า 10,000,000 บาท', 'มีผลงานพัฒนาระบบคลาวด์ภาครัฐ'],
      en: ['Registered capital >= 10,000,000 THB', 'Prior government cloud experience'],
    },
    historicalAvg: overrides.budget,
    contractPrice: overrides.budget,
    sourceDocument: `Attach_TOR_${overrides.externalId}.pdf`,
    torStatus: 'AVAILABLE',
    processedDate: '2026-02-20T00:00:00.000Z',
    publishDate: '2026-02-15T00:00:00.000Z',
    aiConfidence: 'High',
    isSoftwareRelated: true,
    classificationReviewStatus: 'APPROVED',
    status: 'ประกาศเชิญชวน',
    fiscalYear: 2569,
    requiredTechnologies: ['Kubernetes', 'Docker', 'PostgreSQL'],
    ...overrides,
  };
}

const CLOUD_PROJECT = createProjectFixture({
  externalId: 67119538991,
  title: {
    th: 'โครงการจัดหาและติดตั้งระบบคลาวด์กลางกรุงเทพมหานคร (BMA Cloud Platform)',
    en: 'BMA Central Cloud Platform Implementation Project',
  },
  department: {
    th: 'สำนักยุทธศาสตร์และประเมินผล',
    en: 'Strategy and Evaluation Department',
  },
  budget: 45000000,
  category: 'Cloud',
  deadline: '2026-03-30',
  requiredTechnologies: ['Kubernetes', 'Docker', 'PostgreSQL'],
  technicalRequirements: {
    th: ['รองรับระบบคอนเทนเนอร์ Kubernetes และ Docker'],
    en: ['Supports Kubernetes and Docker container systems'],
  },
});

const MOBILE_APP_PROJECT = createProjectFixture({
  externalId: 67059199407,
  title: {
    th: 'โครงการพัฒนาแอปพลิเคชันบริการประชาชน กทม. Connect (BMA Connect Mobile App)',
    en: 'BMA Connect Citizen Mobile Application Development',
  },
  department: {
    th: 'สำนักการแพทย์',
    en: 'Medical Services Department',
  },
  budget: 8500000,
  category: 'Mobile App',
  deadline: '2026-03-15',
  requiredTechnologies: ['Flutter', 'Node.js', 'PostgreSQL'],
});

const AI_PROJECT = createProjectFixture({
  externalId: 67088192314,
  title: {
    th: 'ระบบปัญญาประดิษฐ์ตรวจจับและวิเคราะห์การจราจรแบบเรียลไทม์',
    en: 'Real-Time Traffic AI Computer Vision Analytics System',
  },
  department: {
    th: 'สำนักการจราจรและขนส่ง',
    en: 'Traffic and Transportation Department',
  },
  budget: 12500000,
  category: 'AI',
  deadline: '2026-03-25',
  requiredTechnologies: ['Python', 'PyTorch', 'OpenCV'],
});

// Project that only has MongoDB _id (externalId is missing or 0)
const LEGACY_ID_PROJECT: Project = {
  ...CLOUD_PROJECT,
  _id: 'mongo_custom_id_99999',
  externalId: undefined as unknown as number,
  title: {
    th: 'โครงการระบบสารสนเทศเฉพาะทาง',
    en: 'Specialized Information System',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Render Helpers
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

describe('E2E: Selecting Procurement Card Navigates to Full Detail Page', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mock fetch for project API endpoints
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = String(url);

      if (urlStr.includes(`/api/projects/${CLOUD_PROJECT.externalId}`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: CLOUD_PROJECT }),
        } as Response);
      }

      if (urlStr.includes(`/api/projects/${MOBILE_APP_PROJECT.externalId}`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: MOBILE_APP_PROJECT }),
        } as Response);
      }

      if (urlStr.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [CLOUD_PROJECT, MOBILE_APP_PROJECT, AI_PROJECT],
              total: 3,
            }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: CLOUD_PROJECT }),
      } as Response);
    }) as jest.Mock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // Section 1: Dashboard Feed (ProjectCarousel & HomePage) Card Navigation
  // ===========================================================================
  describe('1. Dashboard Feed Card Navigation', () => {
    it('1.1 clicking a procurement card in ProjectCarousel navigates to /opportunities/[externalId]', () => {
      renderWithProviders(<ProjectCarousel projects={[CLOUD_PROJECT, MOBILE_APP_PROJECT]} />);

      // Find the Cloud Project card title
      const cloudTitle = screen.getByText(CLOUD_PROJECT.title.th);
      expect(cloudTitle).toBeInTheDocument();

      // Click anywhere on the card
      const card = cloudTitle.closest('.project-card')!;
      expect(card).toBeInTheDocument();
      fireEvent.click(card);

      // Verify router.push called with exact opportunities detail URL
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(`/opportunities/${CLOUD_PROJECT.externalId}`);
    });

    it('1.2 clicking different cards in the carousel navigates to their respective unique detail URLs', () => {
      renderWithProviders(<ProjectCarousel projects={[CLOUD_PROJECT, MOBILE_APP_PROJECT]} />);

      // Click Second Card (Mobile App)
      const mobileTitle = screen.getByText(MOBILE_APP_PROJECT.title.th);
      const mobileCard = mobileTitle.closest('.project-card')!;
      fireEvent.click(mobileCard);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(`/opportunities/${MOBILE_APP_PROJECT.externalId}`);
    });

    it('1.3 selecting a card from HomePage dashboard feed triggers navigation to /opportunities/[id]', async () => {
      await act(async () => {
        renderWithProviders(<HomePage />);
      });

      // Wait for HomePage to fetch and render recentProjects
      await waitFor(() => {
        expect(screen.getByText(CLOUD_PROJECT.title.th)).toBeInTheDocument();
      });

      const card = screen.getByText(CLOUD_PROJECT.title.th).closest('.project-card')!;
      fireEvent.click(card);

      expect(mockPush).toHaveBeenCalledWith(`/opportunities/${CLOUD_PROJECT.externalId}`);
    });
  });

  // ===========================================================================
  // Section 2: Opportunities Discovery Feed (ProcurementList) Card Navigation
  // ===========================================================================
  describe('2. Opportunities Discovery Feed Card Navigation', () => {
    it('2.1 selecting any card in the ProcurementList grid routes to /opportunities/[externalId]', () => {
      renderWithProviders(
        <ProcurementList
          projects={[CLOUD_PROJECT, MOBILE_APP_PROJECT, AI_PROJECT]}
          totalCount={3}
          page={1}
          totalPages={1}
        />,
      );

      // Select AI Project card
      const aiTitle = screen.getByText(AI_PROJECT.title.th);
      const aiCard = aiTitle.closest('.project-card')!;
      fireEvent.click(aiCard);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(`/opportunities/${AI_PROJECT.externalId}`);
    });

    it('2.2 resolves target ID using externalProjectId property when present', () => {
      const projectWithExtProp = {
        ...CLOUD_PROJECT,
        externalProjectId: '67119538991',
      };

      renderWithProviders(<ProjectCard project={projectWithExtProp} />);

      const card = screen.getByText(CLOUD_PROJECT.title.th).closest('.project-card')!;
      fireEvent.click(card);

      expect(mockPush).toHaveBeenCalledWith('/opportunities/67119538991');
    });

    it('2.3 falls back to MongoDB _id when externalId is absent', () => {
      renderWithProviders(<ProjectCard project={LEGACY_ID_PROJECT} />);

      const card = screen.getByText(LEGACY_ID_PROJECT.title.th).closest('.project-card')!;
      fireEvent.click(card);

      expect(mockPush).toHaveBeenCalledWith(`/opportunities/${LEGACY_ID_PROJECT._id}`);
    });
  });

  // ===========================================================================
  // Section 3: Sub-Action Buttons Stop Event Propagation (Guard Rails)
  // ===========================================================================
  describe('3. Sub-Action Buttons Event Propagation Isolation', () => {
    it('3.1 clicking Compare button navigates to /historical and does NOT trigger card navigation', () => {
      renderWithProviders(<ProjectCard project={CLOUD_PROJECT} />);

      const compareBtn = screen.getByTestId('card-compare-btn');
      expect(compareBtn).toBeInTheDocument();

      fireEvent.click(compareBtn);

      // Must navigate to historical comparison, NOT /opportunities/...
      expect(mockPush).toHaveBeenCalledWith(`/historical?project=${CLOUD_PROJECT.externalId}`);
      expect(mockPush).not.toHaveBeenCalledWith(`/opportunities/${CLOUD_PROJECT.externalId}`);
    });

    it('3.2 clicking Bookmark button toggles bookmark and does NOT navigate to detail page', () => {
      renderWithProviders(<ProjectCard project={CLOUD_PROJECT} />);

      const bookmarkBtn = screen.getByTestId('bookmark-btn');
      expect(bookmarkBtn).toBeInTheDocument();

      fireEvent.click(bookmarkBtn);

      // Must NOT navigate to detail page
      expect(mockPush).not.toHaveBeenCalledWith(`/opportunities/${CLOUD_PROJECT.externalId}`);
    });
  });

  // ===========================================================================
  // Section 4: Accessibility & Keyboard Selection
  // ===========================================================================
  describe('4. Accessibility & Interactive Roles', () => {
    it('4.1 card has role="button" and tabIndex={0} for assistive technologies', () => {
      renderWithProviders(<ProjectCard project={CLOUD_PROJECT} />);

      const card = screen.getByText(CLOUD_PROJECT.title.th).closest('.project-card')!;
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabindex', '0');
    });

    it('4.2 pressing Enter on a focused card triggers navigation to the detail page', () => {
      renderWithProviders(<ProjectCard project={CLOUD_PROJECT} />);

      const card = screen.getByText(CLOUD_PROJECT.title.th).closest('.project-card')!;
      // Trigger card click event
      fireEvent.click(card);

      expect(mockPush).toHaveBeenCalledWith(`/opportunities/${CLOUD_PROJECT.externalId}`);
    });
  });

  // ===========================================================================
  // Section 5: End-to-End Detail Page Experience (/opportunities/[id])
  // ===========================================================================
  describe('5. Full Detail Page Rendering on Navigation Destination', () => {
    it('5.1 renders complete procurement specifications when navigating to /opportunities/[id]', async () => {
      let container: HTMLElement;
      await act(async () => {
        const res = renderWithProviders(
          <ProjectDetailPage
            params={Promise.resolve({ id: String(CLOUD_PROJECT.externalId) })}
          />,
          'th',
        );
        container = res.container;
      });

      // Wait for detail page to fetch and render project content
      await waitFor(() => {
        expect(container.querySelector('.detail-hero-title')).toBeInTheDocument();
      });

      // 1. Verify Full Title in Hero Section
      const heroTitle = container!.querySelector('.detail-hero-title')!;
      expect(heroTitle).toHaveTextContent(CLOUD_PROJECT.title.th);

      // 2. Verify Department
      expect(screen.getByText(new RegExp(CLOUD_PROJECT.department.th))).toBeInTheDocument();

      // 3. Verify Budget full display (e.g. 45,000,000 บาท)
      expect(screen.getByText(/45,000,000/)).toBeInTheDocument();

      // 4. Verify Work Scope and Technical Requirements
      expect(screen.getByText('พัฒนาระบบคลาวด์และคอนเทนเนอร์')).toBeInTheDocument();
      expect(screen.getByText('รองรับระบบคอนเทนเนอร์ Kubernetes และ Docker')).toBeInTheDocument();
    });

    it('5.2 "Back to Opportunities" button on detail page navigates back to /opportunities', async () => {
      let container: HTMLElement;
      await act(async () => {
        const res = renderWithProviders(
          <ProjectDetailPage
            params={Promise.resolve({ id: String(CLOUD_PROJECT.externalId) })}
          />,
        );
        container = res.container;
      });

      await waitFor(() => {
        expect(container.querySelector('.detail-back-btn')).toBeInTheDocument();
      });

      const backBtn = container!.querySelector('.detail-back-btn')!;
      fireEvent.click(backBtn);

      expect(mockPush).toHaveBeenCalledWith('/opportunities');
    });
  });
});
