/**
 * @jest-environment node
 */
// =============================================================================
// services/database/__tests__/projects.integration.test.ts
// Integration tests for Project repository service against isolated in-memory DB
// =============================================================================

import { setupTestDatabase } from '@/test/db-handler';
import {
  createProject,
  getProjects,
  getProjectById,
  getProjectByExternalId,
} from '../projects';

describe('Projects Repository Database Integration', () => {
  setupTestDatabase();

  it('creates and retrieves a project from the in-memory database', async () => {
    const created = await createProject({
      title: { th: 'โครงการพัฒนาระบบคลาวด์', en: 'Cloud Development Project' },
      department: { th: 'สำนักยุทธศาสตร์', en: 'Strategy Department' },
      budget: 5000000,
      publishDate: '2026-01-01T00:00:00.000Z',
      deadline: '2026-06-01T00:00:00.000Z',
      category: 'Cloud',
      isSoftwareRelated: true,
      procurementType: 'e-Bidding',
      description: { th: 'รายละเอียดโครงการ', en: 'Project details' },
      scope: { th: ['ติดตั้งระบบ'], en: ['Deploy system'] },
      qualifications: { th: ['มีประสบการณ์'], en: ['Experienced'] },
    });

    expect(created._id).toBeDefined();
    expect(created.externalId).toBeGreaterThanOrEqual(100);

    const fetched = await getProjectById(String(created._id));
    expect(fetched).not.toBeNull();
    expect(fetched?.title.th).toBe('โครงการพัฒนาระบบคลาวด์');
    expect(fetched?.budget).toBe(5000000);

    const byExternal = await getProjectByExternalId(created.externalId);
    expect(byExternal).not.toBeNull();
    expect(byExternal?.title.en).toBe('Cloud Development Project');
  });

  it('guarantees test isolation across tests', async () => {
    const all = await getProjects();
    expect(all).toHaveLength(0);
  });

  it('filters projects by search keyword and category', async () => {
    await createProject({
      title: { th: 'ระบบ AI ตรวจสอบเอกสาร', en: 'AI Document Inspector' },
      department: { th: 'กทม.', en: 'BMA' },
      budget: 2000000,
      publishDate: '2026-02-01T00:00:00.000Z',
      deadline: '2026-07-01T00:00:00.000Z',
      category: 'AI',
      isSoftwareRelated: true,
      procurementType: 'e-Bidding',
      description: { th: 'ตรวจเอกสารอัตโนมัติ', en: 'Auto inspect docs' },
      scope: { th: ['พัฒนา AI'], en: ['Develop AI'] },
      qualifications: { th: ['เกณฑ์คุณภาพ'], en: ['Quality criteria'] },
    });

    await createProject({
      title: { th: 'ระบบฐานข้อมูลกลาง', en: 'Central Database System' },
      department: { th: 'สำนักงานเขตพระนคร', en: 'Phra Nakhon District' },
      budget: 1500000,
      publishDate: '2026-02-01T00:00:00.000Z',
      deadline: '2026-07-01T00:00:00.000Z',
      category: 'Database',
      isSoftwareRelated: true,
      procurementType: 'e-Bidding',
      description: { th: 'ฐานข้อมูลกลาง', en: 'Central DB' },
      scope: { th: ['ติดตั้ง DB'], en: ['Install DB'] },
      qualifications: { th: ['เกณฑ์ผู้ค้า'], en: ['Vendor criteria'] },
    });

    // Search keyword
    const searchResults = await getProjects({ search: 'เอกสาร' });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].title.th).toContain('ระบบ AI');

    // Category filter
    const categoryResults = await getProjects({ category: 'Database' });
    expect(categoryResults).toHaveLength(1);
    expect(categoryResults[0].title.en).toBe('Central Database System');
  });
});
