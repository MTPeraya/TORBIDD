/**
 * @jest-environment node
 */
// =============================================================================
// services/database/__tests__/procurement-dedup.test.ts
// Tests for Primary & Secondary Deduplication, Conflict Resolution, Pre-ingestion checks & Audit Logging
// =============================================================================

import {
  generateProjectContentHash,
  checkProjectDeduplication,
} from '../procurement';
import ProcurementProject from '@/models/ProcurementProject';
import connectToDatabase from '@/lib/mongodb';
import { DiscoveredProject } from '@/types/procurement';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/ProcurementProject');

describe('Procurement Deduplication & Revision Tracking', () => {
  const mockProject1: DiscoveredProject = {
    externalProjectId: '67119538991',
    projectName: 'ระบบคลาวด์กลาง กทม.',
    agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
    fiscalYear: 2568,
    source: 'CKAN_GOVSPENDING',
    sourceUrl: 'https://process5.gprocurement.go.th/...',
    budget: 10000000,
    procurementType: 'จ้างพัฒนา',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── 1. Content Hash Determinism & Sensitivity ────────────────────────────
  it('1. should generate consistent SHA-256 hash for identical project content', () => {
    const hash1 = generateProjectContentHash(mockProject1);
    const hash2 = generateProjectContentHash({ ...mockProject1 });

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('2. should generate different hash when budget or details change (secondary key)', () => {
    const originalHash = generateProjectContentHash(mockProject1);
    const modifiedBudgetHash = generateProjectContentHash({
      ...mockProject1,
      budget: 12000000, // Budget amendment
    });
    const modifiedNameHash = generateProjectContentHash({
      ...mockProject1,
      projectName: 'ระบบคลาวด์กลาง กทม. (ฉบับแก้ไข)',
    });

    expect(modifiedBudgetHash).not.toBe(originalHash);
    expect(modifiedNameHash).not.toBe(originalHash);
  });

  // ─── 2. Pre-Ingestion Check Logic ─────────────────────────────────────────
  it('3. should identify brand new records as newProjects with revision 1', async () => {
    (ProcurementProject.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]), // No existing records in DB
    });

    const result = await checkProjectDeduplication([mockProject1]);

    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0].externalProjectId).toBe('67119538991');
    expect(result.newProjects[0].revision).toBe(1);
    expect(result.updatedProjects).toHaveLength(0);
    expect(result.duplicateProjects).toHaveLength(0);
    expect(result.metrics.newCount).toBe(1);
  });

  it('4. should detect duplicate record when primary key & content hash match', async () => {
    const hash = generateProjectContentHash(mockProject1);

    (ProcurementProject.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          externalProjectId: '67119538991',
          projectName: mockProject1.projectName,
          agencyName: mockProject1.agencyName,
          budget: mockProject1.budget,
          fiscalYear: mockProject1.fiscalYear,
          procurementType: mockProject1.procurementType,
          contentHash: hash,
          revision: 1,
        },
      ]),
    });

    const result = await checkProjectDeduplication([mockProject1]);

    expect(result.newProjects).toHaveLength(0);
    expect(result.duplicateProjects).toHaveLength(1);
    expect(result.duplicateProjects[0].project.externalProjectId).toBe('67119538991');
    expect(result.duplicateProjects[0].existingRevision).toBe(1);
    expect(result.metrics.duplicateCount).toBe(1);
  });

  it('5. should detect revision update when primary key matches but content hash differs', async () => {
    const oldHash = 'old-sha256-hash-00000000000000000000000000000000000000000000000000000';

    (ProcurementProject.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          externalProjectId: '67119538991',
          contentHash: oldHash,
          revision: 1,
        },
      ]),
    });

    const result = await checkProjectDeduplication([mockProject1]);

    expect(result.newProjects).toHaveLength(0);
    expect(result.duplicateProjects).toHaveLength(0);
    expect(result.updatedProjects).toHaveLength(1);
    expect(result.updatedProjects[0].oldRevision).toBe(1);
    expect(result.updatedProjects[0].newRevision).toBe(2);
    expect(result.updatedProjects[0].project.revision).toBe(2);
    expect(result.updatedProjects[0].reason).toContain('Content hash changed');
    expect(result.metrics.updatedCount).toBe(1);
  });
});
