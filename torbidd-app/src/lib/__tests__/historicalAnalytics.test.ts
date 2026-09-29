import {
  calculateCategoryStats,
  evaluateBudgetReasonableness,
  findSimilarHistoricalProcurements,
  estimateScopePrice,
  aggregateAgencyMetrics,
} from '../historicalAnalytics';
import { HistoricalProject } from '@/types/historical';
import { Project } from '@/types/project';

const MOCK_DATA: HistoricalProject[] = [
  {
    title: { th: 'โครงการระบบ ก', en: 'Project A' },
    department: { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic and Transportation Department' },
    year: 2024,
    category: 'Website',
    budget: 10_000_000,
    scope: { th: ['พัฒนาเว็บพอร์ทัล', 'จัดทำ CMS'], en: ['Web portal', 'CMS'] },
  },
  {
    title: { th: 'โครงการระบบ ข', en: 'Project B' },
    department: { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic and Transportation Department' },
    year: 2024,
    category: 'Website',
    budget: 12_000_000,
    scope: { th: ['พัฒนาเว็บพอร์ทัล', 'API Gateway'], en: ['Web portal', 'API Gateway'] },
  },
  {
    title: { th: 'โครงการระบบ ค', en: 'Project C' },
    department: { th: 'สำนักการศึกษา', en: 'Department of Education' },
    year: 2025,
    category: 'Website',
    budget: 14_000_000,
    scope: { th: ['ระบบลงทะเบียนเรียน'], en: ['Student registration'] },
  },
  {
    title: { th: 'โครงการระบบ ง', en: 'Project D (Outlier)' },
    department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy and Evaluation Department' },
    year: 2025,
    category: 'Website',
    budget: 35_000_000, // high outlier
    scope: { th: ['ระบบบูรณาการระดับชาติ'], en: ['National scale integration'] },
  },
  {
    title: { th: 'โครงการ AI จ', en: 'Project AI' },
    department: { th: 'สำนักสิ่งแวดล้อม', en: 'Department of Environment' },
    year: 2025,
    category: 'AI',
    budget: 20_000_000,
    scope: { th: ['โมเดล AI ภาพถ่าย'], en: ['Vision AI Model'] },
  },
];

describe('lib/historicalAnalytics.ts', () => {
  describe('calculateCategoryStats', () => {
    it('calculates min, max, mean, median and quartiles accurately for Website category', () => {
      const stats = calculateCategoryStats('Website', MOCK_DATA);
      expect(stats.sampleCount).toBe(4);
      expect(stats.min).toBe(10_000_000);
      expect(stats.max).toBe(35_000_000);
      expect(stats.mean).toBe((10 + 12 + 14 + 35) * 1_000_000 / 4);
      // For [10M, 12M, 14M, 35M], median is 13M
      expect(stats.median).toBe(13_000_000);
      expect(stats.q1).toBeLessThan(stats.median);
      expect(stats.q3).toBeGreaterThan(stats.median);
      expect(stats.iqr).toBeGreaterThan(0);
      expect(stats.stdDev).toBeGreaterThan(0);
    });

    it('handles empty category gracefully', () => {
      const stats = calculateCategoryStats('Database', MOCK_DATA);
      expect(stats.sampleCount).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.stdDev).toBe(0);
    });

    it('calculates stats for "All" categories', () => {
      const stats = calculateCategoryStats('All', MOCK_DATA);
      expect(stats.sampleCount).toBe(5);
    });
  });

  describe('evaluateBudgetReasonableness', () => {
    it('detects normal/reasonable budget within expected range', () => {
      // Median is 13M, budget 13.5M is very close to median
      const result = evaluateBudgetReasonableness(13_500_000, 'Website', MOCK_DATA);
      expect(result.status).toBe('reasonable');
      expect(result.ratioVsMedian).toBeCloseTo(13.5 / 13, 2);
      expect(result.reasoning.th).toContain('สมเหตุสมผล');
      expect(result.reasoning.en).toContain('comfortably within historical benchmarks');
    });

    it('detects high outlier when budget substantially exceeds median/IQR', () => {
      const result = evaluateBudgetReasonableness(45_000_000, 'Website', MOCK_DATA);
      expect(result.status).toBe('high_outlier');
      expect(result.variancePercentage).toBeGreaterThan(50);
      expect(result.reasoning.th).toContain('High Outlier');
      expect(result.reasoning.en).toContain('High Outlier');
    });

    it('detects low outlier when budget is under typical range', () => {
      const result = evaluateBudgetReasonableness(3_000_000, 'Website', MOCK_DATA);
      expect(result.status).toBe('low_outlier');
      expect(result.variancePercentage).toBeLessThan(-50);
      expect(result.reasoning.th).toContain('Low Outlier');
      expect(result.reasoning.en).toContain('Low Outlier');
    });

    it('provides recommended budget range based on quartiles', () => {
      const result = evaluateBudgetReasonableness(15_000_000, 'Website', MOCK_DATA);
      expect(result.recommendedBudgetRange.min).toBeLessThan(result.recommendedBudgetRange.max);
    });
  });

  describe('findSimilarHistoricalProcurements', () => {
    it('ranks projects with matching category and keywords higher', () => {
      const similar = findSimilarHistoricalProcurements(
        {
          title: 'โครงการพัฒนาเว็บพอร์ทัล กทม.',
          category: 'Website',
          budget: 11_000_000,
          description: 'จัดทำ CMS และ Portal',
        },
        MOCK_DATA,
        3,
      );

      expect(similar.length).toBeLessThanOrEqual(3);
      expect(similar[0].similarityScore).toBeGreaterThan(similar[similar.length - 1].similarityScore);
      expect(similar[0].project.category).toBe('Website');
    });
  });

  describe('estimateScopePrice', () => {
    it('estimates scope price bounds and breaks down work packages', () => {
      const similar = findSimilarHistoricalProcurements(
        { category: 'Website', budget: 12_000_000 },
        MOCK_DATA,
      );
      const estimation = estimateScopePrice(similar, 12_000_000);

      expect(estimation.estimatedTotalMin).toBeGreaterThan(0);
      expect(estimation.estimatedTotalMax).toBeGreaterThanOrEqual(estimation.estimatedTotalMin);
      expect(estimation.workPackages.length).toBe(4);

      const totalPercentage = estimation.workPackages.reduce((sum, wp) => sum + wp.percentage, 0);
      expect(totalPercentage).toBe(100);
    });
  });

  describe('aggregateAgencyMetrics', () => {
    it('aggregates procurement values across departments', () => {
      const metrics = aggregateAgencyMetrics(MOCK_DATA);
      expect(metrics.length).toBe(4); // 4 unique departments in mock data

      // First agency should be the one with highest total spend
      expect(metrics[0].totalBudget).toBeGreaterThanOrEqual(metrics[1].totalBudget);
      expect(metrics[0].projectCount).toBeGreaterThan(0);
      expect(metrics[0].avgBudget).toBeGreaterThan(0);
      expect(metrics[0].primaryCategory).toBeDefined();
      expect(metrics[0].topProject.budget).toBeGreaterThan(0);
    });

    it('combines historical and active projects when provided', () => {
      const activeMock: Project[] = [
        {
          externalId: 99,
          title: { th: 'ระบบใหม่', en: 'New System' },
          department: { th: 'สำนักการศึกษา', en: 'Department of Education' },
          budget: 20_000_000,
          publishDate: '2026-08-01',
          deadline: '2026-08-30',
          category: 'Website',
          procurementType: 'e-Bidding',
          description: { th: '', en: '' },
          scope: { th: [], en: [] },
          qualifications: { th: [], en: [] },
          historicalAvg: 15000000,
          sourceDocument: '',
          processedDate: '2026-08-01',
          aiConfidence: 'High',
        },
      ];

      const metrics = aggregateAgencyMetrics(MOCK_DATA, activeMock);
      const eduAgency = metrics.find((m) => m.department.th === 'สำนักการศึกษา');
      expect(eduAgency).toBeDefined();
      expect(eduAgency?.projectCount).toBe(2); // 1 historical + 1 active
      expect(eduAgency?.totalBudget).toBe(14_000_000 + 20_000_000);
    });
  });
});
