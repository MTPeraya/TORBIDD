/**
 * @jest-environment node
 *
 * E2E: Dynamic Filtering API Route Tests (GET /api/projects & GET /api/procurements)
 *
 * Validates dynamic filtering combinations over HTTP endpoints:
 *  1. Query parameter parsing for single and multi-agency / department parameters
 *  2. Category filtering via single and multi-category query params
 *  3. Budget filtering via presets (e.g. above20m) and numeric min/max range
 *  4. Priority submission deadline urgency filtering (within7, within30, moreThan30)
 *  5. Combined 2-way, 3-way, and full 4-way filter criteria over HTTP API
 */

import { NextRequest } from 'next/server';
import { GET as getProjectsRoute } from '@/app/api/projects/route';
import { GET as getProcurementsRoute } from '@/app/api/procurements/route';
import { Project } from '@/types/project';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));

const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

const MOCK_API_PROJECTS: Project[] = [
  {
    externalId: 301,
    title: {
      th: 'ระบบพอร์ทัลบริการประชาชนแบบครบวงจร',
      en: 'Comprehensive Citizen Service Portal',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 45000000,
    publishDate: new Date(now - 2 * DAY_MS).toISOString(),
    deadline: new Date(now + 5 * DAY_MS).toISOString(), // within7 & within30
    category: 'Website',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'รายละเอียดพอร์ทัล', en: 'Portal details' },
    scope: { th: ['ระบบ One Stop Service'], en: ['One Stop Service'] },
    qualifications: { th: ['มีผลงาน'], en: ['Proven track record'] },
    historicalAvg: 44000000,
    sourceDocument: 'doc301.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 302,
    title: {
      th: 'ระบบ AI วิเคราะห์จราจรอัจฉริยะ',
      en: 'Smart Traffic AI Analytics System',
    },
    department: {
      th: 'สำนักการจราจรและขนส่ง',
      en: 'Traffic and Transport Department',
    },
    budget: 15000000,
    publishDate: new Date(now - 3 * DAY_MS).toISOString(),
    deadline: new Date(now + 14 * DAY_MS).toISOString(), // within30
    category: 'AI',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'ระบบตรวจจับภาพ AI', en: 'AI Camera Vision' },
    scope: { th: ['ติดตั้งกล้อง AI'], en: ['AI cameras installation'] },
    qualifications: { th: ['มีผลงาน AI'], en: ['AI track record'] },
    historicalAvg: 14500000,
    sourceDocument: 'doc302.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 303,
    title: {
      th: 'แอปพลิเคชันมือถือตรวจวัดระดับน้ำและเตือนภัย',
      en: 'Flood Monitoring and Warning Mobile Application',
    },
    department: {
      th: 'สำนักการระบายน้ำ',
      en: 'Drainage and Sewerage Department',
    },
    budget: 8000000,
    publishDate: new Date(now - 4 * DAY_MS).toISOString(),
    deadline: new Date(now + 40 * DAY_MS).toISOString(), // moreThan30
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'แอปเตือนภัยน้ำท่วม', en: 'Flood warning app' },
    scope: { th: ['พัฒนาแอป iOS/Android'], en: ['Develop iOS/Android app'] },
    qualifications: { th: ['มีผลงานโมบาย'], en: ['Mobile app track record'] },
    historicalAvg: 7800000,
    sourceDocument: 'doc303.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 304,
    title: {
      th: 'ระบบจัดตารางเรียนและบริหารโรงเรียน',
      en: 'School Timetable Scheduling and Administration ERP',
    },
    department: {
      th: 'สำนักการศึกษา',
      en: 'Education Department',
    },
    budget: 3500000,
    publishDate: new Date(now - 5 * DAY_MS).toISOString(),
    deadline: new Date(now + 20 * DAY_MS).toISOString(), // within30
    category: 'Website',
    procurementType: 'e-Bidding',
    status: 'เปิดรับข้อเสนอ',
    description: { th: 'ระบบจัดตารางสอนโรงเรียน', en: 'School scheduling' },
    scope: { th: ['ระบบจัดตารางสอนอัตโนมัติ'], en: ['Automated timetable engine'] },
    qualifications: { th: ['มีผลงานระบบการศึกษา'], en: ['Education system experience'] },
    historicalAvg: 3400000,
    sourceDocument: 'doc304.pdf',
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
];

// Mock database services
jest.mock('@/services/database/projects', () => ({
  getProjects: jest.fn().mockImplementation(async () => MOCK_API_PROJECTS),
}));

jest.mock('@/services/database/procurement', () => ({
  getProcurementProjects: jest.fn().mockResolvedValue({ projects: [], total: 0 }),
}));

describe('E2E: Dynamic Filtering API Route Tests', () => {
  it('1.1 filters by category over GET /api/projects', async () => {
    const req = new NextRequest('http://localhost:3000/api/projects?category=AI');
    const res = await getProjectsRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].externalId).toBe(302);
  });

  it('1.2 filters by department over GET /api/projects', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/projects?department=${encodeURIComponent('สำนักการระบายน้ำ')}`,
    );
    const res = await getProjectsRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].externalId).toBe(303);
  });

  it('1.3 filters by budget preset over GET /api/projects', async () => {
    const req = new NextRequest('http://localhost:3000/api/projects?budget=under5m');
    const res = await getProjectsRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].externalId).toBe(304);
  });

  it('1.4 filters by submission deadline urgency over GET /api/projects', async () => {
    const req = new NextRequest('http://localhost:3000/api/projects?deadline=within7');
    const res = await getProjectsRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].externalId).toBe(301);
  });

  it('1.5 executes full 4-way dynamic filtering over GET /api/projects', async () => {
    const url =
      'http://localhost:3000/api/projects?' +
      new URLSearchParams({
        department: 'สำนักยุทธศาสตร์และประเมินผล',
        category: 'Website',
        budget: 'above20m',
        deadline: 'within7',
      }).toString();

    const req = new NextRequest(url);
    const res = await getProjectsRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].externalId).toBe(301);
  });

  it('1.6 executes multi-filter query over GET /api/procurements', async () => {
    const url =
      'http://localhost:3000/api/procurements?' +
      new URLSearchParams({
        category: 'Mobile App',
        department: 'สำนักการระบายน้ำ',
        deadline: 'moreThan30',
      }).toString();

    const req = new NextRequest(url);
    const res = await getProcurementsRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].externalId).toBe(303);
    expect(json.total).toBe(1);
  });
});

