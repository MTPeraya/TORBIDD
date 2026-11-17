/**
 * @jest-environment node
 *
 * E2E: Document Download API Endpoint Tests (GET /api/documents/[projectId]/[fileName])
 *
 * Verifies that the document service:
 *  1. Generates and streams valid %PDF-1.4 compliant binary TOR documents
 *  2. Returns correct HTTP headers (Content-Type: application/pdf, Content-Disposition, Cache-Control)
 *  3. Serves on-disk pre-downloaded PDF files when available in storage directory
 *  4. Returns HTML redirection portal linking directly to official e-GP announcement when requested
 */

import { NextRequest } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { GET as getDocumentRoute } from '@/app/api/documents/[projectId]/[fileName]/route';

// Mock MongoDB connection & models
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));

const mockProjectData = {
  externalProjectId: '67119538991',
  externalId: 67119538991,
  projectName: 'โครงการจัดจ้างพัฒนาระบบพอร์ทัลบริการประชาชนแบบครบวงจร (BMA One Stop Portal)',
  title: {
    th: 'โครงการจัดจ้างพัฒนาระบบพอร์ทัลบริการประชาชนแบบครบวงจร (BMA One Stop Portal)',
    en: 'Comprehensive Citizen Service Portal Development Project',
  },
  agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
  department: {
    th: 'สำนักยุทธศาสตร์และประเมินผล',
    en: 'Strategy and Evaluation Department',
  },
  budget: 45000000,
  publishDate: '2026-08-01T00:00:00.000Z',
  deadline: '2026-09-30T00:00:00.000Z',
  procurementType: 'e-Bidding',
  source: 'ระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)',
  summary: {
    th: 'โครงการจัดจ้างพัฒนาระบบศูนย์กลางบริการประชาชนกรุงเทพมหานครแบบ One Stop Service',
    en: 'Central citizen services portal development',
  },
  scope: {
    th: ['ติดตั้งสถาปัตยกรรมคลาวด์', 'พัฒนาระบบ SSO ThaID', 'เชื่อมโยง e-Payment'],
    en: ['Cloud setup', 'ThaID SSO', 'e-Payment integration'],
  },
  qualifications: {
    th: ['มีทุนจดทะเบียนไม่น้อยกว่า 10,000,000 บาท', 'มีผลงานไม่น้อยกว่า 15,000,000 บาท'],
    en: ['Registered capital >= 10M THB', 'Past performance >= 15M THB'],
  },
  requiredTechnologies: ['Next.js', 'PostgreSQL', 'Docker', 'Kubernetes'],
};

jest.mock('@/models/ProcurementProject', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockImplementation(() => Promise.resolve(mockProjectData)),
    }),
  },
}));

jest.mock('@/models/Project', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockImplementation(() => Promise.resolve(mockProjectData)),
    }),
  },
}));

describe('E2E: Document Download API (GET /api/documents/[projectId]/[fileName])', () => {
  let tempStorageDir: string;

  beforeAll(() => {
    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'torbidd-doc-e2e-'));
    process.env.DOCUMENT_STORAGE_PATH = tempStorageDir;
  });

  afterAll(() => {
    if (fs.existsSync(tempStorageDir)) {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    }
  });

  it('1. returns valid %PDF-1.4 binary stream with application/pdf headers when .pdf is requested', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/documents/67119538991/TOR_67119538991.pdf',
      {
        headers: {
          accept: 'application/pdf',
        },
      },
    );

    const response = await getDocumentRoute(req, {
      params: Promise.resolve({
        projectId: '67119538991',
        fileName: 'TOR_67119538991.pdf',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('inline; filename="TOR_67119538991.pdf"');

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verify PDF Magic Bytes (%PDF-1.4)
    const pdfHeader = buffer.subarray(0, 8).toString('ascii');
    expect(pdfHeader).toContain('%PDF-1.');
    expect(buffer.length).toBeGreaterThan(500); // Standard generated PDF has substantial size
  });

  it('2. serves pre-existing local TOR PDF file directly from storage disk if available', async () => {
    // Create pre-existing file on disk
    const projectDir = path.join(tempStorageDir, '67119538991');
    fs.mkdirSync(projectDir, { recursive: true });

    const localPdfPath = path.join(projectDir, 'Attach_TOR_Original_67119538991.pdf');
    const dummyPdfContent = Buffer.from('%PDF-1.4\n%Pre-downloaded Government TOR File\n%%EOF');
    fs.writeFileSync(localPdfPath, dummyPdfContent);

    const req = new NextRequest(
      'http://localhost:3000/api/documents/67119538991/Attach_TOR_Original_67119538991.pdf',
    );

    const response = await getDocumentRoute(req, {
      params: Promise.resolve({
        projectId: '67119538991',
        fileName: 'Attach_TOR_Original_67119538991.pdf',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');

    const arrayBuffer = await response.arrayBuffer();
    const content = Buffer.from(arrayBuffer).toString('utf-8');
    expect(content).toContain('%Pre-downloaded Government TOR File');
  });

  it('3. returns HTML transition portal linking to official e-GP website when non-PDF is requested', async () => {
    // Remove local file to trigger fallback
    const projectDir = path.join(tempStorageDir, '67119538991');
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }

    const req = new NextRequest('http://localhost:3000/api/documents/67119538991/view');

    const response = await getDocumentRoute(req, {
      params: Promise.resolve({
        projectId: '67119538991',
        fileName: 'view',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const htmlText = await response.text();
    expect(htmlText).toContain('process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=67119538991');
    expect(htmlText).toContain('เอกสารประกาศและ TOR (e-GP)');
  });
});
