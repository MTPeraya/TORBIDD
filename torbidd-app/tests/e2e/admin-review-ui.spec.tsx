/**
 * @jest-environment jsdom
 *
 * E2E UI: Admin Review Workflows — Classification Overrides & Manual TOR Text Corrections
 *
 * Verifies interactive admin UI workflows:
 *  1. ClassificationReviewPanel:
 *     - Fetches and renders AI classification review queue with status indicators and summary stats
 *     - Filters queue by review status (PENDING_REVIEW, APPROVED, CORRECTED, all)
 *     - Opens Review Modal to override software project classification to Non-Software (UC-10 / UC-4)
 *     - Opens Review Modal to override false-negative non-software to Software and update category
 *     - Dispatches PATCH /api/projects/:id/classification with review metadata and reviewer notes
 *  2. ProjectFormModal:
 *     - Populates existing AI-extracted TOR fields (Title, Scope of Work, Qualifications, Description, Budget)
 *     - Allows administrators to manually correct Scope of Work (itemized multiline clauses)
 *     - Allows administrators to manually correct Bidder Qualifications (itemized multiline criteria)
 *     - Allows administrators to override software / non-software project classification
 *     - Dispatches structured payload with parsed bilingual arrays to onSubmit handler
 *     - Enforces client-side validation against empty project titles and zero/negative budgets
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClassificationReviewPanel } from '@/components/admin/ClassificationReviewPanel';
import { ProjectFormModal } from '@/components/admin/ProjectFormModal';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Project } from '@/types/project';

// ─────────────────────────────────────────────────────────────────────────────
// Sample fixtures
// ─────────────────────────────────────────────────────────────────────────────

const mockQueueProjects = [
  {
    _id: 'proj_mock_001',
    externalId: 67119538991,
    title: {
      th: 'โครงการจ้างพัฒนาระบบเทคโนโลยีสารสนเทศเพื่อการจัดการเตียงผู้ป่วย',
      en: 'Patient Bed Management IT System Development Project',
    },
    department: {
      th: 'สำนักการแพทย์',
      en: 'Medical Services Department',
    },
    category: 'Information System' as const,
    isSoftwareRelated: true,
    aiConfidence: 'Medium' as const,
    classificationReviewStatus: 'PENDING_REVIEW' as const,
    publishDate: '2026-11-01T00:00:00Z',
  },
  {
    _id: 'proj_mock_002',
    externalId: 67119538992,
    title: {
      th: 'โครงการซื้ออุปกรณ์เซิร์ฟเวอร์และตู้ Rack',
      en: 'Server Hardware and Rack Cabinet Procurement Project',
    },
    department: {
      th: 'สำนักการระบายน้ำ',
      en: 'Drainage and Sewerage Department',
    },
    category: 'Cloud' as const,
    isSoftwareRelated: false,
    aiConfidence: 'Low' as const,
    classificationReviewStatus: 'PENDING_REVIEW' as const,
    publishDate: '2026-11-02T00:00:00Z',
  },
];

const mockSampleProject: Project = {
  _id: 'proj_ai_extracted_01',
  externalId: 67119538991,
  title: {
    th: 'โครงการจัดซื้อและพัฒนาระบบประมวลผลข้อมูลภาพถ่ายดาวเทียมเพื่อการผังเมือง',
    en: 'Satellite Image Processing System for Urban Planning Project',
  },
  department: {
    th: 'สำนักการวางผังและพัฒนาเมือง',
    en: 'Urban Planning and Development Department',
  },
  budget: 24000000,
  fiscalYear: 2568,
  publishDate: '2026-11-01',
  deadline: '2026-12-01',
  category: 'Data Analytics',
  procurementType: 'e-Bidding',
  description: {
    th: 'ระบบปัญญาประดิษฐ์และประมวลผลข้อมูลภาพดาวเทียมความละเอียดสูง',
    en: 'High-resolution satellite imagery AI and processing system',
  },
  scope: {
    th: [
      '1. ออกแบบและติดตั้งระบบนำเข้าข้อมูลภาพถ่ายดาวเทียม',
      '2. พัฒนาโมเดล AI จำแนกประเภทการใช้ประโยชน์ที่ดิน',
      '3. จัดทำเว็บพอร์ทัลแสดงผลแผนที่เชิงรุก',
    ],
    en: [
      '1. Design and deploy satellite image ingestion pipeline',
      '2. Develop AI land-use classification model',
      '3. Build proactive web GIS dashboard',
    ],
  },
  qualifications: {
    th: [
      '1. ผู้ยื่นข้อเสนอต้องเป็นนิติบุคคลจดทะเบียนในประเทศไทย',
      '2. มีผลงานการพัฒนาโมเดล AI ไม่น้อยกว่า 5,000,000 บาท',
    ],
    en: [
      '1. Must be a legally registered juristic person in Thailand',
      '2. Must have prior AI model development track record >= 5,000,000 THB',
    ],
  },
  aiConfidence: 'Medium',
  isSoftwareRelated: true,
  classificationReviewStatus: 'PENDING_REVIEW',
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Admin Review Workflows (UI Component End-to-End)
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E UI: Admin Review Workflows — Manual TOR Corrections & Classification Overrides', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // 1. ClassificationReviewPanel & ReviewModal Workflows
  // ===========================================================================
  describe('1. ClassificationReviewPanel & ReviewModal Workflows', () => {
    it('1.1 renders review queue and displays summary statistics and project items', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockQueueProjects,
          total: 2,
          totalPages: 1,
          summary: { pendingCount: 2, approvedCount: 5, correctedCount: 1 },
        }),
      } as Response);

      const onToast = jest.fn();
      render(
        <LanguageProvider>
          <ClassificationReviewPanel onToast={onToast} />
        </LanguageProvider>,
      );

      // Verify queue request was made with default filter
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/classification-queue?status=PENDING_REVIEW'),
        );
      });

      // Verify project items appear in the table
      expect(
        await screen.findByText(/โครงการจ้างพัฒนาระบบเทคโนโลยีสารสนเทศเพื่อการจัดการเตียงผู้ป่วย/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/โครงการซื้ออุปกรณ์เซิร์ฟเวอร์และตู้ Rack/),
      ).toBeInTheDocument();

      // Verify summary counters
      expect(screen.getByText('2')).toBeInTheDocument(); // pending count
      expect(screen.getByText('5')).toBeInTheDocument(); // approved count
      expect(screen.getByText('1')).toBeInTheDocument(); // corrected count
    });

    it('1.2 switches status filter and requests filtered classification queue', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          total: 0,
          totalPages: 1,
          summary: { pendingCount: 2, approvedCount: 5, correctedCount: 1 },
        }),
      } as Response);

      const onToast = jest.fn();
      render(
        <LanguageProvider>
          <ClassificationReviewPanel onToast={onToast} />
        </LanguageProvider>,
      );

      // Wait for initial fetch
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      // Click on Approved tab/button
      const approvedTab = screen.getByRole('button', { name: /อนุมัติแล้ว|approved/i });
      fireEvent.click(approvedTab);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/classification-queue?status=APPROVED'),
        );
      });
    });

    it('1.3 opens Review Modal, overrides software project to Non-Software (UC-10/UC-4) and dispatches PATCH', async () => {
      const fetchMock = jest.fn();
      // 1. Initial queue fetch
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [mockQueueProjects[0]],
          total: 1,
          totalPages: 1,
          summary: { pendingCount: 1, approvedCount: 0, correctedCount: 0 },
        }),
      } as Response);

      // 2. PATCH classification override
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      // 3. Queue refetch after save
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          total: 0,
          totalPages: 1,
          summary: { pendingCount: 0, approvedCount: 0, correctedCount: 1 },
        }),
      } as Response);

      global.fetch = fetchMock;
      const onToast = jest.fn();

      render(
        <LanguageProvider>
          <ClassificationReviewPanel onToast={onToast} />
        </LanguageProvider>,
      );

      // Wait for table to load and locate review button by ID
      const reviewBtn = await waitFor(() => {
        const btn = document.getElementById('reviewClassificationBtn_67119538991');
        expect(btn).not.toBeNull();
        return btn!;
      });
      fireEvent.click(reviewBtn);

      // Modal is now open
      expect(
        await screen.findByText(/Review Classification #67119538991/i),
      ).toBeInTheDocument();

      // Override to Non-Software using specific button ID
      const nonSoftwareBtn = document.getElementById('reviewIsSoftwareNo')!;
      fireEvent.click(nonSoftwareBtn);

      // Select CORRECTED status using button ID
      const correctStatusBtn = document.getElementById('reviewStatusCorrect')!;
      fireEvent.click(correctStatusBtn);

      // Enter review note using input ID
      const noteInput = document.getElementById('reviewNoteInput') as HTMLTextAreaElement;
      fireEvent.change(noteInput, {
        target: { value: 'โครงการนี้เป็นการจัดหาเครื่องมือแพทย์ ไม่ใช่ซอฟต์แวร์' },
      });

      // Submit review using button ID
      const saveBtn = document.getElementById('reviewSubmitBtn')!;
      fireEvent.click(saveBtn);

      // Verify PATCH was called with correct override data
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/projects/67119538991/classification',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: 'Information System',
              isSoftwareRelated: false,
              classificationReviewStatus: 'CORRECTED',
              classificationReviewNote: 'โครงการนี้เป็นการจัดหาเครื่องมือแพทย์ ไม่ใช่ซอฟต์แวร์',
            }),
          }),
        );
      });

      // Verify toast notification was triggered
      await waitFor(() => {
        expect(onToast).toHaveBeenCalledWith('Classification updated successfully');
      });
    });

    it('1.4 overrides false-negative non-software to Software, corrects category to AI, and approves', async () => {
      const fetchMock = jest.fn();
      // Initial queue fetch
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [mockQueueProjects[1]], // Non-software project
          total: 1,
          totalPages: 1,
          summary: { pendingCount: 1, approvedCount: 0, correctedCount: 0 },
        }),
      } as Response);

      // PATCH classification override
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      // Refetch
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          total: 0,
          totalPages: 1,
          summary: { pendingCount: 0, approvedCount: 1, correctedCount: 0 },
        }),
      } as Response);

      global.fetch = fetchMock;
      const onToast = jest.fn();

      render(
        <LanguageProvider>
          <ClassificationReviewPanel onToast={onToast} />
        </LanguageProvider>,
      );

      const reviewBtn = await waitFor(() => {
        const btn = document.getElementById('reviewClassificationBtn_67119538992');
        expect(btn).not.toBeNull();
        return btn!;
      });
      fireEvent.click(reviewBtn);

      await screen.findByText(/Review Classification #67119538992/i);

      // Click to override to Software
      const isSoftwareBtn = document.getElementById('reviewIsSoftwareYes')!;
      fireEvent.click(isSoftwareBtn);

      // Change category to AI
      const categorySelect = document.getElementById('reviewCategorySelect') as HTMLSelectElement;
      fireEvent.change(categorySelect, { target: { value: 'AI' } });

      // Keep status as APPROVED
      const approveBtn = document.getElementById('reviewStatusApprove')!;
      fireEvent.click(approveBtn);

      // Submit review
      const saveBtn = document.getElementById('reviewSubmitBtn')!;
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/projects/67119538992/classification',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({
              category: 'AI',
              isSoftwareRelated: true,
              classificationReviewStatus: 'APPROVED',
            }),
          }),
        );
      });
    });
  });

  // ===========================================================================
  // 2. ProjectFormModal Workflows (Manual TOR Text Corrections)
  // ===========================================================================
  describe('2. ProjectFormModal Workflows (Manual Corrections of AI-Extracted TOR Text Fields)', () => {
    it('2.1 pre-populates form with AI-extracted TOR text fields in edit mode', () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      render(
        <LanguageProvider>
          <ProjectFormModal
            isOpen={true}
            onClose={onClose}
            onSubmit={onSubmit}
            initialProject={mockSampleProject}
            mode="edit"
          />
        </LanguageProvider>,
      );

      // Title
      expect(
        screen.getByDisplayValue(
          'โครงการจัดซื้อและพัฒนาระบบประมวลผลข้อมูลภาพถ่ายดาวเทียมเพื่อการผังเมือง',
        ),
      ).toBeInTheDocument();

      // Budget
      expect(screen.getByDisplayValue('24000000')).toBeInTheDocument();

      // Scope of Work textarea
      const scopeTextarea = screen.getByPlaceholderText(/ออกแบบสถาปัตยกรรมระบบ/) as HTMLTextAreaElement;
      expect(scopeTextarea.value).toBe(mockSampleProject.scope!.th.join('\n'));

      // Qualifications textarea
      const qualTextarea = screen.getByPlaceholderText(/ทุนจดทะเบียนไม่น้อยกว่า/) as HTMLTextAreaElement;
      expect(qualTextarea.value).toBe(mockSampleProject.qualifications!.th.join('\n'));

      // Description
      expect(
        screen.getByDisplayValue(
          'ระบบปัญญาประดิษฐ์และประมวลผลข้อมูลภาพดาวเทียมความละเอียดสูง',
        ),
      ).toBeInTheDocument();

      // Software classification button is highlighted
      expect(
        screen.getByRole('button', { name: /ซอฟต์แวร์ \(software\)/i }),
      ).toBeInTheDocument();
    });

    it('2.2 allows manual corrections of Scope of Work, Qualifications, Title, Budget, and submits parsed bilingual arrays', async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn().mockResolvedValue(undefined);

      render(
        <LanguageProvider>
          <ProjectFormModal
            isOpen={true}
            onClose={onClose}
            onSubmit={onSubmit}
            initialProject={mockSampleProject}
            mode="edit"
          />
        </LanguageProvider>,
      );

      // 1. Manually correct Title
      const titleInput = screen.getByDisplayValue(
        'โครงการจัดซื้อและพัฒนาระบบประมวลผลข้อมูลภาพถ่ายดาวเทียมเพื่อการผังเมือง',
      );
      fireEvent.change(titleInput, {
        target: {
          value: 'โครงการพัฒนาระบบ AI วิเคราะห์ภาพถ่ายดาวเทียมและข้อมูลภูมิสารสนเทศ (ฉบับแก้ไข)',
        },
      });

      // 2. Manually correct Scope of Work with new itemized requirements
      const scopeTextarea = screen.getByPlaceholderText(/ออกแบบสถาปัตยกรรมระบบ/) as HTMLTextAreaElement;
      const correctedScope = [
        '1. จัดหาภาพถ่ายดาวเทียมความละเอียด 30 ซม. ย้อนหลัง 3 ปี',
        '2. ฝึกสอนโมเดล Deep Learning สำหรับตรวจจับสิ่งปลูกสร้างรุกล้ำลำน้ำ',
        '3. พัฒนา API เชื่อมต่อกับระบบ e-BMA Map ภายใน 180 วัน',
        '4. จัดการฝึกอบรมบุคลากรสำนักการวางผังเมืองจำนวน 50 ท่าน',
      ].join('\n');
      fireEvent.change(scopeTextarea, { target: { value: correctedScope } });

      // 3. Manually correct Bidder Qualifications
      const qualTextarea = screen.getByPlaceholderText(/ทุนจดทะเบียนไม่น้อยกว่า/) as HTMLTextAreaElement;
      const correctedQual = [
        '1. นิติบุคคลจดทะเบียนในไทย มีทุนชำระแล้วไม่น้อยกว่า 10,000,000 บาท',
        '2. มีผลงานระบบสารสนเทศภูมิศาสตร์ (GIS) มูลค่าสัญญาเดี่ยวไม่น้อยกว่า 8,000,000 บาท',
        '3. ได้รับการรับรองมาตรฐาน ISO 29110 หรือ CMMI Level 3 ขึ้นไป',
      ].join('\n');
      fireEvent.change(qualTextarea, { target: { value: correctedQual } });

      // 4. Manually adjust budget to 26,500,000 THB
      const budgetInput = screen.getByDisplayValue('24000000');
      fireEvent.change(budgetInput, { target: { value: '26500000' } });

      // 5. Submit the form
      const submitBtn = document.getElementById('adminSaveProjectBtn')!;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = onSubmit.mock.calls[0][0];

      // Verify Scope was parsed into a clean array of strings
      expect(submittedData.scope.th).toEqual([
        '1. จัดหาภาพถ่ายดาวเทียมความละเอียด 30 ซม. ย้อนหลัง 3 ปี',
        '2. ฝึกสอนโมเดล Deep Learning สำหรับตรวจจับสิ่งปลูกสร้างรุกล้ำลำน้ำ',
        '3. พัฒนา API เชื่อมต่อกับระบบ e-BMA Map ภายใน 180 วัน',
        '4. จัดการฝึกอบรมบุคลากรสำนักการวางผังเมืองจำนวน 50 ท่าน',
      ]);

      // Verify Qualifications was parsed into a clean array of strings
      expect(submittedData.qualifications.th).toEqual([
        '1. นิติบุคคลจดทะเบียนในไทย มีทุนชำระแล้วไม่น้อยกว่า 10,000,000 บาท',
        '2. มีผลงานระบบสารสนเทศภูมิศาสตร์ (GIS) มูลค่าสัญญาเดี่ยวไม่น้อยกว่า 8,000,000 บาท',
        '3. ได้รับการรับรองมาตรฐาน ISO 29110 หรือ CMMI Level 3 ขึ้นไป',
      ]);

      // Verify Title, Budget, and externalId
      expect(submittedData.title.th).toBe(
        'โครงการพัฒนาระบบ AI วิเคราะห์ภาพถ่ายดาวเทียมและข้อมูลภูมิสารสนเทศ (ฉบับแก้ไข)',
      );
      expect(submittedData.budget).toBe(26500000);
      expect(submittedData.externalId).toBe(67119538991);
      expect(submittedData.isSoftwareRelated).toBe(true);

      // Verify modal closes upon successful submission
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('2.3 allows overriding software classification to Non-Software within ProjectFormModal', async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn().mockResolvedValue(undefined);

      render(
        <LanguageProvider>
          <ProjectFormModal
            isOpen={true}
            onClose={onClose}
            onSubmit={onSubmit}
            initialProject={mockSampleProject}
            mode="edit"
          />
        </LanguageProvider>,
      );

      // Click Non-Software button using ID
      const nonSoftwareBtn = document.getElementById('projectFormIsSoftwareNo')!;
      fireEvent.click(nonSoftwareBtn);

      // Checkbox for retention policy deletion option appears
      expect(
        screen.getByText(/ลบ\/ตัดรายการนี้ออกจากฐานข้อมูลอย่างถาวรทันที/i),
      ).toBeInTheDocument();

      // Submit
      const submitBtn = document.getElementById('adminSaveProjectBtn')!;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            isSoftwareRelated: false,
            deleteOnConfirmNonSoftware: false,
          }),
        );
      });
    });

    it('2.4 blocks submission and displays error when project title is empty', async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      render(
        <LanguageProvider>
          <ProjectFormModal
            isOpen={true}
            onClose={onClose}
            onSubmit={onSubmit}
            initialProject={mockSampleProject}
            mode="edit"
          />
        </LanguageProvider>,
      );

      // Clear title
      const titleInput = screen.getByDisplayValue(
        'โครงการจัดซื้อและพัฒนาระบบประมวลผลข้อมูลภาพถ่ายดาวเทียมเพื่อการผังเมือง',
      );
      fireEvent.change(titleInput, { target: { value: '   ' } });

      // Click submit
      const submitBtn = document.getElementById('adminSaveProjectBtn')!;
      fireEvent.click(submitBtn);

      // Validation error displayed, onSubmit NOT called
      expect(await screen.findByText('กรุณาระบุชื่อโครงการ')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('2.5 blocks submission and displays error when budget is zero or negative', async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      render(
        <LanguageProvider>
          <ProjectFormModal
            isOpen={true}
            onClose={onClose}
            onSubmit={onSubmit}
            initialProject={mockSampleProject}
            mode="edit"
          />
        </LanguageProvider>,
      );

      // Set budget to 0
      const budgetInput = screen.getByDisplayValue('24000000');
      fireEvent.change(budgetInput, { target: { value: '0' } });

      // Click submit
      const submitBtn = document.getElementById('adminSaveProjectBtn')!;
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText('กรุณาระบุงบประมาณที่มากกว่า 0'),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
