import { enrichProjectDetail } from '@/lib/projectDetailHelper';
import { Project } from '@/types/project';

describe('Procurement Detail Viewer Helper (enrichProjectDetail)', () => {
  const sampleProject: Project = {
    externalId: 99,
    title: {
      th: 'โครงการจัดซื้อระบบปัญญาประดิษฐ์เพื่อบริหารจัดการเมือง',
      en: 'AI Urban Management System Procurement Project',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Dept.',
    },
    budget: 20_000_000,
    publishDate: '2026-08-01',
    deadline: '2026-08-30',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการพัฒนาระบบ AI เพื่อการบริหารจัดการเมืองอัจฉริยะ',
      en: 'Development of AI system for smart city administration',
    },
    scope: {
      th: ['พัฒนาโมเดล AI', 'เชื่อมโยงข้อมูลกับเซนเซอร์ IoT', 'จัดทำระบบแดชบอร์ด'],
      en: ['Develop AI models', 'Integrate IoT sensor data', 'Build executive dashboard'],
    },
    qualifications: {
      th: [
        'ทุนจดทะเบียนไม่น้อยกว่า 5,000,000 บาท',
        'มีผลงานประเภทระบบสารสนเทศไม่น้อยกว่า 10,000,000 บาท',
        'ได้รับมาตรฐาน ISO 27001 หรือ CMMI Level 3',
      ],
      en: [
        'Registered capital of at least 5,000,000 THB',
        'Completed IT contract of at least 10,000,000 THB',
        'ISO 27001 or CMMI Level 3 certification',
      ],
    },
    historicalAvg: 18_000_000,
    sourceDocument: 'TOR_BMA_AI_Project.pdf',
    processedDate: '2026-08-02',
    aiConfidence: 'High',
  };

  it('should enrich a project with complete timeline milestones', () => {
    const enriched = enrichProjectDetail(sampleProject);
    expect(enriched.timeline).toBeDefined();
    expect(enriched.timeline?.length).toBe(4);

    const step1 = enriched.timeline?.[0];
    expect(step1?.status).toBe('completed');
    expect(step1?.date).toBe('2026-08-01');

    const step3 = enriched.timeline?.[2];
    expect(step3?.date).toBe('2026-08-30');
  });

  it('should generate budget breakdown matching 100% of the total budget', () => {
    const enriched = enrichProjectDetail(sampleProject);
    expect(enriched.budgetBreakdown).toBeDefined();
    expect(enriched.budgetBreakdown?.length).toBe(4);

    const totalPercentage = enriched.budgetBreakdown?.reduce((sum, item) => sum + item.percentage, 0);
    expect(totalPercentage).toBe(100);

    const totalAmount = enriched.budgetBreakdown?.reduce((sum, item) => sum + item.amount, 0);
    expect(totalAmount).toBe(sampleProject.budget);
  });

  it('should generate critical mandatory qualification flags', () => {
    const enriched = enrichProjectDetail(sampleProject);
    expect(enriched.highlightedQualifications).toBeDefined();
    expect(enriched.highlightedQualifications?.length).toBeGreaterThanOrEqual(2);

    const criticalItems = enriched.highlightedQualifications?.filter((q) => q.type === 'critical');
    expect(criticalItems?.length).toBeGreaterThanOrEqual(2);
    expect(criticalItems?.[0].description.th).toContain('ทุนจดทะเบียน');
  });

  it('should generate authentic document sections for TOR Document Viewer', () => {
    const enriched = enrichProjectDetail(sampleProject);
    expect(enriched.documentSections).toBeDefined();
    expect(enriched.documentSections?.length).toBe(5);

    // Article 1
    const art1 = enriched.documentSections?.[0];
    expect(art1?.articleNumber).toBe('ข้อ 1');
    expect(art1?.page).toBe(1);

    // Article 3 with scope highlights
    const art3 = enriched.documentSections?.[2];
    expect(art3?.articleNumber).toBe('ข้อ 3');
    expect(art3?.extractedHighlights?.length).toBeGreaterThan(0);
  });

  it('should attach AI transparency metadata and responsible contacts', () => {
    const enriched = enrichProjectDetail(sampleProject);
    expect(enriched.aiMetadata).toBeDefined();
    expect(enriched.aiMetadata?.confidenceScore).toBe(97);
    expect(enriched.aiMetadata?.verifiedByHuman).toBe(true);

    expect(enriched.contactInfo).toBeDefined();
    expect(enriched.contactInfo?.email).toBe('procurement.it@bangkok.go.th');
    expect(enriched.sourceUrl).toContain('https://egp.bangkok.go.th');
  });

  it('should not overwrite existing enriched data if already present', () => {
    const customProject: Project = {
      ...sampleProject,
      timeline: [
        {
          id: 'custom-1',
          event: { th: 'กำหนดการพิเศษ', en: 'Custom Milestone' },
          date: '2026-09-01',
          status: 'upcoming',
        },
      ],
      documentSections: [
        {
          sectionId: 'custom-sec',
          title: { th: 'หมวดพิเศษ', en: 'Custom Section' },
          page: 1,
          content: { th: 'เนื้อหา', en: 'Content' },
        },
      ],
      budgetBreakdown: [
        {
          category: { th: 'งบพิเศษ', en: 'Special Budget' },
          amount: 20_000_000,
          percentage: 100,
        },
      ],
    };

    const result = enrichProjectDetail(customProject);
    expect(result.timeline?.length).toBe(1);
    expect(result.timeline?.[0].id).toBe('custom-1');
  });
});
