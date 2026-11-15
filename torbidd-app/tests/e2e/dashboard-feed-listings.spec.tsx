/**
 * E2E: Active Software Procurement Dashboard Feed Listings
 *
 * Verifies that active software procurement listings render accurately
 * on the dashboard feed (ProjectCard, ProjectCarousel, ProcurementList)
 * with correct:
 *  1. Project Titles (Thai and English localization)
 *  2. Issuing Departments (Thai and English agency names with building iconography)
 *  3. Estimated Budgets (Millions formatting ฿XX.X ล้าน/M, exact currency, zero/N/A handling)
 *  4. Submission Deadlines (Formatted date string, locale calendar years, active open/closing-soon status)
 *  5. Software category tags and tech stack chips
 *  6. Multi-language switching (Thai <-> English) across the dashboard feed
 */

import React, { Suspense } from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { ProjectCarousel } from '@/components/ui/ProjectCarousel';
import { ProcurementList } from '@/components/procurement-list/ProcurementList';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Project } from '@/types/project';
import { formatBudget, formatDate } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// AuthContext mock
const mockAuth = {
  user: null,
  isAuthenticated: false,
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

// next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/opportunities',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Bookmarks
jest.mock('@/hooks/useBookmarks', () => ({
  useBookmarks: () => ({
    bookmarks: [],
    isBookmarked: jest.fn().mockReturnValue(false),
    toggleBookmark: jest.fn(),
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Realistic Software Procurement Test Fixtures (Bangkok Metropolitan Admin)
// ─────────────────────────────────────────────────────────────────────────────

// Compute future deadlines relative to now with distinct dates so tests remain deterministic
const NOW = new Date();
const FUTURE_20_DAYS = new Date(NOW.getTime() + 20 * 86400000).toISOString().split('T')[0];
const FUTURE_14_DAYS = new Date(NOW.getTime() + 14 * 86400000).toISOString().split('T')[0];
const FUTURE_28_DAYS = new Date(NOW.getTime() + 28 * 86400000).toISOString().split('T')[0];
const FUTURE_3_DAYS = new Date(NOW.getTime() + 3 * 86400000).toISOString().split('T')[0];
const PAST_10_DAYS = new Date(NOW.getTime() - 10 * 86400000).toISOString().split('T')[0];

function createTestProject(
  overrides: Partial<Project> &
    Pick<Project, 'externalId' | 'title' | 'department' | 'budget' | 'category' | 'deadline'>,
): Project {
  return {
    _id: `proj_${overrides.externalId}`,
    procurementType: 'e-Bidding',
    description: overrides.title,
    scope: { th: ['ขอบเขตงานระบบสารสนเทศ'], en: ['Software system scope'] },
    qualifications: { th: ['มีผลงานพัฒนาระบบ'], en: ['System development experience'] },
    processedDate: '2026-02-20T00:00:00.000Z',
    publishDate: '2026-02-15T00:00:00.000Z',
    historicalAvg: overrides.budget,
    sourceDocument: `Attach_TOR_${overrides.externalId}.pdf`,
    torStatus: 'AVAILABLE',
    aiConfidence: 'High',
    isSoftwareRelated: true,
    classificationReviewStatus: 'APPROVED',
    status: 'ประกาศเชิญชวน',
    fiscalYear: 2569,
    ...overrides,
  };
}

const CLOUD_PROJECT: Project = createTestProject({
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
  deadline: FUTURE_20_DAYS,
  requiredTechnologies: ['Kubernetes', 'Docker', 'PostgreSQL', 'Terraform'],
});

const MOBILE_APP_PROJECT: Project = createTestProject({
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
  deadline: FUTURE_3_DAYS, // Closing soon (< 7 days)
  requiredTechnologies: ['Flutter', 'Node.js', 'PostgreSQL'],
});

const AI_PROJECT: Project = createTestProject({
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
  deadline: FUTURE_14_DAYS,
  requiredTechnologies: ['Python', 'PyTorch', 'OpenCV'],
});

const DATABASE_SMALL_BUDGET_PROJECT: Project = createTestProject({
  externalId: 67033481920,
  title: {
    th: 'โครงการปรับปรุงระบบฐานข้อมูลสารสนเทศภาษีท้องถิ่น',
    en: 'Local Tax Information Database Upgrade Project',
  },
  department: {
    th: 'สำนักการคลัง',
    en: 'Finance Department',
  },
  budget: 750000, // < 1,000,000 THB to test exact thousand formatting
  category: 'Database',
  deadline: FUTURE_28_DAYS,
  procurementType: 'เฉพาะเจาะจง',
  requiredTechnologies: ['PostgreSQL', 'SQL Server'],
});

const UNANNOUNCED_BUDGET_PROJECT: Project = createTestProject({
  externalId: 67011928374,
  title: {
    th: 'โครงการจัดทำเว็บไซต์บริการข้อมูลเปิดกรุงเทพมหานคร',
    en: 'Bangkok Metropolitan Open Data Portal Website',
  },
  department: {
    th: 'สำนักยุทธศาสตร์และประเมินผล',
    en: 'Strategy and Evaluation Department',
  },
  budget: 0, // Unannounced budget
  category: 'Website',
  deadline: '', // Unknown / empty deadline
  aiConfidence: 'Medium',
});

const CLOSED_PROJECT: Project = createTestProject({
  externalId: 66099182736,
  title: {
    th: 'โครงการพัฒนาระบบ ERP บริหารงบประมาณ',
    en: 'Budget Management ERP System Development',
  },
  department: {
    th: 'สำนักการคลัง',
    en: 'Finance Department',
  },
  budget: 28000000,
  category: 'ERP',
  deadline: PAST_10_DAYS, // Past deadline
  status: 'ปิดรับข้อเสนอ',
  fiscalYear: 2568,
});

const AWARDED_PROJECT: Project = createTestProject({
  externalId: 66077182940,
  title: {
    th: 'โครงการจัดหาและพัฒนาระบบสารสนเทศโรงพยาบาล (HIS)',
    en: 'Hospital Information System (HIS) Implementation',
  },
  department: {
    th: 'สำนักการแพทย์',
    en: 'Medical Services Department',
  },
  budget: 18000000,
  contractPrice: 17200000,
  winnerName: 'บริษัท ดิจิทัล ซิสเต็มส์ คอนซัลติ้ง จำกัด',
  category: 'Information System',
  deadline: '2025-09-30',
  status: 'จัดทำสัญญาแล้ว',
  fiscalYear: 2568,
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Renderer Helper
// ─────────────────────────────────────────────────────────────────────────────
function renderWithContext(ui: React.ReactElement, lang: 'th' | 'en' = 'th') {
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
describe('E2E: Active Software Procurement Dashboard Feed Listings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // ===========================================================================
  // Section 1: ProjectCard Core Field Rendering (Single Listing Card)
  // ===========================================================================
  describe('1. ProjectCard Core Field Rendering', () => {
    it('1.1 renders accurate Thai Project Title, Issuing Department, Budget, and Deadline', () => {
      renderWithContext(<ProjectCard project={CLOUD_PROJECT} />, 'th');

      // 1. Project Title
      const titleElem = screen.getByText(CLOUD_PROJECT.title.th);
      expect(titleElem).toBeInTheDocument();
      expect(titleElem).toHaveClass('project-card-title');

      // 2. Issuing Department
      const deptElem = screen.getByText(new RegExp(CLOUD_PROJECT.department.th));
      expect(deptElem).toBeInTheDocument();

      // 3. Estimated Budget (formatted as ฿45.0 ล้าน)
      const expectedBudgetTh = formatBudget(CLOUD_PROJECT.budget, 'th');
      expect(expectedBudgetTh).toBe('฿45.0 ล้าน');
      expect(screen.getByText(expectedBudgetTh)).toBeInTheDocument();

      // 4. Submission Deadline (formatted date and label)
      const expectedDeadlineTh = formatDate(CLOUD_PROJECT.deadline, 'th');
      expect(screen.getByText(expectedDeadlineTh)).toBeInTheDocument();
      expect(screen.getByText('กำหนดปิดรับ')).toBeInTheDocument();

      // 5. Active Status Tag
      expect(screen.getByText(/เปิดรับ/i)).toBeInTheDocument();
    });

    it('1.2 renders accurate English Project Title, Issuing Department, Budget, and Deadline', () => {
      renderWithContext(<ProjectCard project={CLOUD_PROJECT} />, 'en');

      // 1. English Project Title
      expect(screen.getByText(CLOUD_PROJECT.title.en)).toBeInTheDocument();

      // 2. English Issuing Department
      expect(screen.getByText(new RegExp(CLOUD_PROJECT.department.en))).toBeInTheDocument();

      // 3. English Estimated Budget (formatted as ฿45.0 M)
      const expectedBudgetEn = formatBudget(CLOUD_PROJECT.budget, 'en');
      expect(expectedBudgetEn).toBe('฿45.0 M');
      expect(screen.getByText(expectedBudgetEn)).toBeInTheDocument();

      // 4. English Submission Deadline (formatted date and label)
      const expectedDeadlineEn = formatDate(CLOUD_PROJECT.deadline, 'en');
      expect(screen.getByText(expectedDeadlineEn)).toBeInTheDocument();
      expect(screen.getByText('Closes')).toBeInTheDocument();

      // 5. Active Status Tag (Open)
      expect(screen.getByText(/Open/i)).toBeInTheDocument();
    });

    it('1.3 formats sub-million budgets with exact thousands commas (฿750,000)', () => {
      renderWithContext(<ProjectCard project={DATABASE_SMALL_BUDGET_PROJECT} />, 'th');

      expect(screen.getByText(DATABASE_SMALL_BUDGET_PROJECT.title.th)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(DATABASE_SMALL_BUDGET_PROJECT.department.th))).toBeInTheDocument();

      // Should display exact comma-separated value: ฿750,000
      expect(screen.getByText('฿750,000')).toBeInTheDocument();
    });

    it('1.4 renders unannounced budget as "ไม่ระบุ" (TH) and "N/A" (EN)', () => {
      const { unmount } = renderWithContext(<ProjectCard project={UNANNOUNCED_BUDGET_PROJECT} />, 'th');
      expect(screen.getByText('ไม่ระบุ')).toBeInTheDocument();
      unmount();

      renderWithContext(<ProjectCard project={UNANNOUNCED_BUDGET_PROJECT} />, 'en');
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('1.5 renders warning badge for projects closing soon within 7 days', () => {
      renderWithContext(<ProjectCard project={MOBILE_APP_PROJECT} />, 'th');

      // Should have closing soon tag: ● ใกล้ปิดรับ (3ว)
      expect(screen.getByText(/ใกล้ปิดรับ/i)).toBeInTheDocument();
      expect(screen.getByText(MOBILE_APP_PROJECT.title.th)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(MOBILE_APP_PROJECT.department.th))).toBeInTheDocument();
      expect(screen.getByText(formatBudget(MOBILE_APP_PROJECT.budget, 'th'))).toBeInTheDocument();
    });

    it('1.6 displays software category badges and extracted technology tags', () => {
      renderWithContext(<ProjectCard project={CLOUD_PROJECT} />, 'th');

      // Localized category badge for Cloud
      expect(screen.getByText('คลาวด์ / โครงสร้างพื้นฐาน')).toBeInTheDocument();

      // Tech tags extracted from TOR
      expect(screen.getByText('Kubernetes')).toBeInTheDocument();
      expect(screen.getByText('Docker')).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 2: Dashboard Feed Carousel Rendering (<ProjectCarousel />)
  // ===========================================================================
  describe('2. Dashboard Feed Carousel Rendering (<ProjectCarousel />)', () => {
    const activeProjects = [
      CLOUD_PROJECT,
      MOBILE_APP_PROJECT,
      AI_PROJECT,
      DATABASE_SMALL_BUDGET_PROJECT,
    ];

    it('2.1 renders active software procurement listings in the carousel feed', () => {
      renderWithContext(<ProjectCarousel projects={activeProjects} />, 'th');

      // First page of carousel (default itemsPerPage = 2)
      // Check Project 1 (Cloud)
      expect(screen.getByText(CLOUD_PROJECT.title.th)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(CLOUD_PROJECT.department.th))).toBeInTheDocument();
      expect(screen.getByText(formatBudget(CLOUD_PROJECT.budget, 'th'))).toBeInTheDocument();
      expect(screen.getByText(formatDate(CLOUD_PROJECT.deadline, 'th'))).toBeInTheDocument();

      // Check Project 2 (Mobile App)
      expect(screen.getByText(MOBILE_APP_PROJECT.title.th)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(MOBILE_APP_PROJECT.department.th))).toBeInTheDocument();
      expect(screen.getByText(formatBudget(MOBILE_APP_PROJECT.budget, 'th'))).toBeInTheDocument();
      expect(screen.getByText(formatDate(MOBILE_APP_PROJECT.deadline, 'th'))).toBeInTheDocument();
    });

    it('2.2 navigates through pages in the carousel to display remaining software listings', () => {
      renderWithContext(<ProjectCarousel projects={activeProjects} />, 'th');

      // Carousel controls: Next button
      const nextBtn = screen.getByLabelText(/หน้าถัดไป|Next slide/i);
      expect(nextBtn).toBeInTheDocument();

      act(() => {
        nextBtn.click();
      });

      // Second page should now display AI and Database projects
      expect(screen.getByText(AI_PROJECT.title.th)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(AI_PROJECT.department.th))).toBeInTheDocument();
      expect(screen.getByText(formatBudget(AI_PROJECT.budget, 'th'))).toBeInTheDocument();
      expect(screen.getByText(formatDate(AI_PROJECT.deadline, 'th'))).toBeInTheDocument();

      expect(screen.getByText(DATABASE_SMALL_BUDGET_PROJECT.title.th)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(DATABASE_SMALL_BUDGET_PROJECT.department.th))).toBeInTheDocument();
      expect(screen.getByText('฿750,000')).toBeInTheDocument();
    });

    it('2.3 handles empty projects array gracefully without crashing', () => {
      const { container } = renderWithContext(<ProjectCarousel projects={[]} />, 'th');
      expect(container).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 3: Opportunities Discovery Feed (<ProcurementList />)
  // ===========================================================================
  describe('3. Opportunities Discovery Feed (<ProcurementList />)', () => {
    const feedProjects = [
      CLOUD_PROJECT,
      MOBILE_APP_PROJECT,
      AI_PROJECT,
      DATABASE_SMALL_BUDGET_PROJECT,
    ];

    it('3.1 renders all active software listings concurrently in the feed grid with complete metadata', () => {
      renderWithContext(
        <ProcurementList
          projects={feedProjects}
          totalCount={feedProjects.length}
          page={1}
          totalPages={1}
        />,
        'th',
      );

      // Verify each project's 4 core fields are visible simultaneously in the feed:
      feedProjects.forEach((proj) => {
        // 1. Title
        expect(screen.getByText(proj.title.th)).toBeInTheDocument();

        // 2. Issuing Department
        expect(screen.getByText(new RegExp(proj.department.th))).toBeInTheDocument();

        // 3. Estimated Budget
        const formattedBudget = formatBudget(proj.budget, 'th');
        expect(screen.getByText(formattedBudget)).toBeInTheDocument();

        // 4. Submission Deadline
        const formattedDeadline = formatDate(proj.deadline, 'th');
        expect(screen.getByText(formattedDeadline)).toBeInTheDocument();
      });
    });

    it('3.2 renders English localized feed when language is toggled to "en"', () => {
      renderWithContext(
        <ProcurementList
          projects={feedProjects}
          totalCount={feedProjects.length}
          page={1}
          totalPages={1}
        />,
        'en',
      );

      feedProjects.forEach((proj) => {
        // English Title
        expect(screen.getByText(proj.title.en)).toBeInTheDocument();

        // English Department
        expect(screen.getByText(new RegExp(proj.department.en))).toBeInTheDocument();

        // English Budget format
        const formattedBudgetEn = formatBudget(proj.budget, 'en');
        expect(screen.getByText(formattedBudgetEn)).toBeInTheDocument();

        // English Deadline format
        const formattedDeadlineEn = formatDate(proj.deadline, 'en');
        expect(screen.getByText(formattedDeadlineEn)).toBeInTheDocument();
      });
    });

    it('3.3 renders empty state message when no active software listings match filters', () => {
      renderWithContext(
        <ProcurementList
          projects={[]}
          totalCount={0}
          page={1}
          totalPages={0}
        />,
        'th',
      );

      expect(screen.getByText(/ไม่พบโครงการจัดซื้อจัดจ้างที่ตรงกับเงื่อนไข/i)).toBeInTheDocument();
    });

    it('3.4 renders loading state placeholder while active listings are fetching', () => {
      renderWithContext(
        <ProcurementList
          projects={[]}
          totalCount={0}
          isLoading={true}
        />,
        'th',
      );

      expect(screen.getByLabelText(/Loading opportunities/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Loading opportunities/i)).toHaveAttribute('aria-busy', 'true');
    });
  });

  // ===========================================================================
  // Section 4: Differentiation of Active Open vs Closed & Awarded Contracts
  // ===========================================================================
  describe('4. Active Status Differentiation in Feed', () => {
    it('4.1 marks active listings with open status tag', () => {
      renderWithContext(<ProjectCard project={CLOUD_PROJECT} />, 'th');
      expect(screen.getByText(/เปิดรับ/i)).toBeInTheDocument();
    });

    it('4.2 marks expired listings as closed with closed status tag', () => {
      renderWithContext(<ProjectCard project={CLOSED_PROJECT} />, 'th');
      expect(screen.getByText(/ปิดรับข้อเสนอ/i)).toBeInTheDocument();
    });

    it('4.3 marks awarded contracts with award status and winner name', () => {
      renderWithContext(<ProjectCard project={AWARDED_PROJECT} />, 'th');

      expect(screen.getByText(/มีผู้ชนะ\/ทำสัญญาแล้ว/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(AWARDED_PROJECT.winnerName!))).toBeInTheDocument();
      expect(screen.getByText(/จัดหาได้: ฿17.2 ล้าน/i)).toBeInTheDocument();
    });
  });
});
