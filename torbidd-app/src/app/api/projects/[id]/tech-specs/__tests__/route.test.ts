/**
 * @jest-environment node
 */
// =============================================================================
// app/api/projects/[id]/tech-specs/__tests__/route.test.ts
// Unit tests for GET /api/projects/[id]/tech-specs
// =============================================================================

import { NextRequest } from 'next/server';
import { GET } from '../route';
import * as procurementDb from '@/services/database/procurement';
import * as projectDb from '@/services/database/projects';

jest.mock('@/services/database/procurement');
jest.mock('@/services/database/projects');

describe('GET /api/projects/[id]/tech-specs', () => {
  const MOCK_PROJECT_ID = '67119538991';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 404 if project is not found', async () => {
    (procurementDb.getProjectWithDocuments as jest.Mock).mockResolvedValue(null);
    (projectDb.getProjectByExternalId as jest.Mock).mockResolvedValue(null);
    (projectDb.getProjectById as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest(`http://localhost:3000/api/projects/unknown-99999/tech-specs`);
    const res = await GET(req, { params: Promise.resolve({ id: 'unknown-99999' }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Project not found');
  });

  it('should return all normalized technologies and requirements for valid project', async () => {
    const mockProcurement = {
      project: {
        externalProjectId: MOCK_PROJECT_ID,
        projectName: 'ระบบคลาวด์และศูนย์ข้อมูล Data Center',
        budget: 50000000,
        requiredTechnologies: ['Postgres DB', 'k8s', 'React.js', 'PDPA'],
        technicalRequirements: {
          th: ['ระบบต้องรองรับ Tier III และมี Backup DR Site', 'เข้ารหัสข้อมูลตามมาตรฐาน ISO/IEC 27001'],
          en: ['Tier III compliant with Disaster Recovery', 'ISO/IEC 27001 compliant'],
        },
      },
      documents: [],
    };

    (procurementDb.getProjectWithDocuments as jest.Mock).mockResolvedValue(mockProcurement);

    const req = new NextRequest(`http://localhost:3000/api/projects/${MOCK_PROJECT_ID}/tech-specs`);
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_PROJECT_ID }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.category).toBe('All');
    expect(json.technologies.length).toBe(4);

    // Verify taxonomy normalization
    const techNames = json.technologies.map((t: { name: string }) => t.name);
    expect(techNames).toContain('PostgreSQL');
    expect(techNames).toContain('Kubernetes');
    expect(techNames).toContain('React');
    expect(techNames).toContain('PDPA Compliance');

    // Verify requirement categorization
    expect(json.requirements.length).toBe(2);
    expect(json.requirements[0].category).toBe('Infra');
    expect(json.requirements[1].category).toBe('Security');
  });

  it('should filter specifications by category query param', async () => {
    const mockProcurement = {
      project: {
        externalProjectId: MOCK_PROJECT_ID,
        projectName: 'ระบบสารสนเทศ',
        budget: 10000000,
        requiredTechnologies: ['Next.js', 'PostgreSQL', 'Docker', 'OAuth 2.0'],
        technicalRequirements: {
          th: [
            'หน้าจอ UI เว็บไซต์ต้องรองรับ Responsive ทุกขนาดจอ',
            'เชื่อมต่อข้อมูลผ่าน RESTful API Gateway',
          ],
          en: ['UI responsive', 'RESTful API gateway'],
        },
      },
      documents: [],
    };

    (procurementDb.getProjectWithDocuments as jest.Mock).mockResolvedValue(mockProcurement);

    // Query for Frontend only
    const req = new NextRequest(`http://localhost:3000/api/projects/${MOCK_PROJECT_ID}/tech-specs?category=Frontend`);
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_PROJECT_ID }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.category).toBe('Frontend');
    expect(json.technologies.every((t: { category: string }) => t.category === 'Frontend')).toBe(true);
    expect(json.technologies.some((t: { name: string }) => t.name === 'Next.js')).toBe(true);
    expect(json.requirements.length).toBe(1);
    expect(json.requirements[0].category).toBe('Frontend');
  });
});
