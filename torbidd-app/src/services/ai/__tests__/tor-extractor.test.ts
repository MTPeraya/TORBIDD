// =============================================================================
// services/ai/__tests__/tor-extractor.test.ts
// Unit tests for TOR Information Extraction covering Issues #87, #88, #89, #90, #91
// =============================================================================

import path from 'node:path';
import fs from 'node:fs';
import {
  extractTorHeuristic,
  extractTorFromBuffer,
  extractTorFromFile,
  extractTorFromBase64,
} from '../tor-extractor';

describe('TOR Information Extraction Suite', () => {
  const sampleContext = {
    projectName: 'โครงการพัฒนาระบบคลาวด์และดาต้าเซ็นเตอร์ภาครัฐ (Data Center Cloud Infrastructure)',
    agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
    budget: 12500000,
    fiscalYear: 2568,
    procurementType: 'e-Bidding',
  };

  // ─── Issue #87: TOR Executive Summary ───────────────────────────────────────
  describe('Issue #87: Executive Summary Extraction', () => {
    it('generates a concise, high-value bilingual executive summary', () => {
      const result = extractTorHeuristic(undefined, {
        fileName: 'Attach_TOR_DataCenter.pdf',
        projectContext: sampleContext,
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.th).toBeTruthy();
      expect(result.summary.en).toBeTruthy();
      expect(typeof result.summary.th).toBe('string');
      expect(result.summary.th.length).toBeGreaterThan(40);
      expect(result.summary.th).toContain('วัตถุประสงค์');
      expect(result.summary.en).toContain('Procurement');
    });

    it('accurately identifies Medical PACS maintenance contracts without web defaults', () => {
      const result = extractTorHeuristic(undefined, {
        fileName: 'Attach_TOR_PACS.pdf',
        projectContext: {
          projectName: 'ประกวดราคาจ้างบำรุงรักษาระบบจัดเก็บและรับส่งข้อมูลทางการแพทย์ (PACS) แบบไม่รวมอะไหล่ ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',
          agencyName: 'โรงพยาบาลศูนย์',
          budget: 5000000,
          fiscalYear: 2569,
        },
      });

      expect(result.requiredTechnologies).toContain('DICOM 3.0 & HL7 Standards');
      expect(result.requiredTechnologies).not.toContain('React');
      expect(result.requiredTechnologies).not.toContain('Next.js');
      expect(result.technicalRequirements.th.some((r) => r.includes('PACS') || r.includes('DICOM'))).toBe(true);
      expect(result.summary.th).toContain('Medical PACS/RIS');
      expect(result.summary.th).toContain('บำรุงรักษา');
    });
  });

  // ─── Issue #88: Important Procurement Details from TOR PDFs ────────────────
  describe('Issue #88: Extract Important Procurement Details', () => {
    it('extracts title, budget, deadline, department, procurementType and scope', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 sample pdf content for procurement');
      const result = await extractTorFromBuffer(mockPdfBuffer, {
        fileName: 'ATTACH_TOR.pdf',
        projectContext: sampleContext,
      });

      expect(result.title).toBeDefined();
      expect(result.title?.th).toContain('ดาต้าเซ็นเตอร์');
      expect(result.budget).toBe(12500000);
      expect(result.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.department).toBe('สำนักยุทธศาสตร์และประเมินผล');
      expect(result.procurementType).toBe('e-Bidding');
      expect(Array.isArray(result.scope)).toBe(true);
      expect(result.scope.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── Issue #89: Required Technologies and Technical Requirements ───────────
  describe('Issue #89: Required Technologies and Technical Specs', () => {
    it('identifies and returns required tech stack tags appropriate to project domain', () => {
      const result = extractTorHeuristic(undefined, {
        fileName: 'TOR (Data center).pdf',
        projectContext: sampleContext,
      });

      expect(Array.isArray(result.requiredTechnologies)).toBe(true);
      expect(result.requiredTechnologies.length).toBeGreaterThanOrEqual(4);
      // For Data Center domain:
      expect(
        result.requiredTechnologies.some((t) =>
          ['Cloud Infrastructure', 'VMware / Hypervisor', 'Docker & Kubernetes', 'Network & Firewall'].includes(t),
        ),
      ).toBe(true);
    });

    it('extracts technical requirements with SLA, HA, and compliance specifications', () => {
      const result = extractTorHeuristic(undefined, {
        fileName: 'TOR (Data center).pdf',
        projectContext: sampleContext,
      });

      expect(result.technicalRequirements).toBeDefined();
      expect(Array.isArray(result.technicalRequirements.th)).toBe(true);
      expect(Array.isArray(result.technicalRequirements.en)).toBe(true);
      expect(result.technicalRequirements.th.length).toBeGreaterThanOrEqual(3);

      const combinedText = result.technicalRequirements.th.join(' ');
      expect(combinedText).toMatch(/ISO|SLA|Tier|สำรอง|ความพร้อมใช้งาน/i);
    });

    it('identifies web/mobile domain technologies correctly', () => {
      const webResult = extractTorHeuristic(undefined, {
        fileName: 'TOR_portal_web.pdf',
        projectContext: {
          projectName: 'โครงการจ้างพัฒนาระบบเว็บพอร์ทัลบริการประชาชน',
          budget: 5000000,
        },
      });

      expect(webResult.requiredTechnologies).toContain('React');
      expect(webResult.requiredTechnologies).toContain('PostgreSQL');
    });
  });

  // ─── Issue #90: Required Qualifications & Experience ───────────────────────
  describe('Issue #90: Required Qualifications & Experience', () => {
    it('extracts structured qualifications with categories, thresholds, and mandatory flags', () => {
      const result = extractTorHeuristic(undefined, {
        fileName: 'ATTACH_TOR.pdf',
        projectContext: sampleContext,
      });

      expect(Array.isArray(result.extractedQualifications)).toBe(true);
      expect(result.extractedQualifications.length).toBeGreaterThanOrEqual(3);

      // Verify category coverage
      const categories = result.extractedQualifications.map((q) => q.category);
      expect(categories).toContain('Legal');
      expect(categories).toContain('Experience');
      expect(categories).toContain('Financial');

      // Verify Experience threshold is computed dynamically
      const expQual = result.extractedQualifications.find((q) => q.category === 'Experience');
      expect(expQual).toBeDefined();
      expect(expQual?.mandatory).toBe(true);
      expect(expQual?.threshold).toBeTruthy();
      expect(expQual?.description.th).toContain('ผลงานประเภทเดียวกัน');

      // Verify Legal qualification
      const legalQual = result.extractedQualifications.find((q) => q.category === 'Legal');
      expect(legalQual?.description.th).toContain('นิติบุคคล');
      expect(legalQual?.mandatory).toBe(true);
    });
  });

  // ─── Issue #91: Automated Processing of TOR Documents ─────────────────────
  describe('Issue #91: Automated Document Processing', () => {
    it('extracts data directly from a local PDF file on disk without manual input', async () => {
      // Use existing disk PDF if available or create a temporary dummy PDF
      const realPdfPath = path.resolve(process.cwd(), 'storage/documents/67059199407/TOR (Data center).pdf');
      const testPath = fs.existsSync(realPdfPath)
        ? realPdfPath
        : path.resolve(process.cwd(), 'storage/documents/test_dummy.pdf');

      if (!fs.existsSync(testPath)) {
        fs.mkdirSync(path.dirname(testPath), { recursive: true });
        fs.writeFileSync(testPath, Buffer.from('%PDF-1.4 dummy'));
      }

      const result = await extractTorFromFile(testPath, {
        projectId: '67059199407',
        projectContext: sampleContext,
      });

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.th).toBeTruthy();
      expect(result.requiredTechnologies.length).toBeGreaterThan(0);
      expect(result.extractedQualifications.length).toBeGreaterThan(0);
    });

    it('extracts from Base64-encoded PDF seamlessly', async () => {
      const dummyBase64 = Buffer.from('%PDF-1.4 base64 encoded document').toString('base64');
      const result = await extractTorFromBase64(dummyBase64, {
        fileName: 'Attach_TOR_encoded.pdf',
        projectContext: sampleContext,
      });

      expect(result).toBeDefined();
      expect(result.summary.th).toBeTruthy();
      expect(result.budget).toBe(12500000);
    });
  });
});
