/**
 * E2E: Imminent Submission Deadline Visual Highlighting & Feed Sorting (Date & Budget)
 *
 * Verifies:
 *  1. Visual highlighting for opportunities with imminent submission deadlines (<= 7 days):
 *     - Warning status dot `.tag.closing-soon-dot` with localized copy (● ใกล้ปิดรับ (Xว) / ● Closing Soon (Xd))
 *     - Prominent urgency styling on deadline date (#dc2626 red color and font-weight 600)
 *     - Accurate contrast against standard active opportunities (>7 days) and closed opportunities
 *     - DeadlineFilter urgency indicator pill with icon (⏳) and urgent count badge
 *  2. List sorting by Publication Date:
 *     - Newest announcement first (publishDate_desc)
 *     - Oldest announcement first (publishDate_asc)
 *     - Deterministic secondary tie-breaking on identical dates via externalId
 *  3. List sorting by Estimated Budget:
 *     - Highest budget first (budget_desc)
 *     - Lowest budget first (budget_asc)
 *     - Stable tie-breaking for equal budgets
 *  4. List sorting by Submission Deadline:
 *     - Closing soonest first (deadline_asc) prioritizing imminent active bids
 *     - Closing latest first (deadline_desc)
 *  5. Interactive UI integration:
 *     - Dynamic dropdown selection in ProcurementSort triggers instant reordering of the feed
 *     - Imminent urgency highlighting is preserved post-sorting
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Project } from '@/types/project';
import { ProcurementSortOption } from '@/types/procurement';
import { sortProcurements, paginateProcurements } from '@/services/procurement-search';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { ProcurementList } from '@/components/procurement-list/ProcurementList';
import { ProcurementSort } from '@/components/procurement-sort/ProcurementSort';
import { DeadlineFilter } from '@/components/procurement-filters/DeadlineFilter';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    updateProfile: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/opportunities',
  useSearchParams: () => new URLSearchParams(),
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

const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

export const SORT_AND_DEADLINE_FIXTURES: Project[] = [
  {
    externalId: 501,
    title: {
      th: 'โครงการพัฒนาระบบ AI ตรวจจับความปลอดภัย',
      en: 'AI Safety Surveillance and Detection System',
    },
    department: {
      th: 'สำนักการจราจรและขนส่ง',
      en: 'Traffic and Transport Department',
    },
    budget: 50000000,
    publishDate: '2026-08-10T00:00:00.000Z',
    // 3 days left -> Imminent submission deadline!
    deadline: new Date(now + 3 * DAY_MS).toISOString(),
    category: 'AI',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'ระบบกล้อง AI', en: 'AI Camera Vision' },
    scope: { th: ['ติดตั้งระบบ AI'], en: ['Install AI'] },
    qualifications: { th: ['มีผลงาน'], en: ['Track record'] },
    historicalAvg: 48000000,
    sourceDocument: 'doc501.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 502,
    title: {
      th: 'โครงการจัดทำระบบพอร์ทัลบริการภาครัฐ',
      en: 'Public Service Portal Development Project',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 20000000,
    publishDate: '2026-08-15T00:00:00.000Z',
    // 6 days left -> Imminent submission deadline!
    deadline: new Date(now + 6 * DAY_MS).toISOString(),
    category: 'Website',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'ระบบพอร์ทัล', en: 'Citizen Portal' },
    scope: { th: ['พัฒนาระบบเว็บ'], en: ['Web portal development'] },
    qualifications: { th: ['มีผลงาน'], en: ['Track record'] },
    historicalAvg: 19500000,
    sourceDocument: 'doc502.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 503,
    title: {
      th: 'โครงการพัฒนาแอปพลิเคชันบริหารโรงเรียน',
      en: 'School Management Mobile Application',
    },
    department: {
      th: 'สำนักการศึกษา',
      en: 'Education Department',
    },
    budget: 3000000,
    publishDate: '2026-08-01T00:00:00.000Z',
    // 20 days left -> Standard active deadline (>7 days, not imminent)
    deadline: new Date(now + 20 * DAY_MS).toISOString(),
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'แอปโรงเรียน', en: 'School mobile app' },
    scope: { th: ['พัฒนาแอป iOS/Android'], en: ['Mobile app'] },
    qualifications: { th: ['มีผลงาน'], en: ['Track record'] },
    historicalAvg: 2900000,
    sourceDocument: 'doc503.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 504,
    title: {
      th: 'โครงการพัฒนาระบบคลาวด์และคลังข้อมูล Big Data',
      en: 'Enterprise Big Data Lakehouse Platform',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 80000000,
    // Same publication date as 505 for tie-break testing
    publishDate: '2026-08-20T00:00:00.000Z',
    // 60 days left -> Distant deadline
    deadline: new Date(now + 60 * DAY_MS).toISOString(),
    category: 'Database',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'ระบบคลังข้อมูล Big Data', en: 'Big data platform' },
    scope: { th: ['Data pipeline'], en: ['Data pipeline'] },
    qualifications: { th: ['มีผลงาน'], en: ['Track record'] },
    historicalAvg: 78000000,
    sourceDocument: 'doc504.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 505,
    title: {
      th: 'โครงการจัดซื้อระบบเครือข่ายความเร็วสูง',
      en: 'High Speed Cloud Network Infrastructure',
    },
    department: {
      th: 'สำนักการแพทย์',
      en: 'Medical Services Department',
    },
    budget: 20000000, // Same budget as 502 for tie-break testing
    // Same publication date as 504 for tie-break testing
    publishDate: '2026-08-20T00:00:00.000Z',
    // 40 days left
    deadline: new Date(now + 40 * DAY_MS).toISOString(),
    category: 'Cloud',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'ระบบเครือข่าย', en: 'Network infra' },
    scope: { th: ['ติดตั้งระบบเครือข่าย'], en: ['Network setup'] },
    qualifications: { th: ['มีผลงาน'], en: ['Track record'] },
    historicalAvg: 19000000,
    sourceDocument: 'doc505.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 506,
    title: {
      th: 'โครงการบำรุงรักษาระบบคอมพิวเตอร์ที่ปิดรับแล้ว',
      en: 'Closed Computer System Maintenance Contract',
    },
    department: {
      th: 'สำนักการคลัง',
      en: 'Finance Department',
    },
    budget: 5000000,
    publishDate: '2026-07-01T00:00:00.000Z',
    // Past deadline (-5 days) -> Closed
    deadline: new Date(now - 5 * DAY_MS).toISOString(),
    category: 'Information System',
    procurementType: 'e-Bidding',
    status: 'ปิดรับข้อเสนอ',
    description: { th: 'ปิดรับแล้ว', en: 'Closed' },
    scope: { th: ['บำรุงรักษา'], en: ['Maintenance'] },
    qualifications: { th: ['มีผลงาน'], en: ['Track record'] },
    historicalAvg: 4800000,
    sourceDocument: 'doc506.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Sorting Dashboard Harness Component
// ─────────────────────────────────────────────────────────────────────────────

function InteractiveSortFeedHarness({
  initialProjects = SORT_AND_DEADLINE_FIXTURES,
  initialSort = 'publishDate_desc' as ProcurementSortOption,
}: {
  initialProjects?: Project[];
  initialSort?: ProcurementSortOption;
}) {
  const [sortBy, setSortBy] = useState<ProcurementSortOption>(initialSort);

  const sortedProjects = React.useMemo(() => {
    return sortProcurements(initialProjects, sortBy);
  }, [initialProjects, sortBy]);

  return (
    <LanguageProvider>
      <ToastProvider>
        <div data-testid="interactive-sort-feed">
          <div className="procurement-top-controls">
            <ProcurementSort value={sortBy} onChange={(newSort) => setSortBy(newSort)} />
          </div>
          <div data-testid="current-sort-display">{sortBy}</div>
          <div data-testid="feed-project-ids">
            {sortedProjects.map((p) => p.externalId).join(',')}
          </div>
          <ProcurementList projects={sortedProjects} totalCount={sortedProjects.length} />
        </div>
      </ToastProvider>
    </LanguageProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Visual Highlighting for Imminent Deadlines & List Sorting by Date/Budget', () => {
  // ===========================================================================
  // 1. Visual Highlighting for Imminent Deadlines (<= 7 days)
  // ===========================================================================
  describe('1. Visual Highlighting for Imminent Submission Deadlines', () => {
    it('1.1 renders warning tag (.tag.closing-soon-dot) with days countdown for opportunities closing in <= 7 days (Thai)', () => {
      render(
        <LanguageProvider>
          <ToastProvider>
            <ProjectCard project={SORT_AND_DEADLINE_FIXTURES[0]} />
          </ToastProvider>
        </LanguageProvider>,
      );

      // Project 501 has <= 7 days remaining -> imminent deadline!
      const statusTag = screen.getByText(/● ใกล้ปิดรับ/i);
      expect(statusTag).toBeInTheDocument();
      expect(statusTag).toHaveClass('tag', 'closing-soon-dot');
      expect(statusTag).not.toHaveClass('open-dot');
    });

    it('1.2 renders warning tag (.tag.closing-soon-dot) in English when locale is set to English', () => {
      // Set English language via localStorage
      window.localStorage.setItem('torbidd_lang', 'en');

      render(
        <LanguageProvider>
          <ToastProvider>
            <ProjectCard project={SORT_AND_DEADLINE_FIXTURES[0]} />
          </ToastProvider>
        </LanguageProvider>,
      );

      const statusTagEn = screen.getByText(/● Closing Soon/i);
      expect(statusTagEn).toBeInTheDocument();
      expect(statusTagEn).toHaveClass('tag', 'closing-soon-dot');

      window.localStorage.removeItem('torbidd_lang');
    });

    it('1.3 applies prominent urgent color (#dc2626) and font-weight 600 to imminent deadline date', () => {
      const { container } = render(
        <LanguageProvider>
          <ToastProvider>
            <ProjectCard project={SORT_AND_DEADLINE_FIXTURES[0]} />
          </ToastProvider>
        </LanguageProvider>,
      );

      // Find deadline date element inside meta item
      const deadlineValue = container.querySelector('.meta-value[style*="rgb(220, 38, 38)"]') ||
        container.querySelector('.meta-value[style*="#dc2626"]');
      expect(deadlineValue).toBeInTheDocument();
      expect(deadlineValue).toHaveStyle({
        color: '#dc2626',
        fontWeight: '600',
      });
    });

    it('1.4 does NOT apply urgent red styling to non-imminent active opportunities (>7 days remaining)', () => {
      const { container } = render(
        <LanguageProvider>
          <ToastProvider>
            <ProjectCard project={SORT_AND_DEADLINE_FIXTURES[2]} />
          </ToastProvider>
        </LanguageProvider>,
      );

      // Project 503 has > 7 days remaining -> standard active status (.open-dot)
      const openTag = screen.getByText(/● เปิดรับ/i);
      expect(openTag).toBeInTheDocument();
      expect(openTag).toHaveClass('tag', 'open-dot');
      expect(openTag).not.toHaveClass('closing-soon-dot');

      // The deadline date does NOT have urgent #dc2626 red style
      const redElement = container.querySelector('.meta-value[style*="rgb(220, 38, 38)"]') ||
        container.querySelector('.meta-value[style*="#dc2626"]');
      expect(redElement).not.toBeInTheDocument();
    });

    it('1.5 renders closed status (.closed-dot) for opportunities past deadline', () => {
      render(
        <LanguageProvider>
          <ToastProvider>
            <ProjectCard project={SORT_AND_DEADLINE_FIXTURES[5]} />
          </ToastProvider>
        </LanguageProvider>,
      );

      // Project 506 has past deadline (-5 days) -> Closed
      const closedTag = screen.getByText(/● ปิดรับข้อเสนอ/i);
      expect(closedTag).toBeInTheDocument();
      expect(closedTag).toHaveClass('tag', 'closed-dot');
    });

    it('1.6 DeadlineFilter surfaces priority urgency pill with warning icon and urgent count badge', () => {
      render(
        <LanguageProvider>
          <ToastProvider>
            <DeadlineFilter
              selectedDeadline=""
              onChange={jest.fn()}
              deadlineCounts={{ within7: 2, within30: 4, moreThan30: 2, total: 6 }}
            />
          </ToastProvider>
        </LanguageProvider>,
      );

      // Urgency option pill "ภายใน 7 วัน (ด่วนมาก)"
      const urgentPill = screen.getByRole('radio', { name: /ภายใน 7 วัน \(ด่วนมาก\)/i });
      expect(urgentPill).toBeInTheDocument();
      expect(urgentPill).toHaveClass('deadline-pill-btn', 'urgent');

      // Urgency warning icon ⏳
      expect(urgentPill).toHaveTextContent('⏳');
      // Urgent badge count (2 imminent projects)
      const urgentBadge = urgentPill.querySelector('.urgent-count');
      expect(urgentBadge).toBeInTheDocument();
      expect(urgentBadge).toHaveTextContent('2');
    });
  });

  // ===========================================================================
  // 2. List Sorting by Publication Date (Newest & Oldest)
  // ===========================================================================
  describe('2. List Sorting by Publication Date', () => {
    it('2.1 sorts by newest announcement date first (publishDate_desc)', () => {
      const sorted = sortProcurements(SORT_AND_DEADLINE_FIXTURES, 'publishDate_desc');

      // Dates:
      // 504: 2026-08-20, 505: 2026-08-20
      // 502: 2026-08-15
      // 501: 2026-08-10
      // 503: 2026-08-01
      // 506: 2026-07-01
      const ids = sorted.map((p) => p.externalId);
      expect(ids.slice(0, 2)).toEqual([505, 504]); // Secondary key: 505 > 504
      expect(ids[2]).toBe(502);
      expect(ids[3]).toBe(501);
      expect(ids[4]).toBe(503);
      expect(ids[5]).toBe(506);

      // Verify strict descending timestamps
      for (let i = 0; i < sorted.length - 1; i++) {
        const timeA = new Date(sorted[i].publishDate).getTime();
        const timeB = new Date(sorted[i + 1].publishDate).getTime();
        expect(timeA).toBeGreaterThanOrEqual(timeB);
      }
    });

    it('2.2 sorts by oldest announcement date first (publishDate_asc)', () => {
      const sorted = sortProcurements(SORT_AND_DEADLINE_FIXTURES, 'publishDate_asc');

      const ids = sorted.map((p) => p.externalId);
      expect(ids[0]).toBe(506); // 2026-07-01
      expect(ids[1]).toBe(503); // 2026-08-01
      expect(ids[2]).toBe(501); // 2026-08-10
      expect(ids[3]).toBe(502); // 2026-08-15
      expect(ids.slice(4)).toEqual([504, 505]); // Secondary key: 504 < 505

      // Verify strict ascending timestamps
      for (let i = 0; i < sorted.length - 1; i++) {
        const timeA = new Date(sorted[i].publishDate).getTime();
        const timeB = new Date(sorted[i + 1].publishDate).getTime();
        expect(timeA).toBeLessThanOrEqual(timeB);
      }
    });

    it('2.3 guarantees deterministic secondary ordering using externalId when publishDates are identical', () => {
      // Projects 504 and 505 both published on 2026-08-20T00:00:00.000Z
      const sortedDesc = sortProcurements([SORT_AND_DEADLINE_FIXTURES[3], SORT_AND_DEADLINE_FIXTURES[4]], 'publishDate_desc');
      expect(sortedDesc.map((p) => p.externalId)).toEqual([505, 504]); // Higher externalId first

      const sortedAsc = sortProcurements([SORT_AND_DEADLINE_FIXTURES[3], SORT_AND_DEADLINE_FIXTURES[4]], 'publishDate_asc');
      expect(sortedAsc.map((p) => p.externalId)).toEqual([504, 505]); // Lower externalId first
    });
  });

  // ===========================================================================
  // 3. List Sorting by Estimated Budget (Highest & Lowest)
  // ===========================================================================
  describe('3. List Sorting by Estimated Budget', () => {
    it('3.1 sorts by highest budget first (budget_desc)', () => {
      const sorted = sortProcurements(SORT_AND_DEADLINE_FIXTURES, 'budget_desc');

      // Budgets:
      // 504: 80,000,000
      // 501: 50,000,000
      // 505: 20,000,000 (tie with 502, externalId 505 > 502)
      // 502: 20,000,000
      // 506: 5,000,000
      // 503: 3,000,000
      const ids = sorted.map((p) => p.externalId);
      expect(ids).toEqual([504, 501, 505, 502, 506, 503]);

      // Verify strict descending budgets
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].budget).toBeGreaterThanOrEqual(sorted[i + 1].budget);
      }
    });

    it('3.2 sorts by lowest budget first (budget_asc)', () => {
      const sorted = sortProcurements(SORT_AND_DEADLINE_FIXTURES, 'budget_asc');

      // Budgets ascending:
      // 503: 3,000,000
      // 506: 5,000,000
      // 502: 20,000,000 (tie with 505, externalId 502 < 505)
      // 505: 20,000,000
      // 501: 50,000,000
      // 504: 80,000,000
      const ids = sorted.map((p) => p.externalId);
      expect(ids).toEqual([503, 506, 502, 505, 501, 504]);

      // Verify strict ascending budgets
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].budget).toBeLessThanOrEqual(sorted[i + 1].budget);
      }
    });

    it('3.3 breaks ties deterministically via secondary key when budgets are identical', () => {
      // Projects 502 and 505 both have budget = 20,000,000
      const subset = [SORT_AND_DEADLINE_FIXTURES[1], SORT_AND_DEADLINE_FIXTURES[4]];
      const desc = sortProcurements(subset, 'budget_desc');
      expect(desc.map((p) => p.externalId)).toEqual([505, 502]);

      const asc = sortProcurements(subset, 'budget_asc');
      expect(asc.map((p) => p.externalId)).toEqual([502, 505]);
    });
  });

  // ===========================================================================
  // 4. List Sorting by Submission Deadline Urgency
  // ===========================================================================
  describe('4. List Sorting by Submission Deadline Urgency', () => {
    it('4.1 sorts by deadline ascending (closing soonest first), prioritizing imminent active bids', () => {
      const sorted = sortProcurements(SORT_AND_DEADLINE_FIXTURES, 'deadline_asc');

      // Active deadlines ascending:
      // 501: 3 days left (imminent!)
      // 502: 6 days left (imminent!)
      // 503: 20 days left
      // 505: 40 days left
      // 504: 60 days left
      // 506: closed (-5 days) -> placed at the very end
      const ids = sorted.map((p) => p.externalId);
      expect(ids.slice(0, 2)).toEqual([501, 502]); // Imminent opportunities come first
      expect(ids[2]).toBe(503);
      expect(ids[3]).toBe(505);
      expect(ids[4]).toBe(504);
      expect(ids[5]).toBe(506); // Closed project pushed to end
    });

    it('4.2 sorts by deadline descending (closing latest first)', () => {
      const sorted = sortProcurements(SORT_AND_DEADLINE_FIXTURES, 'deadline_desc');

      // Furthest deadline first:
      // 504 (60 days), 505 (40 days), 503 (20 days), 502 (6 days), 501 (3 days), 506 (past)
      const ids = sorted.map((p) => p.externalId);
      expect(ids[0]).toBe(504);
      expect(ids[1]).toBe(505);
      expect(ids[2]).toBe(503);
      expect(ids[3]).toBe(502);
      expect(ids[4]).toBe(501);
      expect(ids[5]).toBe(506);
    });
  });

  // ===========================================================================
  // 5. Interactive UI Flow: Sort Dropdown & Feed Reordering
  // ===========================================================================
  describe('5. Interactive UI Flow & Real-Time Sort Mutations', () => {
    it('5.1 user selecting "Budget: High to Low" reorders the feed in real-time', () => {
      render(<InteractiveSortFeedHarness initialSort="publishDate_desc" />);

      // Initially sorted by publishDate_desc: 505, 504, 502, 501, 503, 506
      expect(screen.getByTestId('feed-project-ids')).toHaveTextContent('505,504,502,501,503,506');

      const sortSelect = screen.getByLabelText(/จัดเรียงตาม|Sort By/i);

      // Change dropdown to budget_desc (งบประมาณ: สูง - ต่ำ)
      act(() => {
        fireEvent.change(sortSelect, { target: { value: 'budget_desc' } });
      });

      // Updated to budget_desc order: 504 (80M), 501 (50M), 505 (20M), 502 (20M), 506 (5M), 503 (3M)
      expect(screen.getByTestId('current-sort-display')).toHaveTextContent('budget_desc');
      expect(screen.getByTestId('feed-project-ids')).toHaveTextContent('504,501,505,502,506,503');
    });

    it('5.2 user selecting "Budget: Low to High" reverses the budget order immediately', () => {
      render(<InteractiveSortFeedHarness initialSort="budget_desc" />);

      const sortSelect = screen.getByLabelText(/จัดเรียงตาม|Sort By/i);

      act(() => {
        fireEvent.change(sortSelect, { target: { value: 'budget_asc' } });
      });

      expect(screen.getByTestId('current-sort-display')).toHaveTextContent('budget_asc');
      expect(screen.getByTestId('feed-project-ids')).toHaveTextContent('503,506,502,505,501,504');
    });

    it('5.3 user selecting "Deadline: Soonest first" surfaces imminent deadline projects to the top of feed', () => {
      render(<InteractiveSortFeedHarness initialSort="publishDate_desc" />);

      const sortSelect = screen.getByLabelText(/จัดเรียงตาม|Sort By/i);

      // Select deadline_asc (⏳ กำหนดส่ง: ใกล้สุดก่อน)
      act(() => {
        fireEvent.change(sortSelect, { target: { value: 'deadline_asc' } });
      });

      // Projects 501 (3 days) and 502 (6 days) must be at index 0 and 1
      expect(screen.getByTestId('feed-project-ids')).toHaveTextContent('501,502,503,505,504,506');

      // The top 2 rendered cards have imminent visual warning dots
      const closingSoonDots = screen.getAllByText(/● ใกล้ปิดรับ/i);
      expect(closingSoonDots.length).toBe(2);
    });

    it('5.4 preserves imminent visual badges and red highlights across sorting mutations', () => {
      const { container } = render(<InteractiveSortFeedHarness initialSort="publishDate_desc" />);

      const sortSelect = screen.getByLabelText(/จัดเรียงตาม|Sort By/i);

      // Switch to budget_asc
      act(() => {
        fireEvent.change(sortSelect, { target: { value: 'budget_asc' } });
      });

      // Imminent visual highlights remain visible on project cards 501 and 502
      expect(screen.getByText('โครงการพัฒนาระบบ AI ตรวจจับความปลอดภัย')).toBeInTheDocument();
      const closingSoonDots = screen.getAllByText(/● ใกล้ปิดรับ/i);
      expect(closingSoonDots.length).toBe(2);

      // Check red styles are intact
      const redDateElements = container.querySelectorAll('.meta-value[style*="rgb(220, 38, 38)"], .meta-value[style*="#dc2626"]');
      expect(redDateElements.length).toBeGreaterThanOrEqual(2);
    });

    it('5.5 paginateProcurements maintains correct page slices when combined with sorted list', () => {
      const sortedByBudget = sortProcurements(SORT_AND_DEADLINE_FIXTURES, 'budget_desc');

      // Page 1 with limit = 3
      const page1 = paginateProcurements(sortedByBudget, 1, 3);
      expect(page1.items.map((p) => p.externalId)).toEqual([504, 501, 505]);
      expect(page1.total).toBe(6);
      expect(page1.totalPages).toBe(2);
      expect(page1.page).toBe(1);

      // Page 2 with limit = 3
      const page2 = paginateProcurements(sortedByBudget, 2, 3);
      expect(page2.items.map((p) => p.externalId)).toEqual([502, 506, 503]);
      expect(page2.page).toBe(2);
    });
  });
});
