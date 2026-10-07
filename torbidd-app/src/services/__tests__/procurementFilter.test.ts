// =============================================================================
// services/__tests__/procurementFilter.test.ts
// Unit Tests for Issues #147, #149, #150, #154, #155
// =============================================================================

import {
  filterByCategory,
  filterByAgency,
  filterByBudget,
  filterBySearch,
  filterByDeadline,
  isContractAwarded,
  applyProcurementFilters,
} from '../procurement-filter';
import {
  sortProcurements,
  paginateProcurements,
  executeProcurementSearch,
} from '../procurement-search';
import { Project } from '@/types/project';

const MOCK_PROJECTS: Project[] = [
  {
    externalId: 101,
    title: { th: 'ระบบพอร์ทัลบริการประชาชน', en: 'Citizen Portal System' },
    department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy and Evaluation Dept.' },
    budget: 50000000,
    publishDate: '2026-08-01',
    deadline: '2026-08-30',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: { th: 'รายละเอียดระบบพอร์ทัล', en: 'Portal details' },
    scope: { th: ['scope 1'], en: ['scope 1'] },
    qualifications: { th: ['qual 1'], en: ['qual 1'] },
    historicalAvg: 48000000,
    sourceDocument: 'doc1.pdf',
    processedDate: '2026-08-01',
    aiConfidence: 'High',
  },
  {
    externalId: 102,
    title: { th: 'แอปพลิเคชันมือถือตรวจวัดน้ำท่วม', en: 'Flood Monitoring Mobile App' },
    department: { th: 'สำนักการระบายน้ำ', en: 'Drainage and Sewerage Dept.' },
    budget: 8000000,
    publishDate: '2026-08-10',
    deadline: '2026-09-10',
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    description: { th: 'แอปพลิเคชันตรวจวัดน้ำ', en: 'Flood app description' },
    scope: { th: ['scope 2'], en: ['scope 2'] },
    qualifications: { th: ['qual 2'], en: ['qual 2'] },
    historicalAvg: 7500000,
    sourceDocument: 'doc2.pdf',
    processedDate: '2026-08-10',
    aiConfidence: 'High',
  },
  {
    externalId: 103,
    title: { th: 'ระบบ AI วิเคราะห์จราจรอัจฉริยะ', en: 'AI Smart Traffic Analytics' },
    department: { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic and Transport Dept.' },
    budget: 15000000,
    publishDate: '2026-08-15',
    deadline: '2026-09-15',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: { th: 'ระบบกล้อง AI และคอมพิวเตอร์วิทัศน์', en: 'AI camera system' },
    scope: { th: ['scope 3'], en: ['scope 3'] },
    qualifications: { th: ['qual 3'], en: ['qual 3'] },
    historicalAvg: 14500000,
    sourceDocument: 'doc3.pdf',
    processedDate: '2026-08-15',
    aiConfidence: 'High',
  },
  {
    externalId: 104,
    title: { th: 'คลังข้อมูลขนาดใหญ่ Big Data กทม.', en: 'BMA Enterprise Big Data Warehouse' },
    department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy and Evaluation Dept.' },
    budget: 25000000,
    publishDate: '2026-08-20',
    deadline: '2026-09-20',
    category: 'Database',
    procurementType: 'e-Bidding',
    description: { th: 'ระบบคลังข้อมูล Data Lakehouse', en: 'Data Lakehouse platform' },
    scope: { th: ['scope 4'], en: ['scope 4'] },
    qualifications: { th: ['qual 4'], en: ['qual 4'] },
    historicalAvg: 24000000,
    sourceDocument: 'doc4.pdf',
    processedDate: '2026-08-20',
    aiConfidence: 'High',
  },
  {
    externalId: 105,
    title: { th: 'ระบบจัดตารางสอนโรงเรียน กทม.', en: 'BMA School Scheduling System' },
    department: { th: 'สำนักการศึกษา', en: 'Education Dept.' },
    budget: 3500000,
    publishDate: '2026-08-20', // Same publishDate as 104 to test deterministic secondary sort
    deadline: '2026-09-05',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: { th: 'ระบบเว็บสำหรับโรงเรียน', en: 'School web system' },
    scope: { th: ['scope 5'], en: ['scope 5'] },
    qualifications: { th: ['qual 5'], en: ['qual 5'] },
    historicalAvg: 3300000,
    sourceDocument: 'doc5.pdf',
    processedDate: '2026-08-20',
    aiConfidence: 'Medium',
  },
];

describe('Procurement Filtering & Search Services', () => {
  // ─── Issue #147: Software Category Filter ─────────────────────────────────
  describe('Issue #147: Software Category Filter (filterByCategory)', () => {
    it('returns all procurements when no categories or empty array provided', () => {
      expect(filterByCategory(MOCK_PROJECTS)).toHaveLength(MOCK_PROJECTS.length);
      expect(filterByCategory(MOCK_PROJECTS, [])).toHaveLength(MOCK_PROJECTS.length);
    });

    it('filters correctly for a single category', () => {
      const websites = filterByCategory(MOCK_PROJECTS, ['Website']);
      expect(websites).toHaveLength(2);
      expect(websites.every((p) => p.category === 'Website')).toBe(true);

      const aiOnly = filterByCategory(MOCK_PROJECTS, ['AI']);
      expect(aiOnly).toHaveLength(1);
      expect(aiOnly[0].externalId).toBe(103);
    });

    it('filters correctly for multiple categories simultaneously', () => {
      const multi = filterByCategory(MOCK_PROJECTS, ['Website', 'AI']);
      expect(multi).toHaveLength(3);
      expect(multi.map((p) => p.externalId).sort()).toEqual([101, 103, 105]);
    });

    it('is case-insensitive and trims whitespace', () => {
      const result = filterByCategory(MOCK_PROJECTS, ['  mobile app  ']);
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe(102);
    });

    it('returns empty array when no projects match the selected category', () => {
      const nonExistent = filterByCategory(MOCK_PROJECTS, ['Hardware']);
      expect(nonExistent).toHaveLength(0);
    });

    it('filterBySearch matches keywords against title and description', () => {
      const results = filterBySearch(MOCK_PROJECTS, 'จราจร');
      expect(results).toHaveLength(1);
      expect(results[0].externalId).toBe(103);
    });
  });

  // ─── Issue #149: Government Agency Filter ─────────────────────────────────
  describe('Issue #149: Government Agency Filter (filterByAgency)', () => {
    it('returns all procurements when no agency is selected', () => {
      expect(filterByAgency(MOCK_PROJECTS)).toHaveLength(MOCK_PROJECTS.length);
      expect(filterByAgency(MOCK_PROJECTS, [])).toHaveLength(MOCK_PROJECTS.length);
    });

    it('filters by Thai department name', () => {
      const result = filterByAgency(MOCK_PROJECTS, ['สำนักการศึกษา']);
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe(105);
    });

    it('filters by English department name', () => {
      const result = filterByAgency(MOCK_PROJECTS, ['Strategy and Evaluation Dept.']);
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.externalId)).toContain(101);
      expect(result.map((p) => p.externalId)).toContain(104);
    });

    it('filters by agency reference ID (e.g. dept-traffic)', () => {
      const result = filterByAgency(MOCK_PROJECTS, ['dept-traffic']);
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe(103);
    });

    it('supports multiple agency selection', () => {
      const multi = filterByAgency(MOCK_PROJECTS, ['สำนักการศึกษา', 'dept-traffic']);
      expect(multi).toHaveLength(2);
      expect(multi.map((p) => p.externalId).sort()).toEqual([103, 105]);
    });
  });

  // ─── Issue #150: Budget Filter ─────────────────────────────────────────────
  describe('Issue #150: Budget Filter (filterByBudget)', () => {
    it('filters by minimum budget', () => {
      const result = filterByBudget(MOCK_PROJECTS, { minBudget: 20000000 });
      expect(result).toHaveLength(2); // 50M and 25M
      expect(result.every((p) => p.budget >= 20000000)).toBe(true);
    });

    it('filters by maximum budget', () => {
      const result = filterByBudget(MOCK_PROJECTS, { maxBudget: 10000000 });
      expect(result).toHaveLength(2); // 8M and 3.5M
      expect(result.every((p) => p.budget <= 10000000)).toBe(true);
    });

    it('filters by min and max range together', () => {
      const result = filterByBudget(MOCK_PROJECTS, {
        minBudget: 5000000,
        maxBudget: 20000000,
      });
      expect(result).toHaveLength(2); // 8M and 15M
      expect(result.map((p) => p.externalId).sort()).toEqual([102, 103]);
    });

    it('filters by budget preset (e.g., under5m, 5to10, 10to20, above20m)', () => {
      const under5m = filterByBudget(MOCK_PROJECTS, { budgetPreset: 'under5m' });
      expect(under5m).toHaveLength(1);
      expect(under5m[0].externalId).toBe(105);

      const above20m = filterByBudget(MOCK_PROJECTS, { budgetPreset: 'above20m' });
      expect(above20m).toHaveLength(2);
      expect(above20m.map((p) => p.externalId).sort()).toEqual([101, 104]);
    });

    it('handles projects with missing, zero, or null budget gracefully without error', () => {
      const edgeCaseProjects: Project[] = [
        ...MOCK_PROJECTS,
        {
          ...MOCK_PROJECTS[0],
          externalId: 999,
          budget: undefined as unknown as number,
        },
      ];

      expect(() => {
        const res = filterByBudget(edgeCaseProjects, { minBudget: 1000000 });
        expect(res).not.toContainEqual(expect.objectContaining({ externalId: 999 }));
      }).not.toThrow();
    });

    it('paginateProcurements slices items and calculates totalPages', () => {
      const paginated = paginateProcurements(MOCK_PROJECTS, 1, 2);
      expect(paginated.items).toHaveLength(2);
      expect(paginated.totalPages).toBe(3);
      expect(paginated.total).toBe(5);
    });
  });

  // ─── Issue #154: Publication Date Sorting ──────────────────────────────────
  describe('Issue #154: Publication Date Sorting (sortProcurements)', () => {
    it('sorts by newest publication date first by default (publishDate_desc)', () => {
      const sorted = sortProcurements(MOCK_PROJECTS, 'publishDate_desc');
      // The newest dates are 2026-08-20 (projects 105 and 104)
      expect(sorted[0].publishDate).toBe('2026-08-20');
      expect(sorted[1].publishDate).toBe('2026-08-20');
      // Oldest is 2026-08-01 (project 101)
      expect(sorted[sorted.length - 1].externalId).toBe(101);
    });

    it('sorts by oldest publication date first (publishDate_asc)', () => {
      const sorted = sortProcurements(MOCK_PROJECTS, 'publishDate_asc');
      expect(sorted[0].externalId).toBe(101);
      expect(sorted[0].publishDate).toBe('2026-08-01');
      expect(sorted[sorted.length - 1].publishDate).toBe('2026-08-20');
    });

    it('guarantees deterministic and stable sorting using secondary externalId key when publishDates are identical', () => {
      // Projects 104 and 105 both have publishDate = '2026-08-20'
      const desc = sortProcurements(MOCK_PROJECTS, 'publishDate_desc');
      const idx105Desc = desc.findIndex((p) => p.externalId === 105);
      const idx104Desc = desc.findIndex((p) => p.externalId === 104);
      expect(idx105Desc).toBeLessThan(idx104Desc); // Higher externalId first on ties

      const asc = sortProcurements(MOCK_PROJECTS, 'publishDate_asc');
      const idx105Asc = asc.findIndex((p) => p.externalId === 105);
      const idx104Asc = asc.findIndex((p) => p.externalId === 104);
      expect(idx104Asc).toBeLessThan(idx105Asc); // Lower externalId first on ties
    });

    it('sorts by budget descending and ascending', () => {
      const budgetDesc = sortProcurements(MOCK_PROJECTS, 'budget_desc');
      expect(budgetDesc[0].externalId).toBe(101); // 50M
      expect(budgetDesc[budgetDesc.length - 1].externalId).toBe(105); // 3.5M

      const budgetAsc = sortProcurements(MOCK_PROJECTS, 'budget_asc');
      expect(budgetAsc[0].externalId).toBe(105);
      expect(budgetAsc[budgetAsc.length - 1].externalId).toBe(101);
    });

    it('sorts by deadline ascending (closing soonest first) and descending', () => {
      const deadlineAsc = sortProcurements(MOCK_PROJECTS, 'deadline_asc');
      // Earliest deadline in MOCK_PROJECTS is 101: 2026-08-30
      expect(deadlineAsc[0].externalId).toBe(101);
      expect(deadlineAsc[0].deadline).toBe('2026-08-30');
      // Latest deadline is 104: 2026-09-20
      expect(deadlineAsc[deadlineAsc.length - 1].externalId).toBe(104);
      expect(deadlineAsc[deadlineAsc.length - 1].deadline).toBe('2026-09-20');

      const deadlineDesc = sortProcurements(MOCK_PROJECTS, 'deadline_desc');
      expect(deadlineDesc[0].externalId).toBe(104);
      expect(deadlineDesc[deadlineDesc.length - 1].externalId).toBe(101);
    });
  });

  // ─── Issue #155: Support Combined Search & Filters ─────────────────────────
  describe('Issue #155: Combined Search & Filters (applyProcurementFilters & executeProcurementSearch)', () => {
    it('combines keyword search + category + agency + budget simultaneously', () => {
      const result = applyProcurementFilters(MOCK_PROJECTS, {
        search: 'พอร์ทัล',
        categories: ['Website'],
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        minBudget: 10000000,
      });

      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe(101);
    });

    it('clearing an individual filter retains all other active criteria', () => {
      // Step 1: Active category + agency
      const combined = applyProcurementFilters(MOCK_PROJECTS, {
        categories: ['Website'],
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
      });
      expect(combined).toHaveLength(1);
      expect(combined[0].externalId).toBe(101);

      // Step 2: Clear agency, keep category
      const afterClearAgency = applyProcurementFilters(MOCK_PROJECTS, {
        categories: ['Website'],
        agencies: [],
      });
      expect(afterClearAgency).toHaveLength(2);
      expect(afterClearAgency.map((p) => p.externalId)).toEqual([101, 105]);

      // Step 3: Clear all
      const clearedAll = applyProcurementFilters(MOCK_PROJECTS, {});
      expect(clearedAll).toHaveLength(MOCK_PROJECTS.length);
    });

    it('executes combined query with pagination and total count', () => {
      const queryResult = executeProcurementSearch(MOCK_PROJECTS, {
        categories: ['Website', 'Mobile App', 'AI', 'Database'],
        sortBy: 'publishDate_desc',
        page: 1,
        limit: 2,
      });

      expect(queryResult.total).toBe(5);
      expect(queryResult.totalPages).toBe(3);
      expect(queryResult.items).toHaveLength(2);
      expect(queryResult.page).toBe(1);
    });

    it('preserves query parameters across pagination pages', () => {
      const page1 = executeProcurementSearch(MOCK_PROJECTS, {
        sortBy: 'publishDate_desc',
        page: 1,
        limit: 2,
      });
      const page2 = executeProcurementSearch(MOCK_PROJECTS, {
        sortBy: 'publishDate_desc',
        page: 2,
        limit: 2,
      });

      // Page 1 and Page 2 must not have overlapping items
      const p1Ids = page1.items.map((p) => p.externalId);
      const p2Ids = page2.items.map((p) => p.externalId);
      expect(p1Ids.some((id) => p2Ids.includes(id))).toBe(false);
    });
  });

  // ─── Awarded Contract Filtering & Status ────────────────────────────────────
  describe('Awarded Contract Handling (isContractAwarded & Filter Exclusion)', () => {
    it('accurately identifies awarded contracts based on winnerName or status', () => {
      const awardedByWinner = { ...MOCK_PROJECTS[0], winnerName: 'บริษัท ทีเอ็กซ์ จำกัด' };
      const awardedByStatus = { ...MOCK_PROJECTS[0], status: 'จัดทำสัญญาแล้ว' };
      const awardedByContractPrice = {
        ...MOCK_PROJECTS[0],
        contractPrice: 45000000,
        contractDate: '2026-08-15',
      };
      const activeProject = { ...MOCK_PROJECTS[0], winnerName: undefined, status: 'ประกาศเชิญชวน' };

      expect(isContractAwarded(awardedByWinner)).toBe(true);
      expect(isContractAwarded(awardedByStatus)).toBe(true);
      expect(isContractAwarded(awardedByContractPrice)).toBe(true);
      expect(isContractAwarded(activeProject)).toBe(false);
    });

    it('excludes awarded contracts when filterByDeadline is applied', () => {
      const projectsWithAwarded: Project[] = [
        { ...MOCK_PROJECTS[0], deadline: '2026-08-30' },
        { ...MOCK_PROJECTS[1], deadline: '2026-09-10', winnerName: 'บริษัท กสทช จำกัด' },
      ];

      // Assuming mock deadline is handled relative to daysUntil
      const results = filterByDeadline(projectsWithAwarded, 'within30');
      // The awarded project should never be included
      expect(results.some((p) => p.winnerName === 'บริษัท กสทช จำกัด')).toBe(false);
    });

    it('excludes awarded contracts when any filter is applied via applyProcurementFilters', () => {
      const projectsWithAwarded: Project[] = [
        { ...MOCK_PROJECTS[0], externalId: 201, category: 'Website' },
        { ...MOCK_PROJECTS[1], externalId: 202, category: 'Website', winnerName: 'ผู้ชนะรางวัล' },
      ];

      const result = applyProcurementFilters(projectsWithAwarded, {
        categories: ['Website'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe(201);
    });
  });
});

