/**
 * E2E: Statistical Budget Comparisons Against Historical Category Averages & Outlier Warnings
 *
 * Validates:
 *  1. Statistical Engine & Benchmark Calculations:
 *     - Evaluates announced opportunity budget against historical category benchmarks (median, mean, Q1, Q3, IQR, z-score)
 *     - Verifies statistical classification thresholds (> 1.3x median / Tukey IQR -> high_outlier, < 0.7x median -> low_outlier, within -> reasonable)
 *  2. Automated Visual Warnings for "Unusually High" Outliers:
 *     - Evaluates opportunity with budget substantially exceeding category baseline
 *     - Triggers automated visual warning badge (.eval-status-badge.badge-high) with label "งบประมาณสูงผิดปกติ (High Outlier)" / "High Outlier (Above Normal Range)"
 *     - Displays prominent red marker (#ef4444) on the visual benchmark spectrum gauge
 *     - Applies text-error class to positive variance percentage and surfaces analytical scope drivers reasoning
 *  3. Automated Visual Warnings for "Unusually Low" Outliers:
 *     - Evaluates opportunity with budget substantially below category baseline
 *     - Triggers automated visual warning badge (.eval-status-badge.badge-low) with label "งบประมาณต่ำผิดปกติ (Low Outlier)" / "Low Outlier (Below Normal Range)"
 *     - Displays amber marker (#f59e0b) on the visual benchmark spectrum gauge
 *     - Applies text-warning class to negative variance percentage and alerts about potential under-budgeting risk
 *  4. Baseline Reasonable Budget Corridor:
 *     - Evaluates opportunity within normal historical boundaries
 *     - Triggers green normal badge (.eval-status-badge.badge-normal) and green marker (#10b981)
 *  5. Interactive What-If Budget Analysis:
 *     - Switches between active opportunity selector and custom input evaluator
 *     - Entering custom budget or clicking preset buttons dynamically recalculates benchmarks and updates visual warnings in real-time
 *  6. Opportunity Detail View Budget Comparison & Variance Indicators:
 *     - Validates BudgetBreakdownCard variance chips (.budget-variance-chip.higher / .lower / .normal)
 *     - Validates BudgetComparisonBar visual comparison indicator (.budget-comparison-indicator.above / .below)
 *  7. Full Bilingual Localization (Thai <-> English):
 *     - Verifies all warning badges, analytical explanations, and metric units render accurately in both languages
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  evaluateBudgetReasonableness,
  calculateCategoryStats,
} from '@/lib/historicalAnalytics';
import { BudgetReasonablenessChecker } from '@/components/historical/BudgetReasonablenessChecker';
import { BenchmarkSpectrumBar } from '@/components/charts/HistoricalCharts';
import { BudgetBreakdownCard } from '@/components/ui/BudgetBreakdownCard';
import { BudgetComparisonBar } from '@/components/ui/BudgetComparisonBar';
import ProjectDetailPage from '@/app/opportunities/[id]/page';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { HistoricalProject } from '@/types/historical';
import { Project } from '@/types/project';

// ─────────────────────────────────────────────────────────────────────────────
// ChartJS & Canvas Mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('chart.js/auto', () => ({
  __esModule: true,
  default: function () {
    return { destroy: jest.fn(), update: jest.fn() };
  },
}));

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 0 }),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  }) as any;
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigation & Auth Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  usePathname: () => '/historical',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'auditor@bangkok.go.th', name: 'BMA Procurement Auditor' },
    isAuthenticated: true,
    isAdmin: false,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    updateProfile: jest.fn(),
  }),
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
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Historical Cloud Projects:
 * Budgets: [15M, 20M, 25M, 30M, 35M]
 * Median: 25,000,000 THB
 * Mean: 25,000,000 THB
 * Normal Corridor (0.7x to 1.3x median): 17,500,000 - 32,500,000 THB
 */
const MOCK_HISTORICAL_CLOUD_PROJECTS: HistoricalProject[] = [
  {
    _id: 'hist_c1',
    title: { th: 'โครงการคลาวด์ 1', en: 'Cloud Project 1' },
    department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy Department' },
    year: 2023,
    category: 'Cloud',
    budget: 15_000_000,
  },
  {
    _id: 'hist_c2',
    title: { th: 'โครงการคลาวด์ 2', en: 'Cloud Project 2' },
    department: { th: 'สำนักการแพทย์', en: 'Medical Department' },
    year: 2024,
    category: 'Cloud',
    budget: 20_000_000,
  },
  {
    _id: 'hist_c3',
    title: { th: 'โครงการคลาวด์ 3 (มัธยฐาน)', en: 'Cloud Project 3 (Median)' },
    department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy Department' },
    year: 2024,
    category: 'Cloud',
    budget: 25_000_000,
  },
  {
    _id: 'hist_c4',
    title: { th: 'โครงการคลาวด์ 4', en: 'Cloud Project 4' },
    department: { th: 'สำนักการคลัง', en: 'Finance Department' },
    year: 2025,
    category: 'Cloud',
    budget: 30_000_000,
  },
  {
    _id: 'hist_c5',
    title: { th: 'โครงการคลาวด์ 5', en: 'Cloud Project 5' },
    department: { th: 'สำนักการโยธา', en: 'Public Works Department' },
    year: 2025,
    category: 'Cloud',
    budget: 35_000_000,
  },
];

/**
 * Historical AI Projects:
 * Budgets: [10M, 18M, 22M, 26M, 34M]
 * Median: 22,000,000 THB
 */
const MOCK_HISTORICAL_AI_PROJECTS: HistoricalProject[] = [
  {
    _id: 'hist_ai1',
    title: { th: 'ระบบ AI วิเคราะห์การจราจร', en: 'AI Traffic Analytics' },
    department: { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic Department' },
    year: 2023,
    category: 'AI',
    budget: 10_000_000,
  },
  {
    _id: 'hist_ai2',
    title: { th: 'ระบบ AI วินิจฉัยภาพถ่ายการแพทย์', en: 'AI Medical Imaging Diagnostics' },
    department: { th: 'สำนักการแพทย์', en: 'Medical Department' },
    year: 2024,
    category: 'AI',
    budget: 18_000_000,
  },
  {
    _id: 'hist_ai3',
    title: { th: 'ระบบ AI แชตบอตบริการประชาชน', en: 'AI Citizen Chatbot' },
    department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy Department' },
    year: 2024,
    category: 'AI',
    budget: 22_000_000,
  },
  {
    _id: 'hist_ai4',
    title: { th: 'ระบบ AI คัดกรองเอกสารสัญญา', en: 'AI Contract Screening' },
    department: { th: 'สำนักการคลัง', en: 'Finance Department' },
    year: 2025,
    category: 'AI',
    budget: 26_000_000,
  },
  {
    _id: 'hist_ai5',
    title: { th: 'ระบบ AI พยากรณ์น้ำท่วมและสภาพอากาศ', en: 'AI Flood & Weather Prediction' },
    department: { th: 'สำนักการระบายน้ำ', en: 'Drainage Department' },
    year: 2025,
    category: 'AI',
    budget: 34_000_000,
  },
];

const ALL_MOCK_HISTORICAL: HistoricalProject[] = [
  ...MOCK_HISTORICAL_CLOUD_PROJECTS,
  ...MOCK_HISTORICAL_AI_PROJECTS,
];

// Active announced procurement opportunities
const HIGH_OUTLIER_OPPORTUNITY: Project = {
  _id: 'opp_high_001',
  externalId: 671190001,
  title: {
    th: 'โครงการจัดหาระบบคลาวด์ขนาดใหญ่พิเศษ กทม.',
    en: 'BMA Mega Enterprise Cloud Infrastructure Project',
  },
  department: {
    th: 'สำนักยุทธศาสตร์และประเมินผล',
    en: 'Strategy and Evaluation Department',
  },
  category: 'Cloud',
  budget: 95_000_000, // 3.8x historical median of 25M -> High Outlier
  historicalAvg: 25_000_000,
  status: 'In Progress',
  publishDate: '2026-03-01T00:00:00.000Z',
  deadline: '2026-04-15T16:30:00.000Z',
  procurementType: 'e-Bidding',
  sourceDocument: 'https://process3.gprocurement.go.th/egpext/high.pdf',
  processedDate: '2026-03-01T05:00:00.000Z',
  aiConfidence: 'High',
  scope: {
    th: ['จัดหาเซิร์ฟเวอร์คลาวด์ขนาดใหญ่พิเศษ', 'ติดตั้ง Data Center สำรอง'],
    en: ['Deploy mega enterprise cloud servers', 'Setup backup disaster recovery site'],
  },
  qualifications: {
    th: ['ทุนจดทะเบียนไม่ต่ำกว่า 100 ล้านบาท'],
    en: ['Registered capital no less than 100M THB'],
  },
  description: {
    th: 'โครงการคลาวด์ที่มีงบประมาณสูงเป็นพิเศษเพื่อรองรับข้อมูลขนาดใหญ่',
    en: 'High budget cloud project to support massive big data operations',
  },
  budgetBreakdown: [
    { category: { th: 'ฮาร์ดแวร์และคลาวด์', en: 'Hardware & Cloud' }, amount: 65_000_000, percentage: 68 },
    { category: { th: 'ค่าติดตั้งและพัฒนาระบบ', en: 'Installation & Development' }, amount: 30_000_000, percentage: 32 },
  ],
};

const LOW_OUTLIER_OPPORTUNITY: Project = {
  _id: 'opp_low_002',
  externalId: 671190002,
  title: {
    th: 'โครงการจ้างบริการคลาวด์ทดสอบขนาดเล็ก',
    en: 'Small Pilot Cloud Sandbox Service',
  },
  department: {
    th: 'สำนักการแพทย์',
    en: 'Medical Services Department',
  },
  category: 'Cloud',
  budget: 5_000_000, // 0.2x historical median of 25M -> Low Outlier
  historicalAvg: 25_000_000,
  status: 'In Progress',
  publishDate: '2026-03-05T00:00:00.000Z',
  deadline: '2026-04-20T16:30:00.000Z',
  procurementType: 'e-Bidding',
  sourceDocument: 'https://process3.gprocurement.go.th/egpext/low.pdf',
  processedDate: '2026-03-05T05:00:00.000Z',
  aiConfidence: 'High',
  scope: {
    th: ['บริการคลาวด์ทดสอบระยะสั้น 3 เดือน'],
    en: ['3-month short term pilot sandbox service'],
  },
  qualifications: {
    th: ['มีประสบการณ์ให้บริการคลาวด์'],
    en: ['Experience providing cloud services'],
  },
  description: {
    th: 'โครงการขนาดเล็กงบประมาณต่ำกว่าเกณฑ์ปกติ',
    en: 'Small pilot project with budget substantially below typical benchmark',
  },
};

const REASONABLE_OPPORTUNITY: Project = {
  _id: 'opp_norm_003',
  externalId: 671190003,
  title: {
    th: 'โครงการพัฒนาระบบคลาวด์มาตรฐาน กทม.',
    en: 'BMA Standard Cloud Platform Development',
  },
  department: {
    th: 'สำนักยุทธศาสตร์และประเมินผล',
    en: 'Strategy and Evaluation Department',
  },
  category: 'Cloud',
  budget: 24_000_000, // 0.96x historical median of 25M -> Reasonable
  historicalAvg: 25_000_000,
  status: 'In Progress',
  publishDate: '2026-03-10T00:00:00.000Z',
  deadline: '2026-04-25T16:30:00.000Z',
  procurementType: 'e-Bidding',
  sourceDocument: 'https://process3.gprocurement.go.th/egpext/norm.pdf',
  processedDate: '2026-03-10T05:00:00.000Z',
  aiConfidence: 'High',
  scope: {
    th: ['พัฒนาระบบคลาวด์ระดับมาตรฐานตามระเบียบ กทม.'],
    en: ['Standard enterprise cloud platform compliant with BMA guidelines'],
  },
  qualifications: {
    th: ['มีผลงานพัฒนาคลาวด์'],
    en: ['Experience in cloud solutions'],
  },
  description: {
    th: 'โครงการงบประมาณสมเหตุสมผลตามเกณฑ์ราคากลางย้อนหลัง',
    en: 'Project with balanced budget well aligned with historical benchmark',
  },
};

const ALL_MOCK_OPPORTUNITIES: Project[] = [
  HIGH_OUTLIER_OPPORTUNITY,
  LOW_OUTLIER_OPPORTUNITY,
  REASONABLE_OPPORTUNITY,
];

// ─────────────────────────────────────────────────────────────────────────────
// Language Toggle Helper Component
// ─────────────────────────────────────────────────────────────────────────────

function TestLanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div data-testid="test-language-controls">
      <button data-testid="btn-lang-th" onClick={() => setLanguage('th')}>
        TH
      </button>
      <button data-testid="btn-lang-en" onClick={() => setLanguage('en')}>
        EN
      </button>
      <span data-testid="current-lang">{language}</span>
    </div>
  );
}

function renderCheckerWithProviders(props: {
  projects: Project[];
  historicalData: HistoricalProject[];
}) {
  return render(
    <ToastProvider>
      <ThemeProvider>
        <LanguageProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <TestLanguageSwitcher />
            <BudgetReasonablenessChecker
              projects={props.projects}
              historicalData={props.historicalData}
            />
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    </ToastProvider>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Statistical Budget Comparisons Against Historical Category Averages & Outlier Warnings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('torbidd_lang', 'th');

    // Global fetch mock for detail page and API endpoints
    global.fetch = jest.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/projects/671190001')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: HIGH_OUTLIER_OPPORTUNITY }),
        } as Response);
      }
      if (urlStr.includes('/api/projects/671190002')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: LOW_OUTLIER_OPPORTUNITY }),
        } as Response);
      }
      if (urlStr.includes('/api/projects/671190003')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: REASONABLE_OPPORTUNITY }),
        } as Response);
      }
      if (urlStr.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: ALL_MOCK_OPPORTUNITIES }),
        } as Response);
      }
      if (urlStr.includes('/api/historical')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: ALL_MOCK_HISTORICAL }),
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled mock fetch URL: ${urlStr}`));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // SECTION 1: Pure Statistical Engine & Mathematical Benchmark Verification
  // ===========================================================================
  describe('1. Statistical Engine & Benchmark Calculations', () => {
    it('1.1 calculates exact category statistics (median, mean, Q1, Q3, IQR, stdDev) for Cloud projects', () => {
      const stats = calculateCategoryStats('Cloud', ALL_MOCK_HISTORICAL);

      expect(stats.category).toBe('Cloud');
      expect(stats.sampleCount).toBe(5);
      expect(stats.min).toBe(15_000_000);
      expect(stats.max).toBe(35_000_000);
      expect(stats.median).toBe(25_000_000);
      expect(stats.mean).toBe(25_000_000);
      expect(stats.q1).toBe(20_000_000);
      expect(stats.q3).toBe(30_000_000);
      expect(stats.iqr).toBe(10_000_000);
    });

    it('1.2 flags budget exceeding 1.3x median as high_outlier with positive variance % and z-score', () => {
      const result = evaluateBudgetReasonableness(95_000_000, 'Cloud', ALL_MOCK_HISTORICAL);

      expect(result.status).toBe('high_outlier');
      expect(result.ratioVsMedian).toBeCloseTo(3.8, 1);
      expect(result.variancePercentage).toBe(280); // ((95M - 25M) / 25M) * 100 = +280%
      expect(result.percentileRank).toBe(100);
      expect(result.zScore).toBeGreaterThan(2);
      expect(result.reasoning.th).toContain('High Outlier');
      expect(result.reasoning.en).toContain('High Outlier');
      expect(result.reasoning.en).toContain('above the historical median');
    });

    it('1.3 flags budget below 0.7x median as low_outlier with negative variance % and risk warning', () => {
      const result = evaluateBudgetReasonableness(5_000_000, 'Cloud', ALL_MOCK_HISTORICAL);

      expect(result.status).toBe('low_outlier');
      expect(result.ratioVsMedian).toBeCloseTo(0.2, 1);
      expect(result.variancePercentage).toBe(-80); // ((5M - 25M) / 25M) * 100 = -80%
      expect(result.percentileRank).toBe(0);
      expect(result.zScore).toBeLessThan(-1.5);
      expect(result.reasoning.th).toContain('Low Outlier');
      expect(result.reasoning.th).toContain('Under-budgeting');
      expect(result.reasoning.en).toContain('Low Outlier');
      expect(result.reasoning.en).toContain('under-budgeting risk');
    });

    it('1.4 flags budget within 0.7x - 1.3x corridor as reasonable baseline', () => {
      const result = evaluateBudgetReasonableness(24_000_000, 'Cloud', ALL_MOCK_HISTORICAL);

      expect(result.status).toBe('reasonable');
      expect(result.ratioVsMedian).toBeCloseTo(0.96, 2);
      expect(result.variancePercentage).toBe(-4);
      expect(result.percentileRank).toBe(40);
      expect(result.reasoning.th).toContain('งบประมาณโครงการอยู่ในช่วงมาตรฐานที่สมเหตุสมผล');
      expect(result.reasoning.en).toContain('aligns comfortably within historical benchmarks');
    });
  });

  // ===========================================================================
  // SECTION 2: Automated Visual Warnings for "Unusually High" Outliers
  // ===========================================================================
  describe('2. Automated Visual Warnings for "Unusually High" Outliers', () => {
    it('2.1 triggers badge-high warning, error text styling, and red spectrum marker for 95M Cloud opportunity', async () => {
      const { container } = renderCheckerWithProviders({
        projects: [HIGH_OUTLIER_OPPORTUNITY, LOW_OUTLIER_OPPORTUNITY, REASONABLE_OPPORTUNITY],
        historicalData: ALL_MOCK_HISTORICAL,
      });

      // Default active project is the first in list (HIGH_OUTLIER_OPPORTUNITY)
      await waitFor(() => {
        expect(container.querySelector('.eval-status-badge')).toBeInTheDocument();
      });

      // 1. Automated Warning Badge
      const statusBadge = container.querySelector('.eval-status-badge');
      expect(statusBadge).toHaveClass('badge-high');
      expect(statusBadge).toHaveTextContent('งบประมาณสูงผิดปกติ (High Outlier)');

      // 2. Metrics Grid: +280% variance with text-error styling
      const metricValue = container.querySelector('.eval-metric-card .metric-value.text-error');
      expect(metricValue).toBeInTheDocument();
      expect(metricValue).toHaveTextContent('+280%');

      // 3. Visual Spectrum Bar: Red indicator marker (#ef4444)
      const spectrumMarker = container.querySelector(
        '.eval-spectrum-wrapper div[style*="background: rgb(239, 68, 68)"], .eval-spectrum-wrapper div[style*="#ef4444"]',
      );
      expect(spectrumMarker).toBeInTheDocument();

      // 4. Analytical Scope Driver Reasoning Banner
      const insightsText = container.querySelector('.eval-insights-card .insights-text');
      expect(insightsText).toBeInTheDocument();
      expect(insightsText).toHaveTextContent(/งบประมาณโครงการสูงกว่าค่ามัธยฐานในหมวดหมู่นี้ถึง 280%/);
      expect(insightsText).toHaveTextContent(/ถือเป็น High Outlier ที่มีมูลค่าสูงผิดปกติ/);
      expect(insightsText).toHaveTextContent(/ควรตรวจสอบ TOR ว่ามีขอบเขตงานพิเศษที่ทำให้ต้นทุนสูงขึ้น/);

      // 5. Closest Historical Reference Projects list
      const closestItems = container.querySelectorAll('.closest-project-item');
      expect(closestItems.length).toBeGreaterThanOrEqual(1);
    });

    it('2.2 renders visual spectrum gauge correctly when status="high_outlier"', () => {
      const stats = calculateCategoryStats('Cloud', ALL_MOCK_HISTORICAL);
      const { container } = render(
        <LanguageProvider>
          <BenchmarkSpectrumBar stats={stats} currentBudget={95_000_000} status="high_outlier" />
        </LanguageProvider>,
      );

      // Status text label under bar should be rendered with evaluated budget in M THB
      expect(screen.getByText(/95.00 M THB/)).toBeInTheDocument();
      // Median label
      expect(screen.getByText('25.0M')).toBeInTheDocument();

      // Red highlight marker
      const marker = container.querySelector('div[style*="rgb(239, 68, 68)"], div[style*="#ef4444"]');
      expect(marker).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // SECTION 3: Automated Visual Warnings for "Unusually Low" Outliers
  // ===========================================================================
  describe('3. Automated Visual Warnings for "Unusually Low" Outliers', () => {
    it('3.1 selecting low outlier opportunity triggers badge-low warning, warning text styling, and amber marker', async () => {
      const { container } = renderCheckerWithProviders({
        projects: [HIGH_OUTLIER_OPPORTUNITY, LOW_OUTLIER_OPPORTUNITY, REASONABLE_OPPORTUNITY],
        historicalData: ALL_MOCK_HISTORICAL,
      });

      await waitFor(() => {
        expect(container.querySelector('#projectSelector')).toBeInTheDocument();
      });

      // Switch selector to LOW_OUTLIER_OPPORTUNITY (id: 671190002)
      const projectSelect = container.querySelector('#projectSelector') as HTMLSelectElement;
      await act(async () => {
        fireEvent.change(projectSelect, { target: { value: '671190002' } });
      });

      // 1. Automated Warning Badge for Low Outlier
      const statusBadge = container.querySelector('.eval-status-badge');
      expect(statusBadge).toHaveClass('badge-low');
      expect(statusBadge).toHaveTextContent('งบประมาณต่ำผิดปกติ (Low Outlier)');

      // 2. Metrics Grid: -80% variance with text-warning styling
      const metricValue = container.querySelector('.eval-metric-card .metric-value.text-warning');
      expect(metricValue).toBeInTheDocument();
      expect(metricValue).toHaveTextContent('-80%');

      // 3. Visual Spectrum Bar: Amber indicator marker (#f59e0b)
      const spectrumMarker = container.querySelector(
        '.eval-spectrum-wrapper div[style*="background: rgb(245, 158, 11)"], .eval-spectrum-wrapper div[style*="#f59e0b"]',
      );
      expect(spectrumMarker).toBeInTheDocument();

      // 4. Under-budgeting Risk Alert Reasoning Banner
      const insightsText = container.querySelector('.eval-insights-card .insights-text');
      expect(insightsText).toBeInTheDocument();
      expect(insightsText).toHaveTextContent(/งบประมาณโครงการต่ำกว่าค่ามัธยฐานในหมวดหมู่นี้ถึง 80%/);
      expect(insightsText).toHaveTextContent(/มีความเสี่ยงต่องบประมาณไม่เพียงพอ \(Under-budgeting\)/);
      expect(insightsText).toHaveTextContent(/ผู้เสนอราคาควรพิจารณาความคุ้มค่าและต้นทุนทรัพยากรบุคลากร/);
    });
  });

  // ===========================================================================
  // SECTION 4: Baseline Reasonable Budget Corridor
  // ===========================================================================
  describe('4. Baseline Reasonable Budget Corridor', () => {
    it('4.1 selecting reasonable opportunity displays badge-normal, success styling, and green marker', async () => {
      const { container } = renderCheckerWithProviders({
        projects: [HIGH_OUTLIER_OPPORTUNITY, LOW_OUTLIER_OPPORTUNITY, REASONABLE_OPPORTUNITY],
        historicalData: ALL_MOCK_HISTORICAL,
      });

      await waitFor(() => {
        expect(container.querySelector('#projectSelector')).toBeInTheDocument();
      });

      // Switch selector to REASONABLE_OPPORTUNITY (id: 671190003)
      const projectSelect = container.querySelector('#projectSelector') as HTMLSelectElement;
      await act(async () => {
        fireEvent.change(projectSelect, { target: { value: '671190003' } });
      });

      // 1. Normal Badge
      const statusBadge = container.querySelector('.eval-status-badge');
      expect(statusBadge).toHaveClass('badge-normal');
      expect(statusBadge).toHaveTextContent('งบประมาณสมเหตุสมผล (Optimal Range)');

      // 2. Metrics Grid: -4% variance with text-success styling
      const metricValue = container.querySelector('.eval-metric-card .metric-value.text-success');
      expect(metricValue).toBeInTheDocument();
      expect(metricValue).toHaveTextContent('-4%');

      // 3. Visual Spectrum Bar: Green marker (#10b981)
      const spectrumMarker = container.querySelector(
        '.eval-spectrum-wrapper div[style*="background: rgb(16, 185, 129)"], .eval-spectrum-wrapper div[style*="#10b981"]',
      );
      expect(spectrumMarker).toBeInTheDocument();

      // 4. Positive Competitive Feasibility Reasoning
      const insightsText = container.querySelector('.eval-insights-card .insights-text');
      expect(insightsText).toBeInTheDocument();
      expect(insightsText).toHaveTextContent(/งบประมาณโครงการอยู่ในช่วงมาตรฐานที่สมเหตุสมผล/);
      expect(insightsText).toHaveTextContent(/เหมาะสมต่อการแข่งขันอย่างเป็นธรรม/);
    });
  });

  // ===========================================================================
  // SECTION 5: Interactive What-If Budget Analysis Mode
  // ===========================================================================
  describe('5. Interactive What-If Budget Analysis', () => {
    it('5.1 switches to custom input mode and immediately recalculates outlier warnings upon user typing', async () => {
      const { container } = renderCheckerWithProviders({
        projects: ALL_MOCK_OPPORTUNITIES,
        historicalData: ALL_MOCK_HISTORICAL,
      });

      await waitFor(() => {
        expect(screen.getByText('กรอกงบประมาณเอง')).toBeInTheDocument();
      });

      // Click "Custom Input" toggle button
      await act(async () => {
        fireEvent.click(screen.getByText('กรอกงบประมาณเอง'));
      });

      // Custom input fields should now be visible
      const customTitleInput = container.querySelector('#customTitleInput') as HTMLInputElement;
      const customCatSelect = container.querySelector('#customCatSelect') as HTMLSelectElement;
      const customBudgetInput = container.querySelector('#customBudgetInput') as HTMLInputElement;

      expect(customTitleInput).toBeInTheDocument();
      expect(customCatSelect).toBeInTheDocument();
      expect(customBudgetInput).toBeInTheDocument();

      // 1. Enter an Unusually High custom budget: 80,000,000 in AI category (Median = 22M)
      await act(async () => {
        fireEvent.change(customTitleInput, { target: { value: 'ระบบ AI ขนาดยักษ์ กทม.' } });
        fireEvent.change(customCatSelect, { target: { value: 'AI' } });
        fireEvent.change(customBudgetInput, { target: { value: '80000000' } });
      });

      // Verifies visual warning badge triggers for custom high budget
      expect(container.querySelector('.eval-status-badge')).toHaveClass('badge-high');
      expect(container.querySelector('.eval-status-badge')).toHaveTextContent('งบประมาณสูงผิดปกติ (High Outlier)');
      expect(container.querySelector('.eval-project-name')).toHaveTextContent('ระบบ AI ขนาดยักษ์ กทม.');
      expect(container.querySelector('.eval-announced-budget')).toHaveTextContent('80,000,000 บาท');

      // 2. Click preset button: 5,000,000 (5M is below 0.7x 22M -> Low Outlier)
      const preset5M = screen.getByText('฿5.0 ล้าน');
      await act(async () => {
        fireEvent.click(preset5M);
      });

      expect(container.querySelector('.eval-status-badge')).toHaveClass('badge-low');
      expect(container.querySelector('.eval-status-badge')).toHaveTextContent('งบประมาณต่ำผิดปกติ (Low Outlier)');
      expect(container.querySelector('.eval-announced-budget')).toHaveTextContent('5,000,000 บาท');

      // 3. Enter a Reasonable custom budget: 22,000,000
      await act(async () => {
        fireEvent.change(customBudgetInput, { target: { value: '22000000' } });
      });

      expect(container.querySelector('.eval-status-badge')).toHaveClass('badge-normal');
      expect(container.querySelector('.eval-status-badge')).toHaveTextContent('งบประมาณสมเหตุสมผล (Optimal Range)');
      expect(container.querySelector('.eval-metric-card .metric-value')).toHaveTextContent('0%');
    });
  });

  // ===========================================================================
  // SECTION 6: Opportunity Detail View Budget Breakdown & Comparison Bars
  // ===========================================================================
  describe('6. Opportunity Detail View Budget Comparison & Variance Indicators', () => {
    it('6.1 renders high budget opportunity with higher variance chip and above average indicator', () => {
      const { container } = render(
        <ToastProvider>
          <LanguageProvider>
            <BudgetBreakdownCard
              budget={95_000_000}
              historicalAvg={25_000_000}
              contractPrice={90_000_000}
            />
            <BudgetComparisonBar budget={95_000_000} historicalAvg={25_000_000} />
          </LanguageProvider>
        </ToastProvider>,
      );

      // BudgetBreakdownCard: .budget-variance-chip.higher
      const varianceChip = container.querySelector('.budget-variance-chip');
      expect(varianceChip).toHaveClass('higher');
      expect(varianceChip).toHaveTextContent(/สูงกว่าค่าเฉลี่ย 280%/);

      // Government Savings from contractPrice
      expect(screen.getByText('ราคามูลค่าที่จัดหาได้ (e-GP)')).toBeInTheDocument();
      expect(screen.getByText('90,000,000 บาท')).toBeInTheDocument();
      expect(screen.getByText(/ประหยัดงบประมาณรัฐ/)).toBeInTheDocument();

      // BudgetComparisonBar: .budget-comparison-indicator.above
      const comparisonIndicator = container.querySelector('.budget-comparison-indicator');
      expect(comparisonIndicator).toHaveClass('above');
      expect(comparisonIndicator).toHaveTextContent('สูงกว่าช่วงเฉลี่ยปกติ');

      // Visual horizontal comparison bar rows
      expect(screen.getByText('โครงการนี้')).toBeInTheDocument();
      expect(screen.getByText('ค่าเฉลี่ยย้อนหลัง')).toBeInTheDocument();
    });

    it('6.2 renders low budget opportunity with lower variance chip and below average indicator', () => {
      const { container } = render(
        <ToastProvider>
          <LanguageProvider>
            <BudgetBreakdownCard budget={5_000_000} historicalAvg={25_000_000} />
            <BudgetComparisonBar budget={5_000_000} historicalAvg={25_000_000} />
          </LanguageProvider>
        </ToastProvider>,
      );

      // BudgetBreakdownCard: .budget-variance-chip.lower
      const varianceChip = container.querySelector('.budget-variance-chip');
      expect(varianceChip).toHaveClass('lower');
      expect(varianceChip).toHaveTextContent(/ต่ำกว่าค่าเฉลี่ย 80%/);

      // BudgetComparisonBar: .budget-comparison-indicator.below
      const comparisonIndicator = container.querySelector('.budget-comparison-indicator');
      expect(comparisonIndicator).toHaveClass('below');
      expect(comparisonIndicator).toHaveTextContent('ต่ำกว่าช่วงเฉลี่ยปกติ');
    });

    it('6.3 renders balanced opportunity with normal variance chip within ±10% range', () => {
      const { container } = render(
        <ToastProvider>
          <LanguageProvider>
            <BudgetBreakdownCard budget={26_000_000} historicalAvg={25_000_000} />
            <BudgetComparisonBar budget={26_000_000} historicalAvg={25_000_000} />
          </LanguageProvider>
        </ToastProvider>,
      );

      // BudgetBreakdownCard: .budget-variance-chip.normal
      const varianceChip = container.querySelector('.budget-variance-chip');
      expect(varianceChip).toHaveClass('normal');
      expect(varianceChip).toHaveTextContent(/อยู่ในช่วงเฉลี่ยปกติ/);

      // BudgetComparisonBar: .budget-comparison-indicator.normal
      const comparisonIndicator = container.querySelector('.budget-comparison-indicator');
      expect(comparisonIndicator).toHaveClass('normal');
      expect(comparisonIndicator).toHaveTextContent('อยู่ในช่วงเฉลี่ยปกติ');
    });

    it('6.4 mounts full ProjectDetailPage for high outlier and verifies intelligence sidebar budget widgets', async () => {
      let renderResult!: ReturnType<typeof render>;
      await act(async () => {
        renderResult = render(
          <ToastProvider>
            <ThemeProvider>
              <LanguageProvider>
                <Suspense fallback={<div>Loading...</div>}>
                  <ProjectDetailPage params={Promise.resolve({ id: '671190001' })} />
                </Suspense>
              </LanguageProvider>
            </ThemeProvider>
          </ToastProvider>,
        );
      });

      await waitFor(() => {
        expect(renderResult.container.querySelector('.detail-hero-title')).toBeInTheDocument();
      });

      // Verify that Budget Breakdown and Comparison Bar rendered in detail-sidebar-col
      const sidebar = renderResult.container.querySelector('.detail-sidebar-col');
      expect(sidebar).toBeInTheDocument();

      const varianceChip = sidebar?.querySelector('.budget-variance-chip');
      expect(varianceChip).toHaveClass('higher');
      expect(varianceChip).toHaveTextContent(/สูงกว่าค่าเฉลี่ย 280%/);

      const comparisonIndicator = sidebar?.querySelector('.budget-comparison-indicator');
      expect(comparisonIndicator).toHaveClass('above');
      expect(comparisonIndicator).toHaveTextContent('สูงกว่าช่วงเฉลี่ยปกติ');
    });
  });

  // ===========================================================================
  // SECTION 7: Bilingual Localization (Thai <-> English)
  // ===========================================================================
  describe('7. Bilingual Localization', () => {
    it('7.1 switches language to English and translates all visual outlier warning badges and analytical texts', async () => {
      const { container } = renderCheckerWithProviders({
        projects: [HIGH_OUTLIER_OPPORTUNITY, LOW_OUTLIER_OPPORTUNITY],
        historicalData: ALL_MOCK_HISTORICAL,
      });

      await waitFor(() => {
        expect(screen.getByTestId('btn-lang-en')).toBeInTheDocument();
      });

      // Switch language to English
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-lang-en'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      // 1. High Outlier Badge in English
      const statusBadge = container.querySelector('.eval-status-badge');
      expect(statusBadge).toHaveClass('badge-high');
      expect(statusBadge).toHaveTextContent('High Outlier (Above Normal Range)');

      // 2. English Headers and Metrics
      expect(screen.getByText('Announced Budget Reasonableness & Outlier Evaluator')).toBeInTheDocument();
      expect(screen.getByText('Variance vs Median')).toBeInTheDocument();
      expect(screen.getByText('Recommended Benchmark Range (Q1 - Q3)')).toBeInTheDocument();

      // 3. English Analytical Insights
      const insightsText = container.querySelector('.eval-insights-card .insights-text');
      expect(insightsText).toHaveTextContent(/The announced budget is 280% above the historical median/);
      expect(insightsText).toHaveTextContent(/classifying as a High Outlier/);

      // 4. Switch to Low Outlier opportunity in English
      const projectSelect = container.querySelector('#projectSelector') as HTMLSelectElement;
      await act(async () => {
        fireEvent.change(projectSelect, { target: { value: '671190002' } });
      });

      expect(container.querySelector('.eval-status-badge')).toHaveClass('badge-low');
      expect(container.querySelector('.eval-status-badge')).toHaveTextContent('Low Outlier (Below Normal Range)');
      expect(container.querySelector('.eval-insights-card .insights-text')).toHaveTextContent(
        /under-budgeting risk/,
      );
    });
  });
});
