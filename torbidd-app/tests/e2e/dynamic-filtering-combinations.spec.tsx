/**
 * E2E: Dynamic Filtering Combinations
 *
 * Validates dynamic filtering combinations across:
 *  1. Issuing Department (single & multi-agency selection, Thai & English matching)
 *  2. Estimated Budget Range (presets: under5m, 5to10, 10to20, above20m, and custom min/max)
 *  3. Submission Deadline (urgent within7, within30, and moreThan30)
 *  4. Software Category (single & multi-category toggling)
 *  5. Multi-dimensional combinations (2-way, 3-way, and full 4-way filter criteria)
 *  6. Active filter chips representation, individual removal, and full "Clear All" reset
 *  7. Interactive UI flow (ProcurementFilterPanel + ActiveFilterChips + ProcurementList)
 */

import React, { useState, useMemo } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Project } from '@/types/project';
import { SoftwareCategory } from '@/types/procurement-category';
import {
  filterByCategory,
  filterByAgency,
  filterByBudget,
  filterByDeadline,
  applyProcurementFilters,
} from '@/services/procurement-filter';
import { executeProcurementSearch } from '@/services/procurement-search';
import { ProcurementFilterPanel } from '@/components/procurement-filters/ProcurementFilterPanel';
import { ActiveFilterChips } from '@/components/procurement-filters/ActiveFilterChips';
import { ProcurementList } from '@/components/procurement-list/ProcurementList';
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

export const DYNAMIC_FIXTURES: Project[] = [
  {
    externalId: 101,
    title: {
      th: 'ระบบพอร์ทัลบริการประชาชนแบบครบวงจร',
      en: 'Comprehensive Citizen Service Portal',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 45000000, // above20m
    publishDate: new Date(now - 2 * DAY_MS).toISOString(),
    deadline: new Date(now + 5 * DAY_MS).toISOString(), // within7 & within30
    category: 'Website',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'รายละเอียดพอร์ทัล', en: 'Portal details' },
    scope: { th: ['ระบบ One Stop Service'], en: ['One Stop Service'] },
    qualifications: { th: ['มีผลงาน'], en: ['Proven track record'] },
    historicalAvg: 44000000,
    sourceDocument: 'doc101.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 102,
    title: {
      th: 'ระบบ AI วิเคราะห์จราจรอัจฉริยะ',
      en: 'Smart Traffic AI Analytics System',
    },
    department: {
      th: 'สำนักการจราจรและขนส่ง',
      en: 'Traffic and Transport Department',
    },
    budget: 15000000, // 10to20
    publishDate: new Date(now - 3 * DAY_MS).toISOString(),
    deadline: new Date(now + 14 * DAY_MS).toISOString(), // within30
    category: 'AI',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'ระบบตรวจจับภาพ AI', en: 'AI Camera Vision' },
    scope: { th: ['ติดตั้งกล้อง AI'], en: ['AI cameras installation'] },
    qualifications: { th: ['มีผลงาน AI'], en: ['AI track record'] },
    historicalAvg: 14500000,
    sourceDocument: 'doc102.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 103,
    title: {
      th: 'แอปพลิเคชันมือถือตรวจวัดระดับน้ำและเตือนภัย',
      en: 'Flood Monitoring and Warning Mobile Application',
    },
    department: {
      th: 'สำนักการระบายน้ำ',
      en: 'Drainage and Sewerage Department',
    },
    budget: 8000000, // 5to10
    publishDate: new Date(now - 4 * DAY_MS).toISOString(),
    deadline: new Date(now + 40 * DAY_MS).toISOString(), // moreThan30
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'แอปเตือนภัยน้ำท่วม', en: 'Flood warning app' },
    scope: { th: ['พัฒนาแอป iOS/Android'], en: ['Develop iOS/Android app'] },
    qualifications: { th: ['มีผลงานโมบาย'], en: ['Mobile app track record'] },
    historicalAvg: 7800000,
    sourceDocument: 'doc103.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 104,
    title: {
      th: 'ระบบจัดตารางเรียนและบริหารโรงเรียน',
      en: 'School Timetable Scheduling and Administration ERP',
    },
    department: {
      th: 'สำนักการศึกษา',
      en: 'Education Department',
    },
    budget: 3500000, // under5m
    publishDate: new Date(now - 5 * DAY_MS).toISOString(),
    deadline: new Date(now + 20 * DAY_MS).toISOString(), // within30
    category: 'Website',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'ระบบจัดตารางสอนโรงเรียน', en: 'School scheduling' },
    scope: { th: ['ระบบจัดตารางสอนอัตโนมัติ'], en: ['Automated timetable engine'] },
    qualifications: { th: ['มีผลงานระบบการศึกษา'], en: ['Education system experience'] },
    historicalAvg: 3400000,
    sourceDocument: 'doc104.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 105,
    title: {
      th: 'แพลตฟอร์มคลังข้อมูล Big Data และ AI Analytics',
      en: 'Enterprise Big Data Lakehouse Platform',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 25000000, // above20m
    publishDate: new Date(now - 6 * DAY_MS).toISOString(),
    deadline: new Date(now + 50 * DAY_MS).toISOString(), // moreThan30
    category: 'Database',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'คลังข้อมูลขนาดใหญ่', en: 'Big data warehouse' },
    scope: { th: ['ติดตั้ง Kafka และ Spark'], en: ['Setup Kafka and Spark'] },
    qualifications: { th: ['มีผลงาน Big Data'], en: ['Big Data experience'] },
    historicalAvg: 24000000,
    sourceDocument: 'doc105.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 106,
    title: {
      th: 'โครงการจัดหาอุปกรณ์เซิร์ฟเวอร์พร้อมสัญญาแล้ว',
      en: 'Awarded Server Hardware Procurement',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 10000000,
    publishDate: new Date(now - 30 * DAY_MS).toISOString(),
    deadline: new Date(now - 10 * DAY_MS).toISOString(),
    category: 'Database',
    procurementType: 'e-Bidding',
    status: 'จัดทำสัญญาแล้ว',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winnerName: 'บริษัท เทค ซัพพลาย จำกัด' as any,
    description: { th: 'จัดทำสัญญาแล้ว', en: 'Awarded contract' },
    scope: { th: ['จัดซื้อฮาร์ดแวร์'], en: ['Hardware purchase'] },
    qualifications: { th: ['มีใบอนุญาต'], en: ['License'] },
    historicalAvg: 9800000,
    sourceDocument: 'doc106.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Filter Dashboard Harness Component
// ─────────────────────────────────────────────────────────────────────────────

function FilterDashboardHarness({ initialProjects = DYNAMIC_FIXTURES }: { initialProjects?: Project[] }) {
  const [selectedCategories, setSelectedCategories] = useState<SoftwareCategory[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [minBudget, setMinBudget] = useState<number | null>(null);
  const [maxBudget, setMaxBudget] = useState<number | null>(null);
  const [budgetPreset, setBudgetPreset] = useState<string>('');
  const [selectedDeadline, setSelectedDeadline] = useState<string>('');

  const filteredProjects = useMemo(() => {
    return applyProcurementFilters(initialProjects, {
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      agencies: selectedAgencies.length > 0 ? selectedAgencies : undefined,
      minBudget: minBudget !== null ? minBudget : undefined,
      maxBudget: maxBudget !== null ? maxBudget : undefined,
      budgetPreset: budgetPreset ? (budgetPreset as any) : undefined,
      deadline: selectedDeadline ? (selectedDeadline as any) : undefined,
    });
  }, [initialProjects, selectedCategories, selectedAgencies, minBudget, maxBudget, budgetPreset, selectedDeadline]);

  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedAgencies([]);
    setMinBudget(null);
    setMaxBudget(null);
    setBudgetPreset('');
    setSelectedDeadline('');
  };

  return (
    <LanguageProvider>
      <ToastProvider>
        <div data-testid="filter-dashboard-harness">
          <ActiveFilterChips
            filters={{
              categories: selectedCategories,
              agencies: selectedAgencies,
              minBudget,
              maxBudget,
              budgetPreset,
              deadline: selectedDeadline,
            }}
            onRemoveSearch={() => {}}
            onRemoveCategory={(cat) => setSelectedCategories((prev) => prev.filter((c) => c !== cat))}
            onRemoveAgency={(ag) => setSelectedAgencies((prev) => prev.filter((a) => a !== ag))}
            onRemoveBudget={() => {
              setMinBudget(null);
              setMaxBudget(null);
              setBudgetPreset('');
            }}
            onRemoveDeadline={() => setSelectedDeadline('')}
            onClearAll={handleClearAll}
          />

          <ProcurementFilterPanel
            selectedCategories={selectedCategories}
            onCategoryChange={setSelectedCategories}
            selectedAgencies={selectedAgencies}
            onAgencyChange={setSelectedAgencies}
            minBudget={minBudget}
            maxBudget={maxBudget}
            budgetPreset={budgetPreset}
            onBudgetChange={(opts) => {
              setMinBudget(opts.minBudget);
              setMaxBudget(opts.maxBudget);
              setBudgetPreset(opts.budgetPreset);
            }}
            selectedDeadline={selectedDeadline}
            onDeadlineChange={setSelectedDeadline}
            onClearAll={handleClearAll}
            availableAgencies={[
              { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy and Evaluation Department' },
              { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic and Transport Department' },
              { th: 'สำนักการระบายน้ำ', en: 'Drainage and Sewerage Department' },
              { th: 'สำนักการศึกษา', en: 'Education Department' },
            ]}
          />

          <div data-testid="filtered-count">{filteredProjects.length}</div>
          <ProcurementList
            projects={filteredProjects}
            totalCount={filteredProjects.length}
            onClearFilters={handleClearAll}
          />
        </div>
      </ToastProvider>
    </LanguageProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Dynamic Filtering Combinations (Department, Budget, Deadline, Category)', () => {
  // ===========================================================================
  // 1. Single-Dimension Dynamic Filtering
  // ===========================================================================
  describe('1. Single-Dimension Dynamic Filtering', () => {
    it('1.1 filters accurately by Issuing Department (single and multiple agencies)', () => {
      // Single agency: สำนักการระบายน้ำ
      const drainageOnly = filterByAgency(DYNAMIC_FIXTURES, ['สำนักการระบายน้ำ']);
      expect(drainageOnly).toHaveLength(1);
      expect(drainageOnly[0].externalId).toBe(103);

      // Multiple agencies: SED (ยุทธศาสตร์) + Traffic (จราจร)
      const multiAgencies = filterByAgency(DYNAMIC_FIXTURES, [
        'สำนักยุทธศาสตร์และประเมินผล',
        'สำนักการจราจรและขนส่ง',
      ]);
      // Projects 101, 102, 105, 106
      expect(multiAgencies).toHaveLength(4);
      expect(multiAgencies.map((p) => p.externalId).sort()).toEqual([101, 102, 105, 106]);
    });

    it('1.2 filters accurately by Estimated Budget Range (presets and custom min/max)', () => {
      // Preset 'under5m': Project 104 (3.5M)
      const under5m = filterByBudget(DYNAMIC_FIXTURES, { budgetPreset: 'under5m' });
      expect(under5m).toHaveLength(1);
      expect(under5m[0].externalId).toBe(104);

      // Preset '5to10': Project 103 (8M) and 106 (10M)
      const between5and10 = filterByBudget(DYNAMIC_FIXTURES, { budgetPreset: '5to10' });
      expect(between5and10.map((p) => p.externalId).sort()).toEqual([103, 106]);

      // Preset '10to20': Project 102 (15M) and 106 (10M)
      const between10and20 = filterByBudget(DYNAMIC_FIXTURES, { budgetPreset: '10to20' });
      expect(between10and20.map((p) => p.externalId).sort()).toEqual([102, 106]);

      // Preset 'above20m': Project 101 (45M) and Project 105 (25M)
      const above20m = filterByBudget(DYNAMIC_FIXTURES, { budgetPreset: 'above20m' });
      expect(above20m.map((p) => p.externalId).sort()).toEqual([101, 105]);

      // Custom range: min 7M, max 16M -> Project 103 (8M), Project 106 (10M), Project 102 (15M)
      const customRange = filterByBudget(DYNAMIC_FIXTURES, { minBudget: 7000000, maxBudget: 16000000 });
      expect(customRange.map((p) => p.externalId).sort()).toEqual([102, 103, 106]);
    });

    it('1.3 filters accurately by Submission Deadline with urgency windows', () => {
      // within7: Project 101 (5 days)
      const within7 = filterByDeadline(DYNAMIC_FIXTURES, 'within7');
      expect(within7).toHaveLength(1);
      expect(within7[0].externalId).toBe(101);

      // within30: Project 101 (5 days), 102 (14 days), 104 (20 days). (Project 106 is awarded, excluded)
      const within30 = filterByDeadline(DYNAMIC_FIXTURES, 'within30');
      expect(within30.map((p) => p.externalId).sort()).toEqual([101, 102, 104]);

      // moreThan30: Project 103 (40 days), 105 (50 days)
      const moreThan30 = filterByDeadline(DYNAMIC_FIXTURES, 'moreThan30');
      expect(moreThan30.map((p) => p.externalId).sort()).toEqual([103, 105]);
    });

    it('1.4 filters accurately by Software Category (single and multiple categories)', () => {
      // Single category: AI
      const aiOnly = filterByCategory(DYNAMIC_FIXTURES, ['AI']);
      expect(aiOnly).toHaveLength(1);
      expect(aiOnly[0].externalId).toBe(102);

      // Multi-category: Website + Database
      // Website: 101, 104; Database: 105, 106
      const webAndDb = filterByCategory(DYNAMIC_FIXTURES, ['Website', 'Database']);
      expect(webAndDb.map((p) => p.externalId).sort()).toEqual([101, 104, 105, 106]);
    });
  });

  // ===========================================================================
  // 2. Two-Way Dynamic Filtering Combinations
  // ===========================================================================
  describe('2. Two-Way Dynamic Filtering Combinations', () => {
    it('2.1 Department + Category: filters projects matching both agency and category', () => {
      // SED ('สำนักยุทธศาสตร์และประเมินผล') + 'Website' -> Project 101 only
      const res = applyProcurementFilters(DYNAMIC_FIXTURES, {
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        categories: ['Website'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(101);
    });

    it('2.2 Department + Budget Range: filters projects matching both agency and budget preset', () => {
      // SED ('สำนักยุทธศาสตร์และประเมินผล') + 'above20m' -> Projects 101 (45M) and 105 (25M)
      const res = applyProcurementFilters(DYNAMIC_FIXTURES, {
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        budgetPreset: 'above20m',
      });
      expect(res.map((p) => p.externalId).sort()).toEqual([101, 105]);
    });

    it('2.3 Category + Budget Range: filters projects by software category and custom budget bounds', () => {
      // 'Website' + minBudget 20,000,000 -> Project 101 only (Project 104 is 3.5M, excluded)
      const res = applyProcurementFilters(DYNAMIC_FIXTURES, {
        categories: ['Website'],
        minBudget: 20000000,
      });
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(101);
    });

    it('2.4 Category + Deadline: filters projects by category closing within deadline window', () => {
      // 'Website' + 'within7' -> Project 101 (5 days). (Project 104 has 20 days, excluded)
      const res = applyProcurementFilters(DYNAMIC_FIXTURES, {
        categories: ['Website'],
        deadline: 'within7',
      });
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(101);
    });

    it('2.5 Budget Range + Deadline: filters projects with high budget closing in distant future', () => {
      // 'above20m' + 'moreThan30' -> Project 105 (25M, 50 days). (Project 101 has 5 days, excluded)
      const res = applyProcurementFilters(DYNAMIC_FIXTURES, {
        budgetPreset: 'above20m',
        deadline: 'moreThan30',
      });
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(105);
    });
  });

  // ===========================================================================
  // 3. Three-Way & Four-Way Full Combinations
  // ===========================================================================
  describe('3. Three-Way & Four-Way Dynamic Combinations', () => {
    it('3.1 Three-Way: Department + Budget + Deadline yields precise target project', () => {
      // Department (SED) + Budget (above20m) + Deadline (within7) -> Project 101
      const res = applyProcurementFilters(DYNAMIC_FIXTURES, {
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        budgetPreset: 'above20m',
        deadline: 'within7',
      });
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(101);
    });

    it('3.2 Three-Way: Category + Budget + Department yields target project', () => {
      // Category (Database) + Budget (above20m) + Department (SED) -> Project 105
      const res = applyProcurementFilters(DYNAMIC_FIXTURES, {
        categories: ['Database'],
        budgetPreset: 'above20m',
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(105);
    });

    it('3.3 Four-Way Full Combination: Department + Budget + Deadline + Category isolates exact opportunity', () => {
      // 1. SED + above20m + within7 + Website -> Project 101
      const resA = applyProcurementFilters(DYNAMIC_FIXTURES, {
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        budgetPreset: 'above20m',
        deadline: 'within7',
        categories: ['Website'],
      });
      expect(resA).toHaveLength(1);
      expect(resA[0].externalId).toBe(101);

      // 2. Education Dept + under5m + within30 + Website -> Project 104
      const resB = applyProcurementFilters(DYNAMIC_FIXTURES, {
        agencies: ['สำนักการศึกษา'],
        budgetPreset: 'under5m',
        deadline: 'within30',
        categories: ['Website'],
      });
      expect(resB).toHaveLength(1);
      expect(resB[0].externalId).toBe(104);
    });

    it('3.4 Four-Way Mutually Exclusive Criteria cleanly returns 0 results without errors', () => {
      // Drainage Dept + AI Category + above20m + within7 -> 0 matching projects
      const res = applyProcurementFilters(DYNAMIC_FIXTURES, {
        agencies: ['สำนักการระบายน้ำ'],
        categories: ['AI'],
        budgetPreset: 'above20m',
        deadline: 'within7',
      });
      expect(res).toHaveLength(0);
    });

    it('3.5 executes full 4-way filter within combined search, sorting, and pagination pipeline', () => {
      const result = executeProcurementSearch(DYNAMIC_FIXTURES, {
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        budgetPreset: 'above20m',
        categories: ['Website'],
        deadline: 'within7',
        sortBy: 'budget_desc',
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].externalId).toBe(101);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  // ===========================================================================
  // 4. Interactive UI Dynamic Flow: FilterPanel + ActiveChips + Feed
  // ===========================================================================
  describe('4. Interactive UI Flow & Real-Time Filter Mutations', () => {
    it('4.1 initial render shows all active opportunities and no filter chips', () => {
      render(<FilterDashboardHarness initialProjects={DYNAMIC_FIXTURES} />);

      // Initially all 6 projects rendered (awarded project 106 only excluded when an active filter is chosen)
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('6');
      expect(screen.getByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).toBeInTheDocument();
      expect(screen.getByText('ระบบ AI วิเคราะห์จราจรอัจฉริยะ')).toBeInTheDocument();

      // No active filter chips bar visible
      expect(screen.queryByRole('region', { name: /ตัวกรองที่ใช้งานอยู่|Active filters/i })).not.toBeInTheDocument();
    });

    it('4.2 toggling Category pill narrows the list and displays the category chip', () => {
      const { container } = render(<FilterDashboardHarness initialProjects={DYNAMIC_FIXTURES} />);

      // Click "AI" category pill button via data-category
      const aiButton = container.querySelector('button[data-category="AI"]') as HTMLButtonElement;
      expect(aiButton).toBeInTheDocument();
      act(() => {
        fireEvent.click(aiButton);
      });

      // Filtered to 1 project: Project 102
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('1');
      expect(screen.getByText('ระบบ AI วิเคราะห์จราจรอัจฉริยะ')).toBeInTheDocument();
      expect(screen.queryByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).not.toBeInTheDocument();

      // Active filter chip is rendered
      expect(screen.getByRole('region', { name: /ตัวกรองที่ใช้งานอยู่|Active filters/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove category filter "AI"/i)).toBeInTheDocument();
    });

    it('4.3 selecting Budget Preset chip dynamically filters and reflects in chip bar', () => {
      render(<FilterDashboardHarness initialProjects={DYNAMIC_FIXTURES} />);

      // Click "มากกว่า 20 ล้าน" / "Above 20M" preset button
      const above20mBtn = screen.getByRole('button', { name: /มากกว่า 20 ล้าน|Above 20M/i });
      act(() => {
        fireEvent.click(above20mBtn);
      });

      // Filtered to 2 projects: 101 (45M) and 105 (25M)
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('2');
      expect(screen.getByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).toBeInTheDocument();
      expect(screen.getByText('แพลตฟอร์มคลังข้อมูล Big Data และ AI Analytics')).toBeInTheDocument();
      expect(screen.queryByText('ระบบ AI วิเคราะห์จราจรอัจฉริยะ')).not.toBeInTheDocument();
    });

    it('4.4 selecting Deadline radio pill filters to urgent projects', () => {
      render(<FilterDashboardHarness initialProjects={DYNAMIC_FIXTURES} />);

      // Click "ภายใน 7 วัน" deadline option
      const within7Pill = screen.getByRole('radio', { name: /ภายใน 7 วัน/i });
      act(() => {
        fireEvent.click(within7Pill);
      });

      // Filtered to 1 project: 101 (5 days)
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('1');
      expect(screen.getByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).toBeInTheDocument();
    });

    it('4.5 combining Agency + Category + Budget + Deadline via UI narrows to 1 project and renders 4 chips', () => {
      const { container } = render(<FilterDashboardHarness initialProjects={DYNAMIC_FIXTURES} />);

      // 1. Select Agency: สำนักยุทธศาสตร์และประเมินผล checkbox
      const sedCheckbox = screen.getByRole('checkbox', { name: /สำนักยุทธศาสตร์และประเมินผล/i });
      act(() => {
        fireEvent.click(sedCheckbox);
      });

      // 2. Select Category: เว็บไซต์ / พอร์ทัล
      const websiteBtn = container.querySelector('button[data-category="Website"]') as HTMLButtonElement;
      expect(websiteBtn).toBeInTheDocument();
      act(() => {
        fireEvent.click(websiteBtn);
      });

      // 3. Select Budget: มากกว่า 20 ล้าน
      const above20mBtn = screen.getByRole('button', { name: /มากกว่า 20 ล้าน|Above 20M/i });
      act(() => {
        fireEvent.click(above20mBtn);
      });

      // 4. Select Deadline: ภายใน 7 วัน
      const within7Pill = screen.getByRole('radio', { name: /ภายใน 7 วัน/i });
      act(() => {
        fireEvent.click(within7Pill);
      });

      // Should isolate Project 101
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('1');
      expect(screen.getByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).toBeInTheDocument();

      // Active chips bar displays all active dimensions
      const chipsRegion = screen.getByRole('region', { name: /ตัวกรองที่ใช้งานอยู่|Active filters/i });
      expect(chipsRegion).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove category filter "Website"/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove agency filter "สำนักยุทธศาสตร์และประเมินผล"/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove budget filter/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove deadline filter/i)).toBeInTheDocument();
    });

    it('4.6 removing an individual filter chip dynamically recalculates results while retaining others', () => {
      const { container } = render(<FilterDashboardHarness initialProjects={DYNAMIC_FIXTURES} />);

      // 1. Select Category: เว็บไซต์
      const websiteBtn = container.querySelector('button[data-category="Website"]') as HTMLButtonElement;
      act(() => {
        fireEvent.click(websiteBtn);
      });

      // 2. Select Budget: มากกว่า 20 ล้าน
      const above20mBtn = screen.getByRole('button', { name: /มากกว่า 20 ล้าน|Above 20M/i });
      act(() => {
        fireEvent.click(above20mBtn);
      });

      // Initially with Category (Website) + Budget (above20m) -> Project 101 only
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('1');

      // Now remove Category chip via the ActiveFilterChips "×" button
      const removeCategoryBtn = screen.getByLabelText(/Remove category filter "Website"/i);
      act(() => {
        fireEvent.click(removeCategoryBtn);
      });

      // Now only Budget (>20M) remains -> Projects 101 (Website) AND 105 (Database) are shown!
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('2');
      expect(screen.getByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).toBeInTheDocument();
      expect(screen.getByText('แพลตฟอร์มคลังข้อมูล Big Data และ AI Analytics')).toBeInTheDocument();
    });

    it('4.7 clicking Clear All resets all active filters and restores full listings feed', () => {
      const { container } = render(<FilterDashboardHarness initialProjects={DYNAMIC_FIXTURES} />);

      // Apply filter
      const aiBtn = container.querySelector('button[data-category="AI"]') as HTMLButtonElement;
      act(() => {
        fireEvent.click(aiBtn);
      });
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('1');

      // Click "ล้างทั้งหมด" / "Clear All" button in the active chips bar
      const clearAllBtn = container.querySelector('.clear-all-filters-btn') as HTMLButtonElement;
      expect(clearAllBtn).toBeInTheDocument();
      act(() => {
        fireEvent.click(clearAllBtn);
      });

      // Restored back to full listing
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('6');
      expect(screen.queryByRole('region', { name: /ตัวกรองที่ใช้งานอยู่|Active filters/i })).not.toBeInTheDocument();
    });

    it('4.8 mutually exclusive filter selection renders friendly empty state with working Clear All CTA', () => {
      const { container } = render(<FilterDashboardHarness initialProjects={DYNAMIC_FIXTURES} />);

      // Agency: สำนักการระบายน้ำ (Project 103 only, Mobile App, 8M)
      const drainageCheckbox = screen.getByRole('checkbox', { name: /สำนักการระบายน้ำ/i });
      act(() => {
        fireEvent.click(drainageCheckbox);
      });

      // Category: AI (No drainage project has AI)
      const aiBtn = container.querySelector('button[data-category="AI"]') as HTMLButtonElement;
      act(() => {
        fireEvent.click(aiBtn);
      });

      // 0 projects
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('0');
      expect(screen.getByText(/ไม่พบโครงการจัดซื้อจัดจ้างที่ตรงกับเงื่อนไข|No matching/i)).toBeInTheDocument();

      // Click clear all button in the empty state
      const emptyStateClearBtn = container.querySelector('#empty-state-clear-btn') as HTMLButtonElement;
      expect(emptyStateClearBtn).toBeInTheDocument();
      act(() => {
        fireEvent.click(emptyStateClearBtn);
      });

      // Restored back
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('6');
    });
  });
});
