/**
 * E2E: UI Warnings & Visual Indicators for Extraction Confidence, Missing Fields,
 * Unavailable Original Files, and Expired Deadlines
 *
 * Validates that the application renders accurate warning banners, visual badges,
 * and fallback states when encountering incomplete, low-confidence, or expired procurement records:
 *  1. Low Extraction Confidence Warnings:
 *     - Detail view hero badge renders red warning styling (#fef2f2 / #991b1b) for "Low" confidence
 *     - Detail view intelligence sidebar indicates "Low" confidence in distinct alert styling
 *     - Dashboard/Opportunities ProjectCard renders "ความเชื่อมั่น: ต่ำ" (TH) / "Confidence: Low" (EN)
 *  2. Unavailable Original Document (TOR) Warnings:
 *     - Detail view renders red alert card for "NO_TOR" ("📄 ไม่มีเอกสาร TOR" / "TOR not yet attached on e-GP")
 *     - Detail view renders amber alert card for "PENDING" ("⏳ TOR อยู่ระหว่างดำเนินการ" / "TOR Pending Extraction")
 *     - Feed ProjectCard renders "📄 ไม่มี TOR" badge for NO_TOR records
 *     - Feed ProjectCard renders "⏳ TOR รอดำเนินการ" badge for PENDING records
 *  3. Missing Fields & Visual Fallbacks:
 *     - Missing budget (0 or undefined) renders "ไม่ระบุ" (TH) / "N/A" (EN) in both detail view and feed card
 *     - Missing technical requirements renders empty checklist warning box ("📋 ยังไม่มีรายการตรวจสอบข้อกำหนดทางเทคนิค")
 *     - Unreviewed AI record presents pending verification indicator ("⚡ ดึงข้อมูลจาก e-GP (รอตรวจทาน)")
 *  4. Closed & Expired Deadline Indicators:
 *     - Expired deadline (days < 0) renders "● ปิดรับข้อเสนอ" / "● Closed" closed-dot badge in detail view
 *     - Expired deadline renders "ปิดรับแล้ว" / "Closed" in the submission deadline countdown block
 *     - Feed ProjectCard renders "● ปิดรับข้อเสนอ" / "● Closed" closed-dot badge
 *     - Imminent closing deadline (days <= 7) renders red warning highlight ("● ใกล้ปิดรับ", bold #dc2626)
 *  5. Bilingual Localization Consistency:
 *     - All warning badges and fallback notices translate accurately between Thai and English
 */

import React, { Suspense } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProjectDetailPage from '@/app/opportunities/[id]/page';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Project } from '@/types/project';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation & Context Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  usePathname: () => '/opportunities/99000000001',
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

const BASE_PROJECT: Project = {
  _id: 'proj_base_001',
  externalId: 99000000001,
  title: {
    th: 'โครงการจัดหาระบบคอมพิวเตอร์และเครือข่ายสำนักงาน',
    en: 'Office Computer and Network System Procurement Project',
  },
  department: {
    th: 'สำนักการคลัง',
    en: 'Finance Department',
  },
  budget: 5000000,
  historicalAvg: 5000000,
  publishDate: '2026-01-10T00:00:00.000Z',
  processedDate: '2026-01-10T00:00:00.000Z',
  deadline: '2026-12-31T00:00:00.000Z', // Far future
  fiscalYear: 2569,
  category: 'Information System',
  procurementType: 'e-Bidding',
  status: 'เปิดรับข้อเสนอ',
  aiConfidence: 'High',
  torStatus: 'AVAILABLE',
  extractionStatus: 'EXTRACTED',
  classificationReviewStatus: 'APPROVED',
  sourceDocument: 'TOR_Computer_2569.pdf',
  description: {
    th: 'จัดหาระบบคอมพิวเตอร์สำนักงาน',
    en: 'Procurement of office computer systems',
  },
  scope: {
    th: ['จัดหาเครื่องคอมพิวเตอร์ 100 เครื่อง', 'ติดตั้งระบบเครือข่าย'],
    en: ['Procure 100 workstations', 'Install network system'],
  },
  qualifications: {
    th: ['เป็นนิติบุคคล', 'มีทุนจดทะเบียน 2,000,000 บาท'],
    en: ['Registered entity', 'Registered capital 2M THB'],
  },
};

/**
 * 1. Record with Low Extraction Confidence and Unreviewed Status
 */
const LOW_CONFIDENCE_PROJECT: Project = {
  ...BASE_PROJECT,
  _id: 'proj_low_conf_002',
  externalId: 99000000002,
  title: {
    th: 'โครงการจ้างบริการดูแลรักษาระบบคอมพิวเตอร์ (เอกสารลายมือ/สแกนไม่ชัด)',
    en: 'Computer Maintenance Service (Handwritten / Low Quality Scan)',
  },
  aiConfidence: 'Low',
  classificationReviewStatus: 'PENDING_REVIEW', // Unreviewed AI record
};

/**
 * 2. Record with Unavailable Original TOR File (NO_TOR)
 */
const NO_TOR_PROJECT: Project = {
  ...BASE_PROJECT,
  _id: 'proj_no_tor_003',
  externalId: 99000000003,
  title: {
    th: 'โครงการจัดซื้ออุปกรณ์สื่อสาร (ไม่มีเอกสาร TOR แนบในระบบ)',
    en: 'Communication Equipment Procurement (No TOR Attached on e-GP)',
  },
  torStatus: 'NO_TOR',
  classificationReviewStatus: 'PENDING_REVIEW',
  sourceDocument: '',
};

/**
 * 3. Record with Pending TOR Extraction (PENDING)
 */
const PENDING_TOR_PROJECT: Project = {
  ...BASE_PROJECT,
  _id: 'proj_pending_tor_004',
  externalId: 99000000004,
  title: {
    th: 'โครงการจัดหาซอฟต์แวร์บริหารงานบุคคล (TOR รอดำเนินการสกัดข้อมูล)',
    en: 'HR Management Software Procurement (TOR Extraction Pending)',
  },
  torStatus: 'PENDING',
  extractionStatus: 'PENDING',
};

/**
 * 4. Record with Missing Budget & Missing Technical Requirements
 */
const MISSING_FIELDS_PROJECT: Project = {
  ...BASE_PROJECT,
  _id: 'proj_missing_fields_005',
  externalId: 99000000005,
  title: {
    th: 'โครงการจ้างที่ปรึกษาพัฒนาระบบข้อมูล (ไม่ระบุงบประมาณและข้อกำหนด)',
    en: 'Data System Consulting Project (Unspecified Budget & Tech Specs)',
  },
  budget: 0, // Missing/unspecified budget
  requiredTechnologies: [], // Empty technologies
  technicalRequirements: undefined, // Missing technical checklist
};

/**
 * 5. Record with Expired / Closed Submission Deadline
 */
const EXPIRED_DEADLINE_PROJECT: Project = {
  ...BASE_PROJECT,
  _id: 'proj_expired_006',
  externalId: 99000000006,
  title: {
    th: 'โครงการพัฒนาระบบคลังเอกสารดิจิทัล (ปิดรับข้อเสนอแล้ว)',
    en: 'Digital Document Archive Project (Submission Closed)',
  },
  deadline: '2025-01-01T00:00:00.000Z', // In the past
};

/**
 * 6. Record with Imminent / Closing Soon Deadline (within 3 days)
 */
const now = new Date();
const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

const CLOSING_SOON_PROJECT: Project = {
  ...BASE_PROJECT,
  _id: 'proj_closing_soon_007',
  externalId: 99000000007,
  title: {
    th: 'โครงการพัฒนาแพลตฟอร์มบริการแผนที่ดิจิทัล (ใกล้ปิดรับข้อเสนอ)',
    en: 'Digital Map Service Platform Development (Closing Soon)',
  },
  deadline: inThreeDays,
};

// ─────────────────────────────────────────────────────────────────────────────
// Render Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function renderDetailView(projectData: Project, lang: 'th' | 'en' = 'th') {
  if (typeof window !== 'undefined') {
    localStorage.setItem('torbidd_lang', lang);
    document.documentElement.lang = lang;
  }

  // Set up mock fetch for the given project
  global.fetch = jest.fn((url: string | URL | Request) => {
    const urlStr = String(url);
    if (urlStr.includes(`/api/projects/${projectData.externalId}`)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: projectData }),
      } as Response);
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    } as Response);
  }) as jest.Mock;

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ToastProvider>
        <LanguageProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <ProjectDetailPage params={Promise.resolve({ id: String(projectData.externalId) })} />
          </Suspense>
        </LanguageProvider>
      </ToastProvider>,
    );
  });

  await waitFor(() => {
    expect(result!.container.querySelector('.detail-hero-title')).toBeInTheDocument();
  });

  return result!;
}

function renderFeedCard(projectData: Project, lang: 'th' | 'en' = 'th') {
  if (typeof window !== 'undefined') {
    localStorage.setItem('torbidd_lang', lang);
    document.documentElement.lang = lang;
  }

  return render(
    <ToastProvider>
      <LanguageProvider>
        <ProjectCard project={projectData} />
      </LanguageProvider>
    </ToastProvider>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: UI Warnings for Low Confidence, Missing Fields, Unavailable TOR, & Expired Deadlines', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // Section 1: Low Extraction Confidence Warnings
  // ===========================================================================
  describe('1. Low Extraction Confidence Warnings', () => {
    it('1.1 renders red warning styling (#fef2f2 / #991b1b) for Low confidence in detail view hero', async () => {
      const { container } = await renderDetailView(LOW_CONFIDENCE_PROJECT, 'th');

      // Check hero confidence badge
      const heroConfidenceBadge = screen.getByText(/จำแนก AI · ความเชื่อมั่น: Low/i);
      expect(heroConfidenceBadge).toBeInTheDocument();

      // Verify warning styling
      expect(heroConfidenceBadge).toHaveStyle({
        color: '#991b1b',
        background: '#fef2f2',
      });
    });

    it('1.2 renders alert color (#dc2626) for Low confidence in detail view intelligence sidebar', async () => {
      const { container } = await renderDetailView(LOW_CONFIDENCE_PROJECT, 'th');

      // Intelligence sidebar confidence item
      expect(screen.getByText(/ระดับความเชื่อมั่น AI/i)).toBeInTheDocument();

      // Sidebar confidence pill
      const confidencePills = screen.getAllByText('Low');
      expect(confidencePills.length).toBeGreaterThan(0);

      // Verify sidebar pill styling
      const sidebarPill = confidencePills.find((el) =>
        el.getAttribute('style')?.includes('rgba(239, 68, 68, 0.1)'),
      );
      expect(sidebarPill).toBeDefined();
      expect(sidebarPill).toHaveStyle({ color: '#dc2626' });
    });

    it('1.3 renders "ความเชื่อมั่น: ต่ำ" (TH) / "Confidence: Low" (EN) in opportunity feed card', () => {
      // Thai mode
      const { unmount } = renderFeedCard(LOW_CONFIDENCE_PROJECT, 'th');
      expect(screen.getByText(/การจำแนก AI · ความเชื่อมั่น: ต่ำ/i)).toBeInTheDocument();
      unmount();

      // English mode
      renderFeedCard(LOW_CONFIDENCE_PROJECT, 'en');
      expect(screen.getByText(/AI classification · Confidence: Low/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 2: Unavailable Original Document (TOR) Warnings
  // ===========================================================================
  describe('2. Unavailable Original Document (TOR) Warnings', () => {
    it('2.1 renders red warning card in detail view when TOR status is "NO_TOR"', async () => {
      const { container } = await renderDetailView(NO_TOR_PROJECT, 'th');

      // Label: สถานะเอกสาร TOR
      expect(screen.getByText(/สถานะเอกสาร TOR|TOR Document Status/i)).toBeInTheDocument();

      // Value: 📄 ไม่มีเอกสาร TOR
      expect(screen.getByText(/📄 ไม่มีเอกสาร TOR|📄 No TOR Document/i)).toBeInTheDocument();

      // Sub-label: ยังไม่แนบเอกสาร TOR ในระบบ e-GP
      expect(
        screen.getByText(/ยังไม่แนบเอกสาร TOR ในระบบ e-GP|TOR not yet attached on e-GP/i),
      ).toBeInTheDocument();
    });

    it('2.2 renders amber warning card in detail view when TOR status is "PENDING"', async () => {
      const { container } = await renderDetailView(PENDING_TOR_PROJECT, 'th');

      // Value: ⏳ TOR อยู่ระหว่างดำเนินการ
      expect(
        screen.getByText(/⏳ TOR อยู่ระหว่างดำเนินการ|⏳ TOR Pending Extraction/i),
      ).toBeInTheDocument();

      // Sub-label: กำลังดำเนินการสกัดข้อมูล TOR
      expect(
        screen.getByText(/กำลังดำเนินการสกัดข้อมูล TOR|TOR document being processed by AI/i),
      ).toBeInTheDocument();
    });

    it('2.3 renders red "📄 ไม่มี TOR" badge in feed card when TOR is unavailable', () => {
      const { unmount } = renderFeedCard(NO_TOR_PROJECT, 'th');
      const badgeTh = screen.getByText(/📄 ไม่มี TOR/i);
      expect(badgeTh).toBeInTheDocument();
      expect(badgeTh).toHaveStyle({ color: '#dc2626' });
      unmount();

      renderFeedCard(NO_TOR_PROJECT, 'en');
      const badgeEn = screen.getByText(/📄 No TOR/i);
      expect(badgeEn).toBeInTheDocument();
      expect(badgeEn).toHaveStyle({ color: '#dc2626' });
    });

    it('2.4 renders amber "⏳ TOR รอดำเนินการ" badge in feed card when TOR extraction is pending', () => {
      const { unmount } = renderFeedCard(PENDING_TOR_PROJECT, 'th');
      const pendingBadgeTh = screen.getByText(/⏳ TOR รอดำเนินการ/i);
      expect(pendingBadgeTh).toBeInTheDocument();
      expect(pendingBadgeTh).toHaveStyle({ color: '#d97706' });
      unmount();

      renderFeedCard(PENDING_TOR_PROJECT, 'en');
      const pendingBadgeEn = screen.getByText(/⏳ TOR Pending/i);
      expect(pendingBadgeEn).toBeInTheDocument();
      expect(pendingBadgeEn).toHaveStyle({ color: '#d97706' });
    });
  });

  // ===========================================================================
  // Section 3: Missing Fields & Visual Fallbacks
  // ===========================================================================
  describe('3. Missing Fields & Visual Fallbacks', () => {
    it('3.1 renders "ไม่ระบุ" (TH) / "N/A" (EN) when project budget is missing or zero', async () => {
      // In Detail View
      const { container, unmount } = await renderDetailView(MISSING_FIELDS_PROJECT, 'th');
      const budgetMeta = container.querySelector('.meta-value.budget');
      expect(budgetMeta).toHaveTextContent('ไม่ระบุ');
      unmount();

      const { container: containerEn } = await renderDetailView(MISSING_FIELDS_PROJECT, 'en');
      const budgetMetaEn = containerEn.querySelector('.meta-value.budget');
      expect(budgetMetaEn).toHaveTextContent('N/A');
    });

    it('3.2 renders "ไม่ระบุ" (TH) / "N/A" (EN) for missing budget in opportunity feed card', () => {
      const { container, unmount } = renderFeedCard(MISSING_FIELDS_PROJECT, 'th');
      expect(container.querySelector('.meta-value.budget')).toHaveTextContent('ไม่ระบุ');
      unmount();

      const { container: containerEn } = renderFeedCard(MISSING_FIELDS_PROJECT, 'en');
      expect(containerEn.querySelector('.meta-value.budget')).toHaveTextContent('N/A');
    });

    it('3.3 renders empty checklist notice when technical requirements are missing', async () => {
      await renderDetailView(MISSING_FIELDS_PROJECT, 'th');

      // Empty state notice box in TechStackRequirements
      expect(
        screen.getByText(/ยังไม่มีรายการตรวจสอบข้อกำหนดทางเทคนิค|No Technical Requirements Checklist Available/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/กดปุ่ม "ประมวลผล TOR อัตโนมัติ" ในแถบด้านข้าง/i),
      ).toBeInTheDocument();
    });

    it('3.4 presents unreviewed record warning indicator ("⚡ ดึงข้อมูลจาก e-GP (รอตรวจทาน)")', async () => {
      await renderDetailView(LOW_CONFIDENCE_PROJECT, 'th');

      // Verification Status section
      expect(screen.getByText(/สถานะการตรวจทาน|Verification Status/i)).toBeInTheDocument();
      expect(
        screen.getByText(/⚡ ดึงข้อมูลจาก e-GP \(รอตรวจทาน\)|⚡ AI Extracted \(e-GP Source\)/i),
      ).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 4: Closed & Expired Deadline Indicators
  // ===========================================================================
  describe('4. Closed & Expired Deadline Indicators', () => {
    it('4.1 renders "● ปิดรับข้อเสนอ" / "● Closed" closed-dot badge in detail view for expired deadline', async () => {
      const { container } = await renderDetailView(EXPIRED_DEADLINE_PROJECT, 'th');

      // Closed dot tag
      const closedTag = container.querySelector('.tag.closed-dot');
      expect(closedTag).toBeInTheDocument();
      expect(closedTag).toHaveTextContent('● ปิดรับข้อเสนอ');
    });

    it('4.2 renders "ปิดรับแล้ว" (TH) / "Closed" (EN) in the submission deadline countdown block', async () => {
      const { unmount } = await renderDetailView(EXPIRED_DEADLINE_PROJECT, 'th');
      expect(screen.getByText('ปิดรับแล้ว')).toBeInTheDocument();
      unmount();

      await renderDetailView(EXPIRED_DEADLINE_PROJECT, 'en');
      expect(screen.getByText('Closed')).toBeInTheDocument();
    });

    it('4.3 renders "● ปิดรับข้อเสนอ" / "● Closed" closed-dot tag in feed card for expired record', () => {
      const { container, unmount } = renderFeedCard(EXPIRED_DEADLINE_PROJECT, 'th');
      const closedTagTh = container.querySelector('.tag.closed-dot');
      expect(closedTagTh).toBeInTheDocument();
      expect(closedTagTh).toHaveTextContent('● ปิดรับข้อเสนอ');
      unmount();

      const { container: containerEn } = renderFeedCard(EXPIRED_DEADLINE_PROJECT, 'en');
      const closedTagEn = containerEn.querySelector('.tag.closed-dot');
      expect(closedTagEn).toBeInTheDocument();
      expect(closedTagEn).toHaveTextContent('● Closed');
    });

    it('4.4 renders red warning highlight ("● ใกล้ปิดรับ", bold #dc2626) for imminent deadline (<= 7 days)', async () => {
      const { container } = await renderDetailView(CLOSING_SOON_PROJECT, 'th');

      // Closing soon tag in hero
      const closingTag = container.querySelector('.tag.closing-soon-dot');
      expect(closingTag).toBeInTheDocument();
      expect(closingTag).toHaveTextContent(/● ใกล้ปิดรับ/);

      // Red countdown label
      const countdownLabel = screen.getByText(/เหลือ \d+ วัน/);
      expect(countdownLabel).toBeInTheDocument();
      expect(countdownLabel).toHaveStyle({ color: '#dc2626' });

      // Deadline text marked with .deadline-soon class
      const deadlineValue = container.querySelector('.meta-value.deadline-soon');
      expect(deadlineValue).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 5: Bilingual Localization Consistency
  // ===========================================================================
  describe('5. Bilingual Localization Consistency across Warnings', () => {
    it('5.1 renders English warning notices for unavailable TOR and pending verification in English mode', async () => {
      await renderDetailView(NO_TOR_PROJECT, 'en');

      expect(screen.getByText('TOR Document Status')).toBeInTheDocument();
      expect(screen.getByText('📄 No TOR Document')).toBeInTheDocument();
      expect(screen.getByText('TOR not yet attached on e-GP')).toBeInTheDocument();
      expect(screen.getByText('⚡ AI Extracted (e-GP Source)')).toBeInTheDocument();
    });

    it('5.2 renders English empty tech checklist notice in English mode', async () => {
      await renderDetailView(MISSING_FIELDS_PROJECT, 'en');

      expect(screen.getByText('No Technical Requirements Checklist Available')).toBeInTheDocument();
      expect(
        screen.getByText(/Click "Auto-Extract TOR" in the sidebar/i),
      ).toBeInTheDocument();
    });
  });
});
