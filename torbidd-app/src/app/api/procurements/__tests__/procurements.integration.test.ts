/**
 * @jest-environment node
 */
// =============================================================================
// app/api/procurements/__tests__/procurements.integration.test.ts
// Integration tests for GET /api/procurements with Zod validation & in-memory DB
// =============================================================================

import { NextRequest } from 'next/server';
import { setupTestDatabase } from '@/test/db-handler';
import { GET as procurementsHandler } from '../route';
import ProcurementProject from '@/models/ProcurementProject';

describe('GET /api/procurements - Zod Validation & Search Integration', () => {
  setupTestDatabase();

  // ─── 1. Zod Validation Errors (400 Bad Request) ────────────────────────────
  describe('Zod Query Parameter Validation', () => {
    it('returns 400 when minBudget exceeds maxBudget', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?minBudget=10000000&maxBudget=2000000',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid procurement filter parameters');
      expect(json.details.fieldErrors.minBudget).toBeDefined();
      expect(json.details.fieldErrors.minBudget[0]).toBe(
        'Minimum budget cannot exceed maximum budget',
      );
    });

    it('returns 400 when minBudget is negative', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?minBudget=-50000',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid procurement filter parameters');
      expect(json.details.fieldErrors.minBudget).toBeDefined();
    });

    it('returns 400 when category is invalid', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?category=NotAValidCategory',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid procurement filter parameters');
      expect(json.details.fieldErrors.category).toBeDefined();
    });

    it('returns 400 when sortBy option is unsupported', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?sortBy=random_order',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid procurement filter parameters');
      expect(json.details.fieldErrors.sortBy).toBeDefined();
    });

    it('returns 400 when page is less than 1', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?page=0',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid procurement filter parameters');
      expect(json.details.fieldErrors.page).toBeDefined();
    });

    it('returns 400 when search query exceeds 200 characters', async () => {
      const longSearch = 'a'.repeat(201);
      const req = new NextRequest(
        `http://localhost:3000/api/procurements?search=${longSearch}`,
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid procurement filter parameters');
      expect(json.details.fieldErrors.search).toBeDefined();
    });
  });

  // ─── 2. Valid Query Execution against In-Memory Database ───────────────────
  describe('Valid Query Execution & Database Search', () => {
    beforeEach(async () => {
      // Seed test data into isolated in-memory MongoDB
      await ProcurementProject.insertMany([
        {
          externalProjectId: '67119000001',
          projectName: 'โครงการพัฒนาระบบปัญญาประดิษฐ์ (AI Analytics)',
          agencyName: 'สำนักการแพทย์ กรุงเทพมหานคร',
          fiscalYear: 2568,
          source: 'BMA_EGP',
          sourceUrl: 'https://egp2.bangkok.go.th/notice/001',
          budget: 5000000,
          procurementType: 'e-Bidding',
          status: 'IN_REVIEW',
          summary: { th: 'ระบบ AI วิเคราะห์', en: 'AI Analytics System' },
          requiredTechnologies: ['Python', 'TensorFlow'],
          category: 'AI',
          publishDate: new Date('2026-03-01T00:00:00.000Z'),
          deadline: new Date('2026-05-01T00:00:00.000Z'),
          contentHash: 'hash-001',
        },
        {
          externalProjectId: '67119000002',
          projectName: 'โครงการจัดทำเว็บพอร์ทัลบริการประชาชน',
          agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
          fiscalYear: 2568,
          source: 'CKAN_GOVSPENDING',
          sourceUrl: 'https://data.go.th/dataset/002',
          budget: 1500000,
          procurementType: 'e-Bidding',
          status: 'IN_REVIEW',
          summary: { th: 'เว็บพอร์ทัล', en: 'Web Portal' },
          requiredTechnologies: ['React', 'Next.js'],
          category: 'Website',
          publishDate: new Date('2026-02-15T00:00:00.000Z'),
          deadline: new Date('2026-04-15T00:00:00.000Z'),
          contentHash: 'hash-002',
        },
        {
          externalProjectId: '67119000003',
          projectName: 'ระบบฐานข้อมูลกลางและคลังข้อมูล Big Data',
          agencyName: 'สำนักงานเขตคลองเตย',
          fiscalYear: 2568,
          source: 'NATIONAL_EGP',
          sourceUrl: 'https://gprocurement.go.th/003',
          budget: 12000000,
          procurementType: 'e-Bidding',
          status: 'IN_REVIEW',
          summary: { th: 'คลังข้อมูลขนาดใหญ่', en: 'Big Data Warehouse' },
          requiredTechnologies: ['PostgreSQL', 'Kafka'],
          category: 'Database',
          publishDate: new Date('2026-01-10T00:00:00.000Z'),
          deadline: new Date('2026-06-10T00:00:00.000Z'),
          contentHash: 'hash-003',
        },
      ]);
    });

    it('returns all projects with default pagination (page=1, limit=12)', async () => {
      const req = new NextRequest('http://localhost:3000/api/procurements');
      const res = await procurementsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBeGreaterThanOrEqual(3);
      expect(json.page).toBe(1);
      expect(json.limit).toBe(12);
      expect(json.total).toBeGreaterThanOrEqual(3);
    });

    it('filters projects by search keyword', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?search=ปัญญาประดิษฐ์',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBe(1);
      expect(json.data[0].title.th).toContain('ปัญญาประดิษฐ์');
    });

    it('filters projects by valid category', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?category=Website',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBe(1);
      expect(json.data[0].category).toBe('Website');
    });

    it('filters projects by budget range (minBudget and maxBudget)', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?minBudget=1000000&maxBudget=2000000',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBe(1);
      expect(json.data[0].budget).toBe(1500000);
    });

    it('sorts projects by budget descending', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?sortBy=budget_desc',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data[0].budget).toBe(12000000);
      expect(json.data[json.data.length - 1].budget).toBe(1500000);
    });

    it('supports custom pagination limits', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/procurements?page=1&limit=2',
      );
      const res = await procurementsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBe(2);
      expect(json.limit).toBe(2);
      expect(json.totalPages).toBeGreaterThanOrEqual(2);
    });
  });
});
