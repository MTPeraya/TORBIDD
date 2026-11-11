/**
 * E2E: Historical Software Procurement Filtering, Comparative Charts & Budget Statistics
 *
 * Validates:
 *  1. Initial Load & Overall Historical KPI Statistics:
 *     - Fetches and displays total historical spend, average tender value, highest tender, and outlier rate %
 *     - Clicking on Largest Tender KPI card opens detailed modal dialog and displays all metadata & scope
 *  2. Filter by Software Category:
 *     - Dynamically filters historical bar chart and datasets by category (Website, Cloud, Mobile App, AI)
 *     - Validates ChartJS construction datasets, labels, and heights proportional to budgets
 *  3. Filter by Issuing Department:
 *     - Filters by department and verifies ChartJS updates with matching department tender records
 *  4. Filter by Fiscal Year:
 *     - Filters by fiscal year (2024, 2025, 2026 / Buddhist era 2567, 2568, 2569)
 *  5. Multi-Dimensional Cross-Filtering (2-way & 3-way combinations):
 *     - Combined Category + Department + Fiscal Year filtering
 *     - Handles edge case where filter combination yields 0 records gracefully
 *  6. Comparative Charts & Benchmarks:
 *     - ComparisonChart renders current active projects vs historical category average corridors
 *     - Validates bilingual localization (Thai vs English) in chart legends and axis labels
 *  7. Explorer Tab Synchronization & CSV Export:
 *     - Synchronizes active filters with Historical Data Explorer table
 *     - Verifies row expansion with tender details, scope checklist, and awarded vendor
 *     - Verifies CSV export triggered with formatted project data
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import HistoricalPage from '@/app/historical/page';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { HistoricalProject, AgencyComparisonMetrics } from '@/types/historical';
import { Project } from '@/types/project';

// ─────────────────────────────────────────────────────────────────────────────
// ChartJS Spy / Mock
// ─────────────────────────────────────────────────────────────────────────────

interface ChartMockCall {
  ctx: any;
  config: {
    type: string;
    data: {
      labels: string[];
      datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: any;
        borderColor?: any;
        borderWidth?: number;
      }>;
    };
    options: any;
  };
  destroy: jest.Mock;
}

const mockChartInstances: ChartMockCall[] = [];
const mockChartConstructor = jest.fn().mockImplementation((ctx, config) => {
  const instance: ChartMockCall = {
    ctx,
    config,
    destroy: jest.fn(),
  };
  mockChartInstances.push(instance);
  return instance;
});

jest.mock('chart.js/auto', () => ({
  __esModule: true,
  default: function (ctx: any, config: any) {
    return mockChartConstructor(ctx, config);
  },
}));

// Canvas getContext mock for JSDOM
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
// Auth Context & Next Router Mocks
// ─────────────────────────────────────────────────────────────────────────────

let mockAuthValues = {
  user: { email: 'officer@bangkok.go.th', name: 'BMA Procurement Officer' } as any,
  isAuthenticated: true,
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

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  usePathname: () => '/historical',
  useSearchParams: () => new URLSearchParams(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_HISTORICAL_PROJECTS: HistoricalProject[] = [
  {
    _id: 'hist_001',
    title: {
      th: 'ระบบพอร์ทัลบริการประชาชน กทม.',
      en: 'BMA Citizen Portal Web System',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    year: 2024,
    category: 'Website',
    budget: 15_000_000,
    procurementType: 'e-Bidding',
    awardedVendor: {
      th: 'บริษัท สยามดิจิทัล คอนซัลติ้ง จำกัด',
      en: 'Siam Digital Consulting Co., Ltd.',
    },
    description: {
      th: 'พัฒนาระบบวันสต็อปเซอร์วิสสำหรับประชาชนผ่านเว็บท่า',
      en: 'Development of one-stop service citizen web portal',
    },
    scope: {
      th: ['พัฒนาระบบยืนยันตัวตน Digital ID', 'เชื่อมต่อฐานข้อมูลทะเบียนราษฎร์', 'ระบบชำระค่าธรรมเนียมออนไลน์'],
      en: ['Digital ID Authentication', 'Civil Registry DB Integration', 'Online Fee Payment'],
    },
  },
  {
    _id: 'hist_002',
    title: {
      th: 'แอปพลิเคชันแจ้งเตือนสุขภาพและนัดหมายแพทย์',
      en: 'Health Alert & Doctor Appointment Mobile App',
    },
    department: {
      th: 'สำนักการแพทย์',
      en: 'Medical Services Department',
    },
    year: 2024,
    category: 'Mobile App',
    budget: 25_000_000, // High outlier (> 1.3x avg of Mobile App = 15M)
    procurementType: 'e-Bidding',
    awardedVendor: {
      th: 'บริษัท เมดิเทค อินโนเวชั่น จำกัด',
      en: 'MedTech Innovation Co., Ltd.',
    },
    description: {
      th: 'แอปพลิเคชันสำหรับโรงพยาบาลในสังกัด กทม. 11 แห่ง',
      en: 'Mobile app for 11 BMA municipal hospitals',
    },
    scope: {
      th: ['ระบบนัดหมายแพทย์ล่วงหน้า', 'แจ้งเตือนการทานยาและประวัติวัคซีน', 'เชื่อมต่อระบบ HIS โรงพยาบาล'],
      en: ['Advance Doctor Appointment', 'Prescription & Vaccine Reminder', 'Hospital HIS Integration'],
    },
  },
  {
    _id: 'hist_003',
    title: {
      th: 'ระบบโครงสร้างพื้นฐานคลาวด์ศูนย์ข้อมูล กทม.',
      en: 'BMA Cloud Data Center Infrastructure',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    year: 2025,
    category: 'Cloud',
    budget: 90_000_000, // Highest tender!
    procurementType: 'e-Bidding',
    awardedVendor: {
      th: 'บริษัท ไทยคลาวด์ แพลตฟอร์ม โซลูชั่น จำกัด',
      en: 'Thai Cloud Platform Solutions Ltd.',
    },
    description: {
      th: 'โครงการจัดหาโครงสร้างพื้นฐานคลาวด์แบบไฮบริดพร้อมความปลอดภัยระดับสูงสำหรับศาลาว่าการ กทม.',
      en: 'Procurement of enterprise hybrid cloud infrastructure for BMA City Hall',
    },
    scope: {
      th: [
        'ติดตั้งระบบ Hybrid Multi-Cloud Management',
        'ระบบสำรองข้อมูลและ Disaster Recovery Site',
        'การปฏิบัติตามมาตรฐาน ISO 27001 และ PDPA',
      ],
      en: [
        'Hybrid Multi-Cloud Management Platform',
        'Disaster Recovery Site & Backup',
        'ISO 27001 and PDPA Compliance',
      ],
    },
  },
  {
    _id: 'hist_004',
    title: {
      th: 'ระบบปัญญาประดิษฐ์วิเคราะห์ภาพถ่ายเวชระเบียน',
      en: 'AI Medical Record Image Diagnostic System',
    },
    department: {
      th: 'สำนักการแพทย์',
      en: 'Medical Services Department',
    },
    year: 2025,
    category: 'AI',
    budget: 40_000_000,
    procurementType: 'e-Bidding',
    awardedVendor: {
      th: 'บริษัท เอไอ ไดแอกโนสติกส์ จำกัด',
      en: 'AI Diagnostics Ltd.',
    },
    description: {
      th: 'ระบบ AI ช่วยรังสีแพทย์คัดกรองผลเอกซเรย์ปอดอัตโนมัติ',
      en: 'AI system assisting radiologists in automated chest X-ray screening',
    },
    scope: {
      th: ['โมเดล Deep Learning คัดกรองภาพ X-ray', 'ระบบจัดเก็บข้อมูลภาพทางการแพทย์ PACS'],
      en: ['Deep Learning Chest X-ray Screening', 'PACS Medical Imaging Integration'],
    },
  },
  {
    _id: 'hist_005',
    title: {
      th: 'ระบบบริหารการจัดซื้อจัดจ้างและการเงินดิจิทัล',
      en: 'Digital Finance and Procurement ERP System',
    },
    department: {
      th: 'สำนักการคลัง',
      en: 'Finance Department',
    },
    year: 2026,
    category: 'Website',
    budget: 10_000_000,
    procurementType: 'e-Bidding',
    awardedVendor: {
      th: 'บริษัท บิสซิเนสซอฟต์แวร์ โซลูชั่น จำกัด',
      en: 'Business Software Solutions Co., Ltd.',
    },
    description: {
      th: 'ระบบเว็บแอปพลิเคชันสำหรับติดตามการจัดซื้อจัดจ้างของสำนักการคลัง',
      en: 'Web application for procurement tracking under Finance Department',
    },
    scope: {
      th: ['ระบบตรวจสอบงบประมาณผูกพัน', 'ระบบรายงานกระแสเงินสดดิจิทัล'],
      en: ['Committed Budget Tracking', 'Digital Cash Flow Reporting'],
    },
  },
  {
    _id: 'hist_006',
    title: {
      th: 'แอปพลิเคชันติดตามภาษีที่ดินและสิ่งปลูกสร้าง',
      en: 'Land and Building Tax Tracking Mobile App',
    },
    department: {
      th: 'สำนักการคลัง',
      en: 'Finance Department',
    },
    year: 2026,
    category: 'Mobile App',
    budget: 5_000_000, // Low outlier (< 0.7x avg of Mobile App = 15M)
    procurementType: 'e-Bidding',
    awardedVendor: {
      th: 'บริษัท สมาร์ทซิตี้ แอปพลิเคชัน จำกัด',
      en: 'Smart City Applications Co., Ltd.',
    },
    description: {
      th: 'แอปพลิเคชันมือถือสำหรับเจ้าหน้าที่จัดเก็บภาษีลงพื้นที่',
      en: 'Mobile app for field revenue officers surveying land & buildings',
    },
    scope: {
      th: ['ระบบระบุพิกัด GIS ที่ดิน', 'ระบบคำนวณภาษีอัตโนมัติ'],
      en: ['GIS Land Geo-tagging', 'Automated Tax Calculation Engine'],
    },
  },
];

const MOCK_CURRENT_PROJECTS: Project[] = [
  {
    _id: 'curr_001',
    externalId: 6701001,
    title: {
      th: 'โครงการจ้างพัฒนาระบบคลาวด์กลาง กทม. ระยะที่ 2',
      en: 'BMA Central Cloud Platform Development Phase 2',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    category: 'Cloud',
    budget: 95_000_000,
    historicalAvg: 90_000_000,
    status: 'In Progress',
    publishDate: '2026-03-01T00:00:00.000Z',
    deadline: '2026-04-15T16:30:00.000Z',
    procurementType: 'e-Bidding',
    sourceUrl: 'https://process3.gprocurement.go.th/egpext/test1',
    sourceDocument: 'https://process3.gprocurement.go.th/egpext/test1.pdf',
    processedDate: '2026-03-01T05:00:00.000Z',
    aiConfidence: 'High',
    scope: {
      th: ['พัฒนาระบบคลาวด์ระยะที่ 2'],
      en: ['Cloud platform phase 2 development'],
    },
    qualifications: {
      th: ['มีผลงานด้านคลาวด์'],
      en: ['Experience in cloud solutions'],
    },
    description: {
      th: 'ยกระดับระบบคลาวด์กลาง',
      en: 'Upgrade central cloud',
    },
  },
  {
    _id: 'curr_002',
    externalId: 6701002,
    title: {
      th: 'โครงการพัฒนาระบบสารสนเทศการแพทย์ทางไกล',
      en: 'Telemedicine Information System Development',
    },
    department: {
      th: 'สำนักการแพทย์',
      en: 'Medical Services Department',
    },
    category: 'AI',
    budget: 45_000_000,
    historicalAvg: 40_000_000,
    status: 'In Progress',
    publishDate: '2026-03-05T00:00:00.000Z',
    deadline: '2026-04-20T16:30:00.000Z',
    procurementType: 'e-Bidding',
    sourceUrl: 'https://process3.gprocurement.go.th/egpext/test2',
    sourceDocument: 'https://process3.gprocurement.go.th/egpext/test2.pdf',
    processedDate: '2026-03-05T05:00:00.000Z',
    aiConfidence: 'High',
    scope: {
      th: ['พัฒนาระบบปรึกษาแพทย์ทางไกล'],
      en: ['Telemedicine consultation development'],
    },
    qualifications: {
      th: ['มีผลงานด้านระบบแพทย์ดิจิทัล'],
      en: ['Experience in digital healthcare'],
    },
    description: {
      th: 'ระบบบริการปรึกษาแพทย์ทางไกล',
      en: 'Teleconsultation system',
    },
  },
];

const MOCK_AGENCIES: AgencyComparisonMetrics[] = [
  {
    departmentKey: 'สำนักยุทธศาสตร์และประเมินผล',
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    totalBudget: 105_000_000,
    projectCount: 2,
    avgBudget: 52_500_000,
    medianBudget: 52_500_000,
    maxBudget: 90_000_000,
    minBudget: 15_000_000,
    categories: { Website: 1, Cloud: 1 },
    primaryCategory: 'Cloud',
    topProject: {
      title: {
        th: 'ระบบโครงสร้างพื้นฐานคลาวด์ศูนย์ข้อมูล กทม.',
        en: 'BMA Cloud Data Center Infrastructure',
      },
      budget: 90_000_000,
      year: 2025,
    },
  },
  {
    departmentKey: 'สำนักการแพทย์',
    department: {
      th: 'สำนักการแพทย์',
      en: 'Medical Services Department',
    },
    totalBudget: 65_000_000,
    projectCount: 2,
    avgBudget: 32_500_000,
    medianBudget: 32_500_000,
    maxBudget: 40_000_000,
    minBudget: 25_000_000,
    categories: { 'Mobile App': 1, AI: 1 },
    primaryCategory: 'AI',
    topProject: {
      title: {
        th: 'ระบบปัญญาประดิษฐ์วิเคราะห์ภาพถ่ายเวชระเบียน',
        en: 'AI Medical Record Image Diagnostic System',
      },
      budget: 40_000_000,
      year: 2025,
    },
  },
  {
    departmentKey: 'สำนักการคลัง',
    department: {
      th: 'สำนักการคลัง',
      en: 'Finance Department',
    },
    totalBudget: 15_000_000,
    projectCount: 2,
    avgBudget: 7_500_000,
    medianBudget: 7_500_000,
    maxBudget: 10_000_000,
    minBudget: 5_000_000,
    categories: { Website: 1, 'Mobile App': 1 },
    primaryCategory: 'Website',
    topProject: {
      title: {
        th: 'ระบบบริหารการจัดซื้อจัดจ้างและการเงินดิจิทัล',
        en: 'Digital Finance and Procurement ERP System',
      },
      budget: 10_000_000,
      year: 2026,
    },
  },
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

function renderHistoricalPage() {
  return render(
    <ToastProvider>
      <ThemeProvider>
        <LanguageProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <TestLanguageSwitcher />
            <HistoricalPage />
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    </ToastProvider>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Historical Software Procurement Filtering, Comparative Charts & Budget Statistics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChartInstances.length = 0;

    localStorage.clear();
    localStorage.setItem('torbidd_lang', 'th');

    mockAuthValues = {
      user: { email: 'officer@bangkok.go.th', name: 'BMA Procurement Officer' } as any,
      isAuthenticated: true,
      isAdmin: false,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      updateProfile: jest.fn(),
    };

    // Mock global fetch for historical and projects endpoints
    global.fetch = jest.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/historical')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: MOCK_HISTORICAL_PROJECTS,
              agencies: MOCK_AGENCIES,
            }),
        } as Response);
      }
      if (urlStr.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: MOCK_CURRENT_PROJECTS,
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled fetch URL: ${urlStr}`));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // SECTION 1: Initial Render & Historical Top-Level KPI Statistics
  // ===========================================================================
  describe('1. Initial Render & Historical KPI Statistics', () => {
    it('1.1 loads historical data and renders overall KPI cards with mathematically accurate aggregates', async () => {
      const { container } = renderHistoricalPage();

      // Wait for page header and KPI grid to render after data fetch
      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      const kpiCards = container.querySelectorAll('.historical-kpi-grid .kpi-card');
      expect(kpiCards.length).toBe(4);

      // Card 1: Total Historical Spend (185M THB)
      // formatBudget(185_000_000, 'th') -> "฿185.0 ล้าน"
      expect(screen.getByText('งบประมาณจัดซื้อย้อนหลังรวม')).toBeInTheDocument();
      expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      expect(screen.getByText('6 โครงการที่จัดซื้อแล้ว')).toBeInTheDocument();

      // Card 2: Average Project Size (185M / 6 = 30.83M THB)
      // formatBudget(30_833_333.33, 'th') -> "฿30.8 ล้าน"
      expect(screen.getByText('มูลค่าเฉลี่ยต่อโครงการ')).toBeInTheDocument();
      expect(screen.getByText('฿30.8 ล้าน')).toBeInTheDocument();
      expect(screen.getByText('ราคากลางเฉลี่ยต่อสัญญา')).toBeInTheDocument();

      // Card 3: Highest Recorded Tender (90M THB)
      // formatBudget(90_000_000, 'th') -> "฿90.0 ล้าน"
      const highestTenderCard = container.querySelector('.historical-kpi-grid .kpi-card.clickable');
      expect(highestTenderCard).toBeInTheDocument();
      expect(highestTenderCard).toHaveTextContent('โครงการมูลค่าสูงสุดที่บันทึก');
      expect(highestTenderCard).toHaveTextContent('฿90.0 ล้าน');

      // Card 4: Price Outlier Rate (2 outliers out of 6 projects = 33%)
      expect(screen.getByText('อัตราส่วนราคาผิดปกติ (Outlier Rate)')).toBeInTheDocument();
      expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('1.2 clicking Highest Tender KPI card opens the detailed modal with complete AI scope & metadata and allows dismissal', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      // Find highest tender card (which has role="button")
      const highestTenderCard = container.querySelector('.historical-kpi-grid .kpi-card.clickable');
      expect(highestTenderCard).toBeInTheDocument();

      // Click to open modal
      await act(async () => {
        fireEvent.click(highestTenderCard!);
      });

      // Modal should appear
      const modal = container.querySelector('.modal-backdrop');
      expect(modal).toBeInTheDocument();

      // Check modal content (Cloud Project details)
      expect(modal?.querySelector('.modal-title')).toHaveTextContent('ระบบโครงสร้างพื้นฐานคลาวด์ศูนย์ข้อมูล กทม.');
      expect(modal).toHaveTextContent('บริษัท ไทยคลาวด์ แพลตฟอร์ม โซลูชั่น จำกัด');
      expect(modal).toHaveTextContent('90,000,000 บาท');
      expect(modal).toHaveTextContent('ติดตั้งระบบ Hybrid Multi-Cloud Management');
      expect(modal).toHaveTextContent('ระบบสำรองข้อมูลและ Disaster Recovery Site');

      // Close modal by clicking close button
      const closeBtn = container.querySelector('.modal-close-btn');
      expect(closeBtn).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(closeBtn!);
      });

      // Modal is dismissed
      expect(container.querySelector('.modal-backdrop')).toBeNull();
    });
  });

  // ===========================================================================
  // SECTION 2: Dynamic Category Filtering & Bar Chart Generation
  // ===========================================================================
  describe('2. Filter by Software Category', () => {
    it('2.1 initializes BudgetBarChart with all 6 historical records', async () => {
      renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        const barChartCalls = mockChartInstances.filter(
          (c) => c.config.type === 'bar' && c.config.data.datasets.length === 1 && c.config.data.labels.length === 6,
        );
        expect(barChartCalls.length).toBeGreaterThanOrEqual(1);
      });

      const barChartCalls = mockChartInstances.filter(
        (c) => c.config.type === 'bar' && c.config.data.datasets.length === 1 && c.config.data.labels.length === 6,
      );
      const latestBarChart = barChartCalls[barChartCalls.length - 1];
      expect(latestBarChart.config.data.labels.length).toBe(6);
      expect(latestBarChart.config.data.datasets[0].data).toEqual([15, 25, 90, 40, 10, 5]);
      expect(latestBarChart.config.data.datasets[0].label).toBe('งบประมาณ (ล้านบาท)');
    });

    it('2.2 filtering by Category "Website" updates chart datasets to only Website projects (2 records)', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      const categorySelect = container.querySelector('#histFilterCategory') as HTMLSelectElement;
      expect(categorySelect).toBeInTheDocument();

      const prevCallsCount = mockChartInstances.length;

      // Filter by Website
      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: 'Website' } });
      });

      // Verify that ChartJS was re-instantiated with only 2 projects (15M and 10M)
      const barChartCalls = mockChartInstances
        .slice(prevCallsCount)
        .filter((c) => c.config.type === 'bar' && c.config.data.datasets.length === 1);
      expect(barChartCalls.length).toBeGreaterThan(0);

      const latestBarChart = barChartCalls[barChartCalls.length - 1];
      expect(latestBarChart.config.data.labels.length).toBe(2);
      expect(latestBarChart.config.data.labels).toEqual([
        'ระบบพอร์ทัลบริการประชา...',
        'ระบบบริหารการจัดซื้อจั...',
      ]);
      expect(latestBarChart.config.data.datasets[0].data).toEqual([15, 10]);
    });

    it('2.3 filtering by Category "Cloud" updates chart to single 90M record', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      const categorySelect = container.querySelector('#histFilterCategory') as HTMLSelectElement;
      const prevCallsCount = mockChartInstances.length;

      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: 'Cloud' } });
      });

      const barChartCalls = mockChartInstances
        .slice(prevCallsCount)
        .filter((c) => c.config.type === 'bar' && c.config.data.datasets.length === 1);
      const latestBarChart = barChartCalls[barChartCalls.length - 1];
      expect(latestBarChart.config.data.labels.length).toBe(1);
      expect(latestBarChart.config.data.labels[0]).toBe('ระบบโครงสร้างพื้นฐานคล...');
      expect(latestBarChart.config.data.datasets[0].data).toEqual([90]);
    });
  });

  // ===========================================================================
  // SECTION 3: Department Filtering
  // ===========================================================================
  describe('3. Filter by Issuing Department', () => {
    it('3.1 populates department dropdown options from historical data', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        const deptSelect = container.querySelector('#histFilterDept') as HTMLSelectElement;
        expect(deptSelect).toBeInTheDocument();
        expect(deptSelect.options.length).toBeGreaterThan(1);
      });

      const deptSelect = container.querySelector('#histFilterDept') as HTMLSelectElement;
      const options = Array.from(deptSelect.options).map((o) => o.text);

      expect(options).toContain('ทุกหน่วยงาน');
      expect(options).toContain('สำนักยุทธศาสตร์และประเมินผล');
      expect(options).toContain('สำนักการแพทย์');
      expect(options).toContain('สำนักการคลัง');
    });

    it('3.2 selecting "สำนักการแพทย์" filters chart to only Medical Services tenders', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      const deptSelect = container.querySelector('#histFilterDept') as HTMLSelectElement;
      const prevCallsCount = mockChartInstances.length;

      await act(async () => {
        fireEvent.change(deptSelect, { target: { value: 'สำนักการแพทย์' } });
      });

      const barChartCalls = mockChartInstances
        .slice(prevCallsCount)
        .filter((c) => c.config.type === 'bar' && c.config.data.datasets.length === 1);
      const latestBarChart = barChartCalls[barChartCalls.length - 1];

      // 2 projects under สำนักการแพทย์: hist_002 (25M) and hist_004 (40M)
      expect(latestBarChart.config.data.labels.length).toBe(2);
      expect(latestBarChart.config.data.labels).toEqual([
        'แอปพลิเคชันแจ้งเตือนสุ...',
        'ระบบปัญญาประดิษฐ์วิเคร...',
      ]);
      expect(latestBarChart.config.data.datasets[0].data).toEqual([25, 40]);
    });
  });

  // ===========================================================================
  // SECTION 4: Fiscal Year Filtering
  // ===========================================================================
  describe('4. Filter by Fiscal Year', () => {
    it('4.1 renders Buddhist era year options (2569, 2568, 2567) when language is Thai', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        const yearSelect = container.querySelector('#histFilterYear') as HTMLSelectElement;
        expect(yearSelect).toBeInTheDocument();
        expect(yearSelect.options.length).toBeGreaterThan(1);
      });

      const yearSelect = container.querySelector('#histFilterYear') as HTMLSelectElement;
      const options = Array.from(yearSelect.options).map((o) => o.text);

      expect(options).toContain('ทุกปี');
      expect(options).toContain('2569'); // 2026 + 543
      expect(options).toContain('2568'); // 2025 + 543
      expect(options).toContain('2567'); // 2024 + 543
    });

    it('4.2 selecting year 2024 (2567) filters chart to only FY2024 tenders', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      const yearSelect = container.querySelector('#histFilterYear') as HTMLSelectElement;
      const prevCallsCount = mockChartInstances.length;

      await act(async () => {
        fireEvent.change(yearSelect, { target: { value: '2024' } });
      });

      const barChartCalls = mockChartInstances
        .slice(prevCallsCount)
        .filter((c) => c.config.type === 'bar' && c.config.data.datasets.length === 1);
      const latestBarChart = barChartCalls[barChartCalls.length - 1];

      // 2 projects in 2024: hist_001 (15M) and hist_002 (25M)
      expect(latestBarChart.config.data.labels.length).toBe(2);
      expect(latestBarChart.config.data.datasets[0].data).toEqual([15, 25]);
    });
  });

  // ===========================================================================
  // SECTION 5: Multi-Dimensional Cross-Filtering & Zero Records Edge Case
  // ===========================================================================
  describe('5. Multi-Dimensional Cross-Filtering (2-way & 3-way)', () => {
    it('5.1 2-way filter: Category "Mobile App" + Department "สำนักการคลัง" isolates single FY2026 project', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      const categorySelect = container.querySelector('#histFilterCategory') as HTMLSelectElement;
      const deptSelect = container.querySelector('#histFilterDept') as HTMLSelectElement;

      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: 'Mobile App' } });
        fireEvent.change(deptSelect, { target: { value: 'สำนักการคลัง' } });
      });

      const barChartCalls = mockChartInstances.filter(
        (c) => c.config.type === 'bar' && c.config.data.datasets.length === 1,
      );
      const latestBarChart = barChartCalls[barChartCalls.length - 1];

      // Exactly 1 project matches: hist_006 (5M THB)
      expect(latestBarChart.config.data.labels.length).toBe(1);
      expect(latestBarChart.config.data.labels[0]).toBe('แอปพลิเคชันติดตามภาษีท...');
      expect(latestBarChart.config.data.datasets[0].data).toEqual([5]);
    });

    it('5.2 3-way filter: Category "Website" + Department "สำนักยุทธศาสตร์และประเมินผล" + Year 2024', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      const categorySelect = container.querySelector('#histFilterCategory') as HTMLSelectElement;
      const deptSelect = container.querySelector('#histFilterDept') as HTMLSelectElement;
      const yearSelect = container.querySelector('#histFilterYear') as HTMLSelectElement;

      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: 'Website' } });
        fireEvent.change(deptSelect, { target: { value: 'สำนักยุทธศาสตร์และประเมินผล' } });
        fireEvent.change(yearSelect, { target: { value: '2024' } });
      });

      const barChartCalls = mockChartInstances.filter(
        (c) => c.config.type === 'bar' && c.config.data.datasets.length === 1,
      );
      const latestBarChart = barChartCalls[barChartCalls.length - 1];

      // Matches hist_001 (15M THB)
      expect(latestBarChart.config.data.labels.length).toBe(1);
      expect(latestBarChart.config.data.labels[0]).toBe('ระบบพอร์ทัลบริการประชา...');
      expect(latestBarChart.config.data.datasets[0].data).toEqual([15]);
    });

    it('5.3 zero-records edge case: Category "AI" in Department "สำนักการคลัง" passes empty data to ChartJS without crashing', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      const categorySelect = container.querySelector('#histFilterCategory') as HTMLSelectElement;
      const deptSelect = container.querySelector('#histFilterDept') as HTMLSelectElement;

      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: 'AI' } });
        fireEvent.change(deptSelect, { target: { value: 'สำนักการคลัง' } });
      });

      const barChartCalls = mockChartInstances.filter(
        (c) => c.config.type === 'bar' && c.config.data.datasets.length === 1,
      );
      const latestBarChart = barChartCalls[barChartCalls.length - 1];

      // 0 matching records: ChartJS is called with empty labels and empty data array
      expect(latestBarChart.config.data.labels).toEqual([]);
      expect(latestBarChart.config.data.datasets[0].data).toEqual([]);
    });
  });

  // ===========================================================================
  // SECTION 6: Comparative Charts (Current Projects vs Historical Average)
  // ===========================================================================
  describe('6. Comparative Charts & Bilingual Localization', () => {
    it('6.1 generates ComparisonChart with 2 datasets: Project Budget and Historical Average Corridor', async () => {
      renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('โครงการปัจจุบันเปรียบเทียบราคากลางเฉลี่ย')).toBeInTheDocument();
        const comparisonCalls = mockChartInstances.filter(
          (c) => c.config.type === 'bar' && c.config.data.datasets.length === 2 && c.config.data.labels.length === 2,
        );
        expect(comparisonCalls.length).toBeGreaterThanOrEqual(1);
      });

      // Find ComparisonChart call (type: 'bar', dataset length: 2)
      const comparisonCalls = mockChartInstances.filter(
        (c) => c.config.type === 'bar' && c.config.data.datasets.length === 2 && c.config.data.labels.length === 2,
      );

      const latestComparison = comparisonCalls[comparisonCalls.length - 1];

      // 2 current projects
      expect(latestComparison.config.data.labels.length).toBe(2);
      expect(latestComparison.config.data.labels).toEqual([
        'โครงการจ้างพัฒนาระบบคล...',
        'โครงการพัฒนาระบบสารสนเ...',
      ]);

      // Dataset 1: Current Project Budget (in M THB) -> [95, 45]
      expect(latestComparison.config.data.datasets[0].label).toBe('งบประมาณโครงการ');
      expect(latestComparison.config.data.datasets[0].data).toEqual([95, 45]);

      // Dataset 2: Historical Category Average -> [90, 40]
      expect(latestComparison.config.data.datasets[1].label).toBe('ค่าเฉลี่ยประเภทโครงการย้อนหลัง');
      expect(latestComparison.config.data.datasets[1].data).toEqual([90, 40]);
    });

    it('6.2 switching language to English updates chart dataset labels and Y-axis title', async () => {
      renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByTestId('btn-lang-en')).toBeInTheDocument();
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
      });

      const prevCallsCount = mockChartInstances.length;

      // Switch language to English
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-lang-en'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
        expect(screen.getByText('Historical Price Analysis')).toBeInTheDocument();
      });

      // Verify that ComparisonChart was re-rendered with English labels
      const comparisonCalls = mockChartInstances
        .slice(prevCallsCount)
        .filter((c) => c.config.type === 'bar' && c.config.data.datasets.length === 2);
      expect(comparisonCalls.length).toBeGreaterThan(0);

      const latestComparison = comparisonCalls[comparisonCalls.length - 1];
      expect(latestComparison.config.data.datasets[0].label).toBe('Project Budget');
      expect(latestComparison.config.data.datasets[1].label).toBe('Historical Average');

      // Verify BudgetBarChart was re-rendered with English label
      const barCalls = mockChartInstances
        .slice(prevCallsCount)
        .filter((c) => c.config.type === 'bar' && c.config.data.datasets.length === 1);
      expect(barCalls.length).toBeGreaterThan(0);
      const latestBar = barCalls[barCalls.length - 1];
      expect(latestBar.config.data.datasets[0].label).toBe('Budget (M THB)');
    });
  });

  // ===========================================================================
  // SECTION 7: Historical Data Explorer Tab Synchronization & CSV Export
  // ===========================================================================
  describe('7. Historical Data Explorer Tab Synchronization & CSV Export', () => {
    it('7.1 switches to Explorer Tab and displays all 6 historical records in table', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      // Click Explorer tab button
      await act(async () => {
        fireEvent.click(screen.getByText('📋 ตารางข้อมูลย้อนหลังทั้งหมด'));
      });

      expect(screen.getByText('พบข้อมูลจัดซื้อจัดจ้างย้อนหลัง 6 รายการ')).toBeInTheDocument();

      const tableRows = container.querySelectorAll('.historical-table tbody tr.explorer-row');
      expect(tableRows.length).toBe(6);
    });

    it('7.2 filters in Explorer Tab sync with table rows and row expansion reveals detailed scope & vendor', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('📋 ตารางข้อมูลย้อนหลังทั้งหมด'));
      });

      // Search query filter for "คลาวด์"
      const searchInput = container.querySelector('.filter-input-search') as HTMLInputElement;
      expect(searchInput).toBeInTheDocument();

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'คลาวด์' } });
      });

      expect(screen.getByText('พบข้อมูลจัดซื้อจัดจ้างย้อนหลัง 1 รายการ')).toBeInTheDocument();

      const tableRows = container.querySelectorAll('.historical-table tbody tr.explorer-row');
      expect(tableRows.length).toBe(1);

      // Click row to expand details
      await act(async () => {
        fireEvent.click(tableRows[0]);
      });

      // Check expanded content
      const expandedRow = container.querySelector('.expanded-details-row');
      expect(expandedRow).toBeInTheDocument();
      expect(screen.getByText('บริษัท ไทยคลาวด์ แพลตฟอร์ม โซลูชั่น จำกัด')).toBeInTheDocument();
      expect(screen.getByText(/โครงการจัดหาโครงสร้างพื้นฐานคลาวด์แบบไฮบริด/)).toBeInTheDocument();
      expect(screen.getByText(/ติดตั้งระบบ Hybrid Multi-Cloud Management/)).toBeInTheDocument();

      // Click again to collapse
      await act(async () => {
        fireEvent.click(tableRows[0]);
      });
      expect(container.querySelector('.expanded-details-row')).toBeNull();
    });

    it('7.3 displays friendly empty-state when no records match search query in Explorer Tab', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('📋 ตารางข้อมูลย้อนหลังทั้งหมด'));
      });

      const searchInput = container.querySelector('.filter-input-search') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'non_existent_keyword_xyz' } });
      });

      expect(screen.getByText('พบข้อมูลจัดซื้อจัดจ้างย้อนหลัง 0 รายการ')).toBeInTheDocument();
      expect(
        screen.getByText('ไม่พบข้อมูลประวัติโครงการจัดซื้อจัดจ้างที่ตรงกับเงื่อนไข'),
      ).toBeInTheDocument();
    });

    it('7.4 triggers CSV export when export button is clicked', async () => {
      const { container } = renderHistoricalPage();

      await waitFor(() => {
        expect(screen.getByText('วิเคราะห์ราคาย้อนหลัง')).toBeInTheDocument();
        expect(screen.getByText('฿185.0 ล้าน')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('📋 ตารางข้อมูลย้อนหลังทั้งหมด'));
      });

      // Spy on link creation and click
      const originalCreateElement = document.createElement.bind(document);
      let createdLink: HTMLAnchorElement | null = null;
      const linkClickSpy = jest.fn();

      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          createdLink = el as HTMLAnchorElement;
          createdLink.click = linkClickSpy;
        }
        return el;
      });

      const exportBtn = container.querySelector('.btn-export-csv');
      expect(exportBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(exportBtn!);
      });

      expect(linkClickSpy).toHaveBeenCalledTimes(1);
      expect(createdLink).not.toBeNull();
      expect(createdLink!.getAttribute('download')).toMatch(/^BMA_Software_Procurement_Historical_\d{4}-\d{2}-\d{2}\.csv$/);
      expect(decodeURIComponent(createdLink!.getAttribute('href')!)).toContain('BMA Citizen Portal Web System');
    });
  });
});
