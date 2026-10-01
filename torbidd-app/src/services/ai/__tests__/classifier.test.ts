// =============================================================================
// services/ai/__tests__/classifier.test.ts
// UC-10: Unit tests for the procurement classification service
// =============================================================================

import {
  classifyByKeywords,
  SOFTWARE_CATEGORIES,
  ClassificationResult,
} from '../classifier';

describe('UC-10 Classifier', () => {
  // ── SOFTWARE_CATEGORIES constant ─────────────────────────────────────────
  describe('SOFTWARE_CATEGORIES', () => {
    it('should contain exactly 8 categories', () => {
      expect(SOFTWARE_CATEGORIES).toHaveLength(8);
    });

    it('should include all UC-10 required categories', () => {
      const required = ['Website', 'Mobile App', 'AI', 'Database', 'ERP', 'Cloud', 'Data Analytics', 'Information System'];
      for (const cat of required) {
        expect(SOFTWARE_CATEGORIES).toContain(cat);
      }
    });
  });

  // ── Keyword-based fallback classifier ────────────────────────────────────
  describe('classifyByKeywords()', () => {
    const expectValidResult = (result: ClassificationResult) => {
      expect(SOFTWARE_CATEGORIES).toContain(result.category);
      expect(typeof result.isSoftwareRelated).toBe('boolean');
      expect(['High', 'Medium', 'Low']).toContain(result.confidence);
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(0);
    };

    // ── Website ─────────────────────────────────────────────────────────────
    it('classifies website projects correctly', () => {
      const result = classifyByKeywords(
        'Development of BMA e-Government Portal',
        'Create a web portal for online government services and document submissions',
      );
      expect(result.category).toBe('Website');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    // ── Mobile App ───────────────────────────────────────────────────────────
    it('classifies mobile app projects correctly', () => {
      const result = classifyByKeywords(
        'BMA Mobile Application Development',
        'Development of iOS and Android application for Bangkok Metropolitan Administration services',
      );
      expect(result.category).toBe('Mobile App');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    // ── AI / GIS ─────────────────────────────────────────────────────────────
    it('classifies AI projects correctly', () => {
      const result = classifyByKeywords(
        'GIS Mapping System for Urban Planning',
        'Artificial intelligence based geographic information system with machine learning capabilities',
      );
      expect(result.category).toBe('AI');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    // ── ERP ──────────────────────────────────────────────────────────────────
    it('classifies ERP projects correctly', () => {
      const result = classifyByKeywords(
        'HR and Payroll Management System',
        'Enterprise resource planning system for human resource management and payroll processing',
      );
      expect(result.category).toBe('ERP');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    // ── Cloud ─────────────────────────────────────────────────────────────────
    it('classifies cloud infrastructure projects correctly', () => {
      const result = classifyByKeywords(
        'Cloud IaaS Platform Migration',
        'Cloud computing platform migration to AWS with kubernetes and docker container orchestration for microservices',
      );
      expect(result.category).toBe('Cloud');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    // ── Data Analytics ────────────────────────────────────────────────────────
    it('classifies data analytics projects correctly', () => {
      const result = classifyByKeywords(
        'Business Intelligence Dashboard',
        'Data analytics platform with data warehouse, ETL pipelines and BI dashboards for big data reporting',
      );
      expect(result.category).toBe('Data Analytics');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    // ── Information System ────────────────────────────────────────────────────
    it('classifies information systems correctly', () => {
      const result = classifyByKeywords(
        'Document Management and Registration System',
        'MIS information system for document management and citizen registration tracking',
      );
      expect(result.category).toBe('Information System');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    // ── Database ─────────────────────────────────────────────────────────────
    it('classifies database projects correctly', () => {
      const result = classifyByKeywords(
        'Database and Server Infrastructure Procurement',
        'PostgreSQL database server infrastructure and backup storage procurement for government data center operations',
      );
      expect(result.category).toBe('Database');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    // ── Non-software ──────────────────────────────────────────────────────────
    it('identifies non-software projects', () => {
      const result = classifyByKeywords(
        'Road Construction and Maintenance',
        'Road infrastructure construction and renovation for Bangkok metropolitan district',
      );
      expect(result.isSoftwareRelated).toBe(false);
      expectValidResult(result);
    });

    it('identifies furniture/equipment as non-software', () => {
      const result = classifyByKeywords(
        'Office Furniture Procurement',
        'Procurement of furniture and equipment for government office renovation',
      );
      expect(result.isSoftwareRelated).toBe(false);
      expectValidResult(result);
    });

    // ── Thai language ─────────────────────────────────────────────────────────
    it('handles Thai language project descriptions', () => {
      const result = classifyByKeywords(
        'พัฒนาแอปพลิเคชันมือถือสำหรับประชาชน',
        'พัฒนาแอปพลิเคชันบนสมาร์ทโฟนเพื่อให้บริการประชาชนในกรุงเทพมหานคร',
      );
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    it('handles Thai AI/GIS projects', () => {
      const result = classifyByKeywords(
        'ระบบจีไอเอสและปัญญาประดิษฐ์',
        'ระบบแผนที่จีไอเอสที่ใช้ปัญญาประดิษฐ์สำหรับการวางแผนเมือง',
      );
      expect(result.category).toBe('AI');
      expect(result.isSoftwareRelated).toBe(true);
      expectValidResult(result);
    });

    it('identifies van rental and vehicle charter as non-software even when software contest is mentioned', () => {
      const result = classifyByKeywords(
        'จ้างเหมารถตู้ไป-กลับ จากโรงเรียนสะเดาขรรค์ชัย ฯ ถึงมหาวิทยาวลัยลักษณ์ จังหวัดนครศรีธรรมราช (เพื่อนำเสนอผลงานการประกวดโครงงานพัฒนาซอฟต์แวร์คอมพิวเตอร์งานสัปดาห์วิทยาศาสตร์แห่งชาติ วันที่ 23 สิงหาคม 2569 โดยใช้รถจำนวน 1 คัน หมายเลขทะเบียน นค 4466 สงขลา โดยวิธีเฉพาะเจาะจง',
        'จ้างเหมารถตู้สำหรับการเดินทาง',
      );
      expect(result.isSoftwareRelated).toBe(false);
      expect(result.reasoning).toContain('matched non-software term');
      expectValidResult(result);
    });

    it('identifies off-the-shelf AutoCAD license rental as non-software and not AI', () => {
      const result = classifyByKeywords(
        'เช่าโปรแกรม AutoCAD ซอฟต์แวร์ออกแบบ เป็นเวลา ๑ ปี โดยวิธีเฉพาะเจาะจง',
        'เช่าใช้งานลิขสิทธิ์ AutoCAD รายปี',
      );
      expect(result.isSoftwareRelated).toBe(false);
      expect(result.category).not.toBe('AI');
      expect(result.reasoning).not.toContain('found for "AI"');
      expectValidResult(result);
    });

    it('classifies general software without category keywords as Information System with clean reasoning', () => {
      const result = classifyByKeywords(
        'จ้างพัฒนาระบบซอฟต์แวร์เพื่อการบริหารจัดการข้อมูลกลาง',
        'พัฒนาระบบซอฟต์แวร์',
      );
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.category).toBe('Information System');
      expect(result.reasoning).not.toContain('AI');
      expect(result.reasoning).toContain('General software procurement classified as Information System');
      expectValidResult(result);
    });

    // ── Confidence levels ─────────────────────────────────────────────────────
    it('returns Low confidence for ambiguous projects', () => {
      const result = classifyByKeywords('Project XYZ', 'General project description');
      expect(result.confidence).toBe('Low');
    });

    it('returns Medium confidence for single keyword match', () => {
      const result = classifyByKeywords(
        'Website procurement',
        'General description without many matching terms',
      );
      expect(result.confidence).toBe('Medium');
    });

    it('returns High confidence for multiple keyword matches', () => {
      // Uses 3+ unambiguous database keywords: 'database', 'postgresql', 'backup', 'storage'
      const result = classifyByKeywords(
        'Database PostgreSQL Storage',
        'PostgreSQL database backup storage procurement for data center operations with sql server configuration',
      );
      expect(result.confidence).toBe('High');
    });
  });
});

