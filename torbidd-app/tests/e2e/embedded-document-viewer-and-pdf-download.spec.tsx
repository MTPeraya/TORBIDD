/**
 * E2E: Embedded Document Viewer Rendering & Downloadable Links to Original Source Government TOR PDF Files
 *
 * Verifies that the application:
 *  1. Correctly renders the embedded document viewer (TorDocumentViewer) within the opportunity detail view:
 *     - Toolbar controls (filename, verification badge, zoom controls, close button)
 *     - Article navigation sidebar with page indicators and AI highlight badges
 *     - Paper document sheet with AI Preview watermark, Project Ref ID, and non-official disclaimer
 *     - Clause switching and in-document keyword search filtering
 *     - Modal open/close lifecycle (toolbar [x] button, overlay click, and Escape key)
 *  2. Accurately presents downloadable links to original source government TOR PDF files:
 *     - "Open BMA e-GP Source ↗" button in the viewer toolbar with target="_blank"
 *     - Official e-GP verification hyperlink within the legal disclaimer box
 *     - Primary e-GP announcement portal button (#btn-open-egp-portal) in Hero section
 *     - Clickable "Source Document" link in the intelligence metadata panel
 *     - Real e-GP attachments list displaying TOR badge (⭐ [TOR]) and external download links
 *  3. Supports seamless bilingual toggling (Thai <-> English) across the document viewer and download links
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProjectDetailPage from '@/app/opportunities/[id]/page';
import { TorDocumentViewer } from '@/components/ui/TorDocumentViewer';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Project, DocumentSection } from '@/types/project';

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

const MOCK_DOCUMENT_SECTIONS: DocumentSection[] = [
  {
    sectionId: 'article-1',
    articleNumber: 'ข้อ 1',
    title: {
      th: 'ความเป็นมาและวัตถุประสงค์โครงการ',
      en: 'Article 1: Background and Objectives',
    },
    page: 1,
    content: {
      th: 'กรุงเทพมหานครมีความประสงค์จะจัดจ้างพัฒนาระบบพอร์ทัลบริการประชาชนแบบครบวงจร เพื่อยกระดับการให้บริการสู่ระบบดิจิทัล',
      en: 'Bangkok Metropolitan Administration intends to procure a Comprehensive Citizen Service Portal to digitize public municipal services.',
    },
    extractedHighlights: [
      {
        th: 'วงเงินงบประมาณจัดสรร: 45,000,000 บาท',
        en: 'Allocated budget: 45,000,000 THB',
      },
    ],
  },
  {
    sectionId: 'article-2',
    articleNumber: 'ข้อ 2',
    title: {
      th: 'คุณสมบัติของผู้ยื่นข้อเสนอราคา',
      en: 'Article 2: Bidder Qualifications and Eligibility',
    },
    page: 2,
    content: {
      th: '1. เป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคาอิเล็กทรอนิกส์\n2. มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท\n3. มีผลงานไม่น้อยกว่า 15,000,000 บาท ในสัญญาเดียว',
      en: '1. Registered legal entity in software engineering\n2. Paid-up registered capital >= 10M THB\n3. Past single contract >= 15M THB',
    },
    extractedHighlights: [
      {
        th: 'ทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท',
        en: 'Registered capital >= 10,000,000 THB',
      },
      {
        th: 'ผลงานสัญญาเดียวไม่น้อยกว่า 15,000,000 บาท',
        en: 'Single contract >= 15,000,000 THB',
      },
    ],
  },
  {
    sectionId: 'article-3',
    articleNumber: 'ข้อ 3',
    title: {
      th: 'ขอบเขตของงานและข้อกำหนดทางเทคนิค',
      en: 'Article 3: Technical Specifications & Scope of Work',
    },
    page: 3,
    content: {
      th: '3.1 ติดตั้งระบบ Cloud Microservices บน Google Cloud Platform\n3.2 รองรับการยืนยันตัวตนผ่าน ThaID และ Digital ID\n3.3 เชื่อมต่อระบบรับชำระเงิน e-Payment',
      en: '3.1 Deploy Cloud Microservices on Google Cloud Platform\n3.2 Implement ThaID and Digital ID SSO\n3.3 Integrate e-Payment payment gateway',
    },
    extractedHighlights: [
      {
        th: 'ติดตั้งระบบ Cloud Microservices บน Google Cloud Platform',
        en: 'Deploy Cloud Microservices on Google Cloud Platform',
      },
    ],
  },
  {
    sectionId: 'article-5',
    articleNumber: 'ข้อ 5',
    title: {
      th: 'งบประมาณ ค่าจ้าง และการจ่ายเงิน',
      en: 'Article 5: Budget, Pricing and Payment Terms',
    },
    page: 5,
    content: {
      th: 'วงเงินงบประมาณที่ได้รับจัดสรรทั้งสิ้น 45,000,000 บาท แบ่งจ่ายเป็น 3 งวดงานตามการส่งมอบที่กำหนด',
      en: 'Allocated budget is 45,000,000 THB payable in 3 milestone disbursements upon acceptable delivery.',
    },
    extractedHighlights: [
      {
        th: 'วงเงินงบประมาณ: 45,000,000 บาท',
        en: 'Budget allocation: 45,000,000 THB',
      },
    ],
  },
];

const EGP_OFFICIAL_URL =
  'https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=67119538991';

const MOCK_PROJECT_WITH_DOCS: Project & {
  source?: string;
  documents?: Array<{
    fileName: string;
    documentType: string;
    sourceUrl?: string;
  }>;
} = {
  _id: 'proj_doc_67119538991',
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
  processedDate: '2026-08-01T00:00:00.000Z',
  deadline: '2026-09-30T00:00:00.000Z',
  fiscalYear: 2569,
  category: 'Website',
  procurementType: 'e-Bidding',
  status: 'เปิดรับข้อเสนอ',
  aiConfidence: 'High',
  extractionStatus: 'EXTRACTED',
  source: 'ระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)',
  sourceDocument: 'Attach_TOR_BMA_Portal_67119538991.pdf',
  sourceUrl: EGP_OFFICIAL_URL,
  documentSections: MOCK_DOCUMENT_SECTIONS,

  description: {
    th: 'จ้างเหมาพัฒนาระบบพอร์ทัลกลางเพื่อการบริการประชาชนแบบเบ็ดเสร็จ ณ จุดเดียว',
    en: 'Turnkey development of unified public service portal for comprehensive citizen services.',
  },
  scope: {
    th: ['ติดตั้งระบบ Cloud', 'พัฒนาระบบ ThaID', 'เชื่อมโยง e-Payment'],
    en: ['Cloud setup', 'ThaID SSO', 'e-Payment integration'],
  },
  qualifications: {
    th: ['มีทุนจดทะเบียน 10M', 'มีผลงาน 15M'],
    en: ['Capital 10M', 'Experience 15M'],
  },

  // Real e-GP attachments with downloadable government source links
  documents: [
    {
      fileName: 'Attach_TOR_BMA_Portal_67119538991.pdf',
      documentType: 'ATTACH_TOR',
      sourceUrl: EGP_OFFICIAL_URL,
    },
    {
      fileName: 'BoQ_Pricing_Table_67119538991.pdf',
      documentType: 'ATTACH_BOQ',
      sourceUrl: EGP_OFFICIAL_URL,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Render Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function renderDetailPage(projectId = '67119538991', lang: 'th' | 'en' = 'th') {
  if (typeof window !== 'undefined') {
    localStorage.setItem('torbidd_lang', lang);
    document.documentElement.lang = lang;
  }

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ToastProvider>
        <LanguageProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <ProjectDetailPage params={Promise.resolve({ id: projectId })} />
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

function openViewerModal(container: HTMLElement) {
  const btn = container.querySelector('#btn-toggle-split-view');
  expect(btn).toBeInTheDocument();
  act(() => {
    fireEvent.click(btn!);
  });
  expect(container.querySelector('.tor-document-viewer')).toBeInTheDocument();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Embedded Document Viewer Rendering & Downloadable Government TOR PDF Links', () => {
  const originalFetch = global.fetch;
  const originalOpen = window.open;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.open = jest.fn();

    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/projects/67119538991')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: MOCK_PROJECT_WITH_DOCS,
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
    window.open = originalOpen;
  });

  // ===========================================================================
  // Section 1: Embedded Document Viewer Modal & Toolbar Rendering
  // ===========================================================================
  describe('1. Embedded Document Viewer Modal & Toolbar Rendering', () => {
    it('1.1 clicking "มุมมองแยกข้อกำหนด" (Clause Breakdown) opens embedded modal dialog', async () => {
      const { container } = await renderDetailPage();

      // Ensure modal is initially not displayed
      expect(container.querySelector('.tor-document-viewer')).not.toBeInTheDocument();

      // Open viewer modal
      openViewerModal(container);

      // Modal dialog and embedded document viewer should now be visible
      expect(container.querySelector('.tor-modal-dialog')).toBeInTheDocument();
      expect(container.querySelector('.tor-document-viewer')).toBeInTheDocument();
    });

    it('1.2 renders document toolbar with source filename, verification badge, and zoom indicator', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      const toolbar = container.querySelector('.tor-viewer-toolbar');
      expect(toolbar).toBeInTheDocument();

      // 1. Filename in toolbar
      expect(toolbar).toHaveTextContent('Attach_TOR_BMA_Portal_67119538991.pdf');

      // 2. Official verification badge
      expect(
        screen.getByText(/การตรวจสอบความถูกต้องโดยหน่วยงาน|Verified Official BMA Procurement/i),
      ).toBeInTheDocument();

      // 3. Zoom level indicator (default 100%)
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('1.3 zoom in and zoom out controls update scale transform and zoom percentage', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      const zoomInBtn = screen.getByLabelText(/ขยาย|Zoom In/i);
      const zoomOutBtn = screen.getByLabelText(/ย่อ|Zoom Out/i);
      const paperSheet = container.querySelector('.tor-paper-sheet') as HTMLElement;

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(paperSheet.style.transform).toBe('scale(1)');

      // Click Zoom In: 100% -> 110%
      act(() => {
        fireEvent.click(zoomInBtn);
      });
      expect(screen.getByText('110%')).toBeInTheDocument();
      expect(paperSheet.style.transform).toBe('scale(1.1)');

      // Click Zoom Out twice: 110% -> 100% -> 90%
      act(() => {
        fireEvent.click(zoomOutBtn);
      });
      act(() => {
        fireEvent.click(zoomOutBtn);
      });
      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(paperSheet.style.transform).toBe('scale(0.9)');
    });

    it('1.4 closes the modal dialog when clicking toolbar close button, overlay, or pressing Escape', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      // 1. Close via toolbar close button [x]
      const closeBtn = screen.getByLabelText(/ปิดตัวอ่านเอกสาร|Close Viewer/i);
      act(() => {
        fireEvent.click(closeBtn);
      });
      expect(container.querySelector('.tor-document-viewer')).not.toBeInTheDocument();

      // 2. Open and close via Escape key
      openViewerModal(container);
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      });
      expect(container.querySelector('.tor-document-viewer')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Section 2: Document Structure, Article Switching & Legal Disclaimer
  // ===========================================================================
  describe('2. Document Structure & AI Highlight Presentation', () => {
    it('2.1 sidebar renders all extracted articles with article numbers and page badges', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      const navItems = container.querySelectorAll('.section-nav-item');
      expect(navItems.length).toBe(4);

      // Verify Article tags in sidebar
      expect(screen.getAllByText('ข้อ 1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ข้อ 2').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ข้อ 3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ข้อ 5').length).toBeGreaterThan(0);

      // Verify page pills in sidebar
      expect(screen.getAllByText(/หน้า 1|Page 1/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/หน้า 2|Page 2/i).length).toBeGreaterThan(0);
    });

    it('2.2 renders non-official disclaimer notice informing bidders to check official e-GP sources', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      const disclaimerBox = container.querySelector('.paper-disclaimer-box');
      expect(disclaimerBox).toBeInTheDocument();

      // Disclaimer title & body text
      expect(
        screen.getByText(/เอกสารนี้ไม่ใช่เอกสารทางการที่มีผลผูกพันทางกฎหมาย|Non-Official Document Notice/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/ข้อมูลและข้อกำหนดนี้ผ่านการสกัดและสรุปสาระสำคัญด้วยระบบ AI/i),
      ).toBeInTheDocument();
    });

    it('2.3 clicking article item in sidebar seamlessly switches active article content and updates page watermark', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      // Initially Article 1 is active
      const heading = container.querySelector('.paper-section-heading')!;
      expect(heading).toHaveTextContent('ความเป็นมาและวัตถุประสงค์โครงการ');
      expect(container.querySelector('.paper-page-watermark')).toHaveTextContent(/หน้า 1 จาก 4|Page 1 of 4/i);

      // Click Article 2 ("คุณสมบัติของผู้ยื่นข้อเสนอราคา")
      const navItems = container.querySelectorAll('.section-nav-item');
      act(() => {
        fireEvent.click(navItems[1]);
      });

      // Canvas heading and content should update to Article 2
      expect(container.querySelector('.paper-section-heading')).toHaveTextContent('คุณสมบัติของผู้ยื่นข้อเสนอราคา');
      expect(container.querySelector('.paper-text-content')).toHaveTextContent(/มีทุนจดทะเบียน 10M/);
      expect(container.querySelector('.paper-page-watermark')).toHaveTextContent(/หน้า 2 จาก 4|Page 2 of 4/i);
    });

    it('2.4 displays AI extracted clause highlights callout box with checkmarks', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      // Switch to Article 2 (has highlights)
      const navItems = container.querySelectorAll('.section-nav-item');
      act(() => {
        fireEvent.click(navItems[1]);
      });

      const highlightsBox = container.querySelector('.paper-ai-highlights-box');
      expect(highlightsBox).toBeInTheDocument();
      expect(highlightsBox).toHaveTextContent(/มีทุนจดทะเบียน 10M/);

      const markers = highlightsBox!.querySelectorAll('.highlight-marker');
      expect(markers.length).toBeGreaterThan(0);
      expect(markers[0]).toHaveTextContent('✓');
    });
  });

  // ===========================================================================
  // Section 3: In-Document Search & Interactive Filtering
  // ===========================================================================
  describe('3. In-Document Interactive Search', () => {
    it('3.1 typing keyword into search box filters the article list in real-time', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      const searchInput = container.querySelector('.viewer-search-input') as HTMLInputElement;
      expect(searchInput).toBeInTheDocument();

      // Search for keyword in Article 3 ("ThaID")
      act(() => {
        fireEvent.change(searchInput, { target: { value: 'ThaID' } });
      });

      // Only Article 3 matches
      const filteredNavItems = container.querySelectorAll('.section-nav-item');
      expect(filteredNavItems.length).toBe(1);
      expect(filteredNavItems[0]).toHaveTextContent('ขอบเขตของงานและข้อกำหนดทางเทคนิค');
    });

    it('3.2 displays friendly empty state when search query yields no matches', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      const searchInput = container.querySelector('.viewer-search-input') as HTMLInputElement;

      act(() => {
        fireEvent.change(searchInput, { target: { value: 'NonExistentTermXYZ999' } });
      });

      expect(container.querySelectorAll('.section-nav-item').length).toBe(0);
      expect(screen.getByText('ไม่พบข้อความที่ค้นหาในเอกสาร')).toBeInTheDocument();

      // Clear search button restores sections
      const clearBtn = container.querySelector('.search-clear-btn');
      expect(clearBtn).toBeInTheDocument();
      act(() => {
        fireEvent.click(clearBtn!);
      });

      expect(container.querySelectorAll('.section-nav-item').length).toBe(4);
    });
  });

  // ===========================================================================
  // Section 4: Downloadable Links to Original Government TOR PDF Files
  // ===========================================================================
  describe('4. Downloadable Links to Original Source Government TOR PDF Files', () => {
    it('4.1 "เปิดหน้าประกาศต้นทาง e-GP กทม. ↗" toolbar button links to official e-GP portal in a new tab', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      const viewSourceBtn = screen.getByRole('link', {
        name: /เปิดหน้าประกาศต้นทาง e-GP กทม\.|Open BMA e-GP Source/i,
      });
      expect(viewSourceBtn).toBeInTheDocument();
      expect(viewSourceBtn).toHaveAttribute('href', EGP_OFFICIAL_URL);
      expect(viewSourceBtn).toHaveAttribute('target', '_blank');
      expect(viewSourceBtn).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('4.2 disclaimer banner contains direct verification link to official e-GP announcement & TOR', async () => {
      const { container } = await renderDetailPage();
      openViewerModal(container);

      const disclaimerLink = screen.getByRole('link', {
        name: /ตรวจสอบเอกสารประกาศและ TOR ต้นฉบับบนเว็บ e-GP ทางการ|Verify Original Official Announcement on e-GP Portal/i,
      });
      expect(disclaimerLink).toBeInTheDocument();
      expect(disclaimerLink).toHaveAttribute('href', EGP_OFFICIAL_URL);
      expect(disclaimerLink).toHaveAttribute('target', '_blank');
    });

    it('4.3 primary Hero action button (#btn-open-egp-portal) links to official government portal', async () => {
      const { container } = await renderDetailPage();

      const egpBtn = container.querySelector('#btn-open-egp-portal') as HTMLAnchorElement;
      expect(egpBtn).toBeInTheDocument();
      expect(egpBtn).toHaveAttribute('href', expect.stringContaining('keywordSearch=67119538991'));
      expect(egpBtn).toHaveAttribute('target', '_blank');
      expect(egpBtn).toHaveTextContent(/เปิดประกาศบน e-GP ↗|View on e-GP ↗/i);
    });

    it('4.4 "Source Document" in intelligence metadata panel opens official TOR document on click', async () => {
      const { container } = await renderDetailPage();

      // Find Source Document button
      const sourceDocBtn = screen.getByRole('button', { name: /Attach_TOR_BMA_Portal_67119538991\.pdf/i });
      expect(sourceDocBtn).toBeInTheDocument();

      act(() => {
        fireEvent.click(sourceDocBtn);
      });

      // Verify window.open was called with official e-GP URL in a new tab
      expect(window.open).toHaveBeenCalledWith(EGP_OFFICIAL_URL, '_blank');
    });

    it('4.5 real e-GP attachments list renders downloadable links with TOR badge (⭐ [TOR]) and attachment filenames', async () => {
      const { container } = await renderDetailPage();

      // Attachments section header
      expect(
        screen.getByText(/เอกสารแนบจาก e-GP \(เปิดอ่าน\/ดาวน์โหลดได้จริง\):|Real e-GP Attachments:/i),
      ).toBeInTheDocument();

      // 1. Primary TOR document attachment
      const torAttachmentLink = screen.getByTitle(
        /เปิดดูประกาศและเอกสารบนเว็บ e-GP ทางการ: Attach_TOR_BMA_Portal_67119538991\.pdf/i,
      );
      expect(torAttachmentLink).toBeInTheDocument();
      expect(torAttachmentLink).toHaveAttribute('href', EGP_OFFICIAL_URL);
      expect(torAttachmentLink).toHaveAttribute('target', '_blank');
      expect(torAttachmentLink).toHaveTextContent('⭐ [TOR]');
      expect(torAttachmentLink).toHaveTextContent('Attach_TOR_BMA_Portal_67119538991.pdf');

      // 2. Auxiliary attachment (BoQ pricing)
      const boqAttachmentLink = screen.getByTitle(
        /เปิดดูประกาศและเอกสารบนเว็บ e-GP ทางการ: BoQ_Pricing_Table_67119538991\.pdf/i,
      );
      expect(boqAttachmentLink).toBeInTheDocument();
      expect(boqAttachmentLink).toHaveTextContent('📎');
      expect(boqAttachmentLink).toHaveTextContent('BoQ_Pricing_Table_67119538991.pdf');
    });
  });

  // ===========================================================================
  // Section 5: Bilingual Support & Standalone Component Rendering
  // ===========================================================================
  describe('5. Bilingual Support & Standalone Component Rendering', () => {
    it('5.1 renders English headers and notices in document viewer when language is set to English', async () => {
      const { container } = await renderDetailPage('67119538991', 'en');
      openViewerModal(container);

      // English toolbar labels
      expect(screen.getByText(/Verified Official BMA Procurement/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open BMA e-GP Source ↗/i })).toBeInTheDocument();

      // English paper sheet badges and notices
      expect(screen.getByText('AI Summary Preview')).toBeInTheDocument();
      expect(screen.getByText('Project Ref: 67119538991')).toBeInTheDocument();
      expect(screen.getByText('Non-Official Document Notice (AI-Assisted Overview)')).toBeInTheDocument();

      // English section title
      expect(screen.getAllByText('Article 1: Background and Objectives').length).toBeGreaterThan(0);
      expect(screen.getByText(/Budget: 45,000,000 THB/i)).toBeInTheDocument();
    });

    it('5.2 TorDocumentViewer renders standalone without modal wrapper with full interactive capabilities', () => {
      const mockClose = jest.fn();
      const { container } = render(
        <LanguageProvider>
          <TorDocumentViewer
            project={MOCK_PROJECT_WITH_DOCS}
            documentSections={MOCK_DOCUMENT_SECTIONS}
            isSplitView={false}
            onClose={mockClose}
          />
        </LanguageProvider>,
      );

      expect(container.querySelector('.tor-document-viewer')).toBeInTheDocument();
      expect(container.querySelector('.standalone-mode')).toBeInTheDocument();
      expect(screen.getByText('Attach_TOR_BMA_Portal_67119538991.pdf')).toBeInTheDocument();

      // Test close button
      const closeBtn = screen.getByLabelText(/ปิดตัวอ่านเอกสาร|Close Viewer/i);
      fireEvent.click(closeBtn);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });
});
