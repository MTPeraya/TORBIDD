/**
 * E2E: Detail View Presentation of Structured AI-Extracted Fields
 *
 * Verifies that the Opportunity Detail View (/opportunities/[id]) accurately presents
 * all structured AI-extracted fields:
 *  1. Detailed Project Scope (itemized technical scope bullet points in Thai & English)
 *  2. Expected Deliverables (deliverables card, delivery milestones, acceptance criteria, due dates)
 *  3. Bidder Qualifications (structured criteria categories: Legal, Experience, Financial, Technical,
 *     mandatory badges, minimum threshold values, and interactive Go/No-Go checklist)
 *  4. Responsible Department & Inquiries Contact Details (department, division, clickable tel: and mailto: links)
 *  5. Additional AI-Extracted Fields (AI Executive Summary, Tech Stack requirements, AI Confidence,
 *     Extraction Status, Verified e-GP Project ID, approved budget, and submission deadline)
 *  6. Bilingual toggling (Thai <-> English) across all structured AI fields
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProjectDetailPage from '@/app/opportunities/[id]/page';
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
  usePathname: () => '/opportunities/67119538991',
  useSearchParams: () => new URLSearchParams(),
}));

const mockAuth = {
  user: { email: 'bidder@techcorp.com', id: 'user-001' },
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

const mockToggleBookmark = jest.fn();
jest.mock('@/hooks/useBookmarks', () => ({
  useBookmarks: () => ({
    bookmarks: [],
    isBookmarked: jest.fn().mockReturnValue(false),
    toggleBookmark: mockToggleBookmark,
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Comprehensive AI-Extracted Project Fixture
// ─────────────────────────────────────────────────────────────────────────────

const AI_EXTRACTED_PROJECT: Project = {
  _id: 'proj_67119538991',
  externalId: 67119538991,
  title: {
    th: 'โครงการจัดจ้างพัฒนาระบบพอร์ทัลบริการประชาชนแบบครบวงจร (BMA One Stop Portal)',
    en: 'Comprehensive Citizen Service Portal Development Project (BMA One Stop Portal)',
  },
  department: {
    th: 'สำนักยุทธศาสตร์และประเมินผล',
    en: 'Strategy and Evaluation Department',
  },
  budget: 45000000,
  historicalAvg: 43500000,
  publishDate: '2026-08-01T00:00:00.000Z',
  deadline: '2026-09-30T00:00:00.000Z',
  fiscalYear: 2569,
  category: 'Website',
  procurementType: 'e-Bidding',
  status: 'เปิดรับข้อเสนอ',
  aiConfidence: 'High',
  extractionStatus: 'EXTRACTED',

  // 1. AI Executive Summary (Issue #87)
  summary: {
    th: 'โครงการพัฒนาระบบศูนย์กลางบริการประชาชนกรุงเทพมหานครแบบ One Stop Service เพื่อรวบรวมงานบริการภาครัฐกว่า 50 บริการไว้ในที่เดียว รองรับการยืนยันตัวตน Digital ID และการชำระค่าธรรมเนียมออนไลน์',
    en: 'Development of Bangkok Metropolitan Administration Central One Stop Service Portal integrating over 50 municipal digital services with Digital ID authentication and online fee payments.',
  },

  description: {
    th: 'จ้างเหมาพัฒนาระบบพอร์ทัลกลางเพื่อการบริการประชาชนแบบเบ็ดเสร็จ ณ จุดเดียว',
    en: 'Turnkey development of unified public service portal for comprehensive citizen services.',
  },

  // 2. Detailed Work Scope
  scope: {
    th: [
      'ออกแบบและติดตั้งสถาปัตยกรรมคลาวด์ Microservices บน Google Cloud Platform',
      'พัฒนาระบบ Single Sign-On (SSO) รองรับการยืนยันตัวตนผ่าน ThaID และ Digital ID',
      'เชื่อมโยงระบบรับชำระค่าธรรมเนียมอิเล็กทรอนิกส์ (e-Payment) ร่วมกับธนาคารกรุงไทย',
      'จัดทำระบบ High Availability และ Disaster Recovery (RPO <= 15 นาที, RTO <= 1 ชั่วโมง)',
      'จัดฝึกอบรมเจ้าหน้าที่และจัดทำคู่มือการใช้งานระบบทั้งภาษาไทยและภาษาอังกฤษ',
    ],
    en: [
      'Design and deploy Cloud Microservices architecture on Google Cloud Platform',
      'Implement Single Sign-On (SSO) subsystem supporting ThaID and National Digital ID',
      'Integrate electronic payment gateway (e-Payment) with partner financial institutions',
      'Establish High Availability and Disaster Recovery architecture (RPO <= 15 min, RTO <= 1 hr)',
      'Conduct administrator training and deliver comprehensive manuals in Thai and English',
    ],
  },

  // 3. Expected Deliverables
  deliverables: [
    {
      id: 'del-1',
      name: 'งวดที่ 1: รายงานผลการศึกษาและออกแบบสถาปัตยกรรมระบบ (System Architecture & Security Blueprint)',
      date: '2026-10-15T00:00:00.000Z',
      description: 'พิมพ์เขียวสถาปัตยกรรมระบบและแผนความมั่นคงปลอดภัยตามมาตรฐาน ISO 27001',
    },
    {
      id: 'del-2',
      name: 'งวดที่ 2: ระบบเวอร์ชันทดสอบ Beta Release พร้อมผลการทดสอบ Unit Test และ Integration Test',
      date: '2026-11-30T00:00:00.000Z',
      description: 'ระบบต้นแบบเวอร์ชันเบต้าที่ผ่านการทดสอบครอบคลุมฟังก์ชันหลัก',
    },
    {
      id: 'del-3',
      name: 'งวดที่ 3: ระบบเวอร์ชันสมบูรณ์ (Production Release) พร้อมซอร์สโค้ดและคู่มือการดูแลรักษา',
      date: '2026-12-31T00:00:00.000Z',
      description: 'ส่งมอบซอร์สโค้ดฉบับสมบูรณ์ เอกสารสิทธิ์ และส่งมอบงานงวดสุดท้าย',
    },
  ],

  // 4. Bidder Qualifications & Structured Criteria (Issue #90)
  qualifications: {
    th: [
      'เป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคาอิเล็กทรอนิกส์ดังกล่าว',
      'มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท',
      'มีผลงานการพัฒนาระบบคลาวด์หรือพอร์ทัลขนาดใหญ่ไม่น้อยกว่า 15,000,000 บาท ในสัญญาเดียว',
      'มีบุคลากรหลักที่ได้รับใบรับรอง Certified Kubernetes Administrator (CKA) ประจำทีมงาน',
    ],
    en: [
      'Must be a legally registered juristic entity in IT and software services',
      'Paid-up registered capital of at least 10,000,000 THB',
      'Completed cloud or enterprise portal contract worth at least 15,000,000 THB in a single contract',
      'Key personnel must include certified Kubernetes Administrator (CKA) professionals',
    ],
  },
  extractedQualifications: [
    {
      id: 'qual-1',
      description: {
        th: 'เป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคาอิเล็กทรอนิกส์ดังกล่าว และจดทะเบียนพาณิชย์ถูกต้อง',
        en: 'Must be a registered legal entity with certified commercial software business status',
      },
      category: 'Legal',
      mandatory: true,
      legalReference: 'ระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 11',
    },
    {
      id: 'qual-2',
      description: {
        th: 'มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท (สิบสิบล้านบาทถ้วน) และมีสถานะการเงินมั่นคง',
        en: 'Must have paid-up registered capital of at least 10,000,000 THB with audited financial statements',
      },
      category: 'Financial',
      threshold: '10,000,000 บาท',
      mandatory: true,
      legalReference: 'หนังสือเวียน ด่วนที่สุด ที่ กค (กวจ) 0405.2/ว 112',
    },
    {
      id: 'qual-3',
      description: {
        th: 'มีผลงานการพัฒนาระบบคลาวด์พอร์ทัลภาครัฐหรือเอกชน มูลค่าไม่น้อยกว่า 15,000,000 บาท ในสัญญาฉบับเดียว',
        en: 'Must have successful track record of cloud portal project valued at least 15,000,000 THB in a single contract',
      },
      category: 'Experience',
      threshold: '15,000,000 บาท',
      mandatory: true,
      legalReference: 'ระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 28 (3)',
    },
    {
      id: 'qual-4',
      description: {
        th: 'มีทีมงานผู้เชี่ยวชาญที่ถือครองใบประกาศรับรอง Kubernetes (CKA) หรือ Cloud Professional อย่างน้อย 2 คน',
        en: 'Must have at least 2 key engineers holding valid Kubernetes (CKA) or Cloud Professional certificates',
      },
      category: 'Technical',
      mandatory: false,
    },
  ],

  // 5. Inquiries & Contact Details
  contactInfo: {
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    division: {
      th: 'กองสารสนเทศภูมิศาสตร์และข้อมูลกลาง',
      en: 'Geographic Information and Central Data Division',
    },
    phone: '02-123-4567 ต่อ 8901',
    email: 'procurement.it@bma.go.th',
    address: 'ศาลาว่าการกรุงเทพมหานคร 2 ดินแดง',
  },

  // 6. Required Technologies & Checklist (Issue #89)
  requiredTechnologies: ['Google Cloud', 'Kubernetes', 'Docker', 'PostgreSQL', 'Next.js'],
  technicalRequirements: {
    th: [
      'รองรับผู้ใช้งานพร้อมกัน (Concurrent Users) ไม่น้อยกว่า 5,000 คน',
      'ความพร้อมใช้งานของระบบ (SLA Uptime) ไม่น้อยกว่า 99.9%',
      'ปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) อย่างเคร่งครัด',
    ],
    en: [
      'Support at least 5,000 concurrent active users without degradation',
      'System Availability SLA Uptime not less than 99.9%',
      'Full compliance with Thailand Personal Data Protection Act (PDPA)',
    ],
  },

  sourceDocument: 'TOR_BMA_OneStopPortal_2569.pdf',
  sourceUrl: 'https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=67119538991',
  processedDate: '2026-08-01T00:00:00.000Z',
  torStatus: 'AVAILABLE',
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Helper Wrapper
// ─────────────────────────────────────────────────────────────────────────────

async function renderDetailViewWithProviders(projectId = '67119538991', lang: 'th' | 'en' = 'th') {
  if (typeof window !== 'undefined') {
    localStorage.setItem('torbidd_lang', lang);
    document.documentElement.lang = lang;
  }

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ToastProvider>
        <LanguageProvider>
          <Suspense fallback={<div data-testid="detail-skeleton">Loading...</div>}>
            <ProjectDetailPage params={Promise.resolve({ id: projectId })} />
          </Suspense>
        </LanguageProvider>
      </ToastProvider>,
    );
  });

  // Wait for detail page to fetch and render project content
  await waitFor(() => {
    expect(result!.container.querySelector('.detail-hero-title')).toBeInTheDocument();
  });

  return result!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Detail View Presentation of Structured AI-Extracted Fields', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    // Mock fetch to return AI_EXTRACTED_PROJECT for /api/projects/:id
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/projects/67119538991')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: AI_EXTRACTED_PROJECT,
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as Response);
    }) as jest.Mock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // Section 1: Detailed Project Scope
  // ===========================================================================
  describe('1. Detailed Project Scope Presentation', () => {
    it('1.1 accurately presents all itemized technical work scope bullet points in Thai', async () => {
      const { container } = await renderDetailViewWithProviders('67119538991', 'th');

      // Scope header must be visible
      expect(screen.getByText(/ขอบเขตการดำเนินงาน|Scope of Work/i)).toBeInTheDocument();

      // Verify each individual technical scope item extracted by AI is displayed
      const scopeItems = container.querySelectorAll('.scope-item');
      expect(scopeItems.length).toBe(5);

      expect(screen.getByText(/ออกแบบและติดตั้งสถาปัตยกรรมคลาวด์ Microservices/i)).toBeInTheDocument();
      expect(screen.getByText(/พัฒนาระบบ Single Sign-On \(SSO\) รองรับการยืนยันตัวตนผ่าน ThaID/i)).toBeInTheDocument();
      expect(screen.getByText(/เชื่อมโยงระบบรับชำระค่าธรรมเนียมอิเล็กทรอนิกส์/i)).toBeInTheDocument();
      expect(screen.getByText(/จัดทำระบบ High Availability และ Disaster Recovery/i)).toBeInTheDocument();
      expect(screen.getByText(/จัดฝึกอบรมเจ้าหน้าที่และจัดทำคู่มือการใช้งานระบบ/i)).toBeInTheDocument();
    });

    it('1.2 accurately renders English work scope items when language is set to English', async () => {
      await renderDetailViewWithProviders('67119538991', 'en');

      expect(screen.getByText(/Design and deploy Cloud Microservices architecture/i)).toBeInTheDocument();
      expect(screen.getByText(/Implement Single Sign-On \(SSO\) subsystem supporting ThaID/i)).toBeInTheDocument();
      expect(screen.getByText(/Establish High Availability and Disaster Recovery architecture/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 2: Expected Deliverables
  // ===========================================================================
  describe('2. Expected Deliverables Presentation', () => {
    it('2.1 accurately presents the Expected Deliverables card with itemized deliverables', async () => {
      const { container } = await renderDetailViewWithProviders('67119538991', 'th');

      // Verify Expected Deliverables section header
      const deliverablesCard = container.querySelector('[data-testid="detail-deliverables-card"]');
      expect(deliverablesCard).toBeInTheDocument();
      expect(screen.getByText(/ผลลัพธ์และสิ่งที่ต้องส่งมอบ|Expected Deliverables/i)).toBeInTheDocument();

      // Verify all 3 deliverables are rendered
      const deliverableItems = container.querySelectorAll('.deliverable-item');
      expect(deliverableItems.length).toBe(3);

      expect(screen.getByText(/งวดที่ 1: รายงานผลการศึกษาและออกแบบสถาปัตยกรรมระบบ/i)).toBeInTheDocument();
      expect(screen.getByText(/งวดที่ 2: ระบบเวอร์ชันทดสอบ Beta Release/i)).toBeInTheDocument();
      expect(screen.getByText(/งวดที่ 3: ระบบเวอร์ชันสมบูรณ์ \(Production Release\)/i)).toBeInTheDocument();
    });

    it('2.2 presents formatted delivery milestone due dates and acceptance checkmarks', async () => {
      const { container } = await renderDetailViewWithProviders('67119538991', 'th');

      // Check for checkmark icon (✓)
      const bullets = container.querySelectorAll('.deliverable-bullet');
      expect(bullets.length).toBe(3);
      expect(bullets[0]).toHaveTextContent('✓');

      // Check formatted due dates
      expect(screen.getAllByText(/กำหนดส่งมอบ:/i).length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Section 3: Bidder Qualifications & Criteria
  // ===========================================================================
  describe('3. Bidder Qualifications & Eligibility Checklist', () => {
    it('3.1 presents structured qualification cards with categorized badges (Legal, Financial, Experience, Tech)', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      // Verify category badges rendered by EligibilityChecklist
      expect(screen.getAllByText(/กฎหมาย|Legal/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ทุน\/การเงิน|Financial/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ผลงานที่ผ่านมา|Past Experience/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/เทคนิค|Technical/i).length).toBeGreaterThan(0);
    });

    it('3.2 presents mandatory criteria flags and explicit threshold values', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      // Mandatory badges (เกณฑ์บังคับ / Mandatory)
      const mandatoryBadges = screen.getAllByText(/เกณฑ์บังคับ|Mandatory/i);
      expect(mandatoryBadges.length).toBeGreaterThanOrEqual(3);

      // Explicit minimum threshold amounts extracted from TOR
      expect(screen.getByText(/10,000,000/)).toBeInTheDocument(); // Capital threshold
      expect(screen.getByText(/15,000,000/)).toBeInTheDocument(); // Experience threshold
    });

    it('3.3 allows interactive checking of qualification items and dynamically calculates eligibility score', async () => {
      const { container } = await renderDetailViewWithProviders('67119538991', 'th');

      // Initially 0 items checked (displays 0% in gauge-score)
      const gaugeScore = container.querySelector('.gauge-score');
      expect(gaugeScore).toBeInTheDocument();
      expect(gaugeScore).toHaveTextContent('0%');

      // Click first qualification item in eligibility-checklist
      const qualItem = container.querySelector('.eligibility-checklist .checklist-item');
      expect(qualItem).toBeInTheDocument();

      act(() => {
        fireEvent.click(qualItem!);
      });

      // Score should update from 0% to > 0%
      await waitFor(() => {
        expect(container.querySelector('.gauge-score')).not.toHaveTextContent('0%');
      });
    });
  });

  // ===========================================================================
  // Section 4: Responsible Department & Contact Details
  // ===========================================================================
  describe('4. Responsible Department & Inquiries Contact Details', () => {
    it('4.1 accurately presents procuring department and internal division names', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      // Department & Sub-division
      expect(screen.getAllByText('สำนักยุทธศาสตร์และประเมินผล').length).toBeGreaterThan(0);
      expect(screen.getByText('กองสารสนเทศภูมิศาสตร์และข้อมูลกลาง')).toBeInTheDocument();
    });

    it('4.2 renders active clickable tel: telephone link for inquiries', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      const phoneLink = screen.getByRole('link', { name: /02-123-4567 ต่อ 8901/i });
      expect(phoneLink).toBeInTheDocument();
      expect(phoneLink).toHaveAttribute('href', 'tel:02-123-4567 ต่อ 8901');
    });

    it('4.3 renders active clickable mailto: email address link', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      const emailLink = screen.getByRole('link', { name: 'procurement.it@bma.go.th' });
      expect(emailLink).toBeInTheDocument();
      expect(emailLink).toHaveAttribute('href', 'mailto:procurement.it@bma.go.th');
    });
  });

  // ===========================================================================
  // Section 5: Additional Core AI-Extracted Fields & Transparency
  // ===========================================================================
  describe('5. Additional AI-Extracted Metadata & Transparency Fields', () => {
    it('5.1 renders AI Executive Summary card with functional copy summary button', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      expect(screen.getByText(/สรุปสาระสำคัญ TOR \(AI Executive Summary\)/i)).toBeInTheDocument();

      // Verify AI summary text is presented
      expect(
        screen.getByText(/โครงการพัฒนาระบบศูนย์กลางบริการประชาชนกรุงเทพมหานครแบบ One Stop Service/i),
      ).toBeInTheDocument();

      // Verify Copy Summary button
      const copyBtn = screen.getByRole('button', { name: /คัดลอกสรุป|Copy Summary/i });
      expect(copyBtn).toBeInTheDocument();

      // Click copy button
      act(() => {
        fireEvent.click(copyBtn);
      });

      expect(screen.getByText(/คัดลอกแล้ว|Copied/i)).toBeInTheDocument();
    });

    it('5.2 presents required tech stack chips and technical requirements checklist', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      expect(screen.getByText(/เทคโนโลยีที่ระบุใน TOR|Technologies/i)).toBeInTheDocument();

      // Verify tech tags
      expect(screen.getByText('Google Cloud')).toBeInTheDocument();
      expect(screen.getByText('Kubernetes')).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();

      // Verify technical requirements
      expect(screen.getByText(/รองรับผู้ใช้งานพร้อมกัน \(Concurrent Users\) ไม่น้อยกว่า 5,000 คน/i)).toBeInTheDocument();
      expect(screen.getByText(/ความพร้อมใช้งานของระบบ \(SLA Uptime\) ไม่น้อยกว่า 99\.9%/i)).toBeInTheDocument();
      expect(screen.getByText(/ปฏิบัติตาม พ\.ร\.บ\. คุ้มครองข้อมูลส่วนบุคคล/i)).toBeInTheDocument();
    });

    it('5.3 displays AI Confidence badge and extraction status', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      expect(screen.getByText(/จำแนก AI · ความเชื่อมั่น: High/i)).toBeInTheDocument();
      expect(screen.getByText(/ประมวลผลแล้ว \(EXTRACTED\)/i)).toBeInTheDocument();
    });

    it('5.4 renders official e-GP project ID and verification portal hyperlink', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      expect(screen.getByText(/ID: 67119538991/i)).toBeInTheDocument();

      const egpLink = screen.getByText(/ตรวจสอบความถูกต้องบนเว็บ e-GP ทางการ/i).closest('a');
      expect(egpLink).toHaveAttribute('href', expect.stringContaining('67119538991'));
      expect(egpLink).toHaveAttribute('target', '_blank');
    });

    it('5.5 displays approved budget and submission deadline with days countdown', async () => {
      await renderDetailViewWithProviders('67119538991', 'th');

      // Budget label and value
      expect(screen.getByText(/45,000,000 บาท/i)).toBeInTheDocument();

      // Submission deadline header and countdown badge
      expect(screen.getAllByText(/กำหนดส่ง|Deadline/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/เหลือ \d+ วัน|ปิดรับแล้ว|\d+ days remaining/i)).toBeInTheDocument();
    });
  });
});
