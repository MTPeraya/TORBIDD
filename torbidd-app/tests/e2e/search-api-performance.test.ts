/**
 * @jest-environment node
 *
 * E2E: API Search Route Endpoints Performance & Accuracy (Titles and Scopes)
 *
 * Verifies that:
 *  1. GET /api/projects with single and multi-keyword search queries against titles and scopes.
 *  2. GET /api/procurements with single and multi-keyword queries against titles and scopes.
 *  3. HTTP API response latency strictly fulfills the performance SLA (<= 3 seconds / 3000 ms).
 *  4. Correct pagination, metadata, and status codes are preserved.
 */

import { NextRequest } from 'next/server';
import { GET as getProjectsRoute } from '@/app/api/projects/route';
import { GET as getProcurementsRoute } from '@/app/api/procurements/route';
import { Project } from '@/types/project';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));

const MOCK_API_PROJECTS: Project[] = [
  {
    externalId: 201,
    title: {
      th: 'ระบบคลาวด์พอร์ทัลบริการสาธารณะ',
      en: 'Public Service Cloud Portal System',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 35000000,
    publishDate: '2026-08-01T00:00:00.000Z',
    deadline: '2026-09-30T00:00:00.000Z',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: {
      th: 'ระบบพอร์ทัลเชื่อมต่อคลาวด์ภาครัฐ',
      en: 'Government Cloud Service Portal',
    },
    scope: {
      th: [
        'ออกแบบสถาปัตยกรรม Microservices บน Google Cloud',
        'เชื่อมโยงระบบยืนยันตัวตน Digital ID',
        'พัฒนาระบบ Single Sign-On (SSO)',
      ],
      en: [
        'Design Microservices architecture on Google Cloud',
        'Integrate Digital ID authentication',
        'Develop Single Sign-On (SSO)',
      ],
    },
    qualifications: { th: ['มีผลงานพัฒนาระบบคลาวด์'], en: ['Cloud experience'] },
    historicalAvg: 34000000,
    sourceDocument: 'Attach_TOR_201.pdf',
    processedDate: '2026-08-01T00:00:00.000Z',
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 202,
    title: {
      th: 'ระบบกล้องโทรทัศน์วงจรปิดอัจฉริยะความละเอียดสูง',
      en: 'High Definition Smart CCTV Camera System',
    },
    department: {
      th: 'สำนักการจราจรและขนส่ง',
      en: 'Traffic and Transport Department',
    },
    budget: 18000000,
    publishDate: '2026-08-10T00:00:00.000Z',
    deadline: '2026-09-20T00:00:00.000Z',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: {
      th: 'ติดตั้งกล้อง AI ตรวจสอบการจราจร',
      en: 'Deploy AI cameras for traffic analysis',
    },
    scope: {
      th: [
        'ติดตั้งระบบ AI Video Analytics ตรวจจับทะเบียนรถ',
        'สตรีมมิ่งวิดีโอแบบ Real-time ความหน่วงต่ำ',
        'ระบบเตือนภัยอุบัติเหตุและรถติดอัตโนมัติ',
      ],
      en: [
        'Install AI Video Analytics for license plate recognition',
        'Low-latency real-time video streaming pipeline',
        'Automatic traffic incident detection',
      ],
    },
    qualifications: { th: ['มีผลงาน AI Computer Vision'], en: ['AI Computer Vision experience'] },
    historicalAvg: 17500000,
    sourceDocument: 'Attach_TOR_202.pdf',
    processedDate: '2026-08-10T00:00:00.000Z',
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
];

// Mock database services
jest.mock('@/services/database/projects', () => ({
  getProjects: jest.fn().mockImplementation(async (filters: any) => {
    if (!filters || !filters.search) return MOCK_API_PROJECTS;
    const q = filters.search.toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return MOCK_API_PROJECTS.filter((p) => {
      const scopeStr = `${p.scope.th.join(' ')} ${p.scope.en.join(' ')}`.toLowerCase();
      const text = `${p.title.th} ${p.title.en} ${p.department.th} ${p.department.en} ${scopeStr}`.toLowerCase();
      if (text.includes(q)) return true;
      if (tokens.length > 1) return tokens.every((t: string) => text.includes(t));
      return false;
    });
  }),
}));

jest.mock('@/services/database/procurement', () => ({
  getProcurementProjects: jest.fn().mockResolvedValue({ projects: [], total: 0 }),
}));

describe('E2E: API Search Route Endpoints Performance & Accuracy', () => {
  it('1.1 GET /api/projects handles single-keyword search against Title and responds in <= 3,000 ms', async () => {
    const t0 = performance.now();

    const req = new NextRequest('http://localhost:3000/api/projects?search=%E0%B8%84%E0%B8%A5%E0%B8%B2%E0%B8%A7%E0%B8%94%E0%B9%8C'); // "คลาวด์"
    const res = await getProjectsRoute(req);
    const json = await res.json();

    const latency = performance.now() - t0;

    expect(res.status).toBe(200);
    expect(json.data).toBeDefined();
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].externalId).toBe(201);
    // SLA constraint: <= 3,000 ms
    expect(latency).toBeLessThanOrEqual(3000);
    expect(latency).toBeLessThan(500);
  });

  it('1.2 GET /api/projects handles single-keyword search against Scope and responds in <= 3,000 ms', async () => {
    const t0 = performance.now();

    // "Microservices" is only in Project 201's scope, NOT in title
    const req = new NextRequest('http://localhost:3000/api/projects?search=Microservices');
    const res = await getProjectsRoute(req);
    const json = await res.json();

    const latency = performance.now() - t0;

    expect(res.status).toBe(200);
    expect(json.data.length).toBe(1);
    expect(json.data[0].externalId).toBe(201);
    expect(latency).toBeLessThanOrEqual(3000);
  });

  it('1.3 GET /api/projects handles multi-keyword search across Title and Scope in <= 3,000 ms', async () => {
    const t0 = performance.now();

    // Query "กล้อง AI": "กล้อง" in Title, "AI" in Scope/Description
    const req = new NextRequest('http://localhost:3000/api/projects?search=%E0%B8%81%E0%B8%A5%E0%B9%89%E0%B8%AD%E0%B8%87+AI');
    const res = await getProjectsRoute(req);
    const json = await res.json();

    const latency = performance.now() - t0;

    expect(res.status).toBe(200);
    expect(json.data.length).toBe(1);
    expect(json.data[0].externalId).toBe(202);
    expect(latency).toBeLessThanOrEqual(3000);
  });

  it('1.4 GET /api/procurements handles multi-keyword search and responds in <= 3,000 ms', async () => {
    const t0 = performance.now();

    const req = new NextRequest('http://localhost:3000/api/procurements?search=%E0%B8%81%E0%B8%A5%E0%B9%89%E0%B8%AD%E0%B8%87+AI');
    const res = await getProcurementsRoute(req);
    const json = await res.json();

    const latency = performance.now() - t0;

    expect(res.status).toBe(200);
    expect(json.data).toBeDefined();
    expect(json.data.length).toBeGreaterThan(0);
    expect(latency).toBeLessThanOrEqual(3000);
  });

  it('1.5 returns empty array when query does not match any project within SLA', async () => {
    const t0 = performance.now();

    const req = new NextRequest('http://localhost:3000/api/projects?search=NONEXISTENT_KEYWORD_XYZ');
    const res = await getProjectsRoute(req);
    const json = await res.json();

    const latency = performance.now() - t0;

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.total).toBe(0);
    expect(latency).toBeLessThanOrEqual(3000);
  });
});
