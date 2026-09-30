/**
 * @jest-environment node
 */
// =============================================================================
// services/transformation/__tests__/tech-taxonomy.test.ts
// Unit tests for Tech Stack Taxonomy & Normalization Pipeline (Issue #89)
// =============================================================================

import {
  normalizeTechTag,
  normalizeTechList,
  categorizeTechnicalRequirement,
  extractTechEntitiesFromText,
} from '../taxonomy/tech-taxonomy';

describe('Tech Stack Taxonomy & Normalization Pipeline', () => {
  describe('normalizeTechTag', () => {
    it('maps "Postgres DB", "PostgreSQL", and "psql" to canonical "PostgreSQL" (Backend)', () => {
      const tag1 = normalizeTechTag('Postgres DB');
      const tag2 = normalizeTechTag('postgresql');
      const tag3 = normalizeTechTag('psql');

      expect(tag1.name).toBe('PostgreSQL');
      expect(tag1.category).toBe('Backend');

      expect(tag2.name).toBe('PostgreSQL');
      expect(tag2.category).toBe('Backend');

      expect(tag3.name).toBe('PostgreSQL');
      expect(tag3.category).toBe('Backend');
    });

    it('maps "k8s" and "kubernetes" to canonical "Kubernetes" (Infra)', () => {
      const tag = normalizeTechTag('k8s');
      expect(tag.name).toBe('Kubernetes');
      expect(tag.category).toBe('Infra');
    });

    it('maps "React.js" and "reactjs" to canonical "React" (Frontend)', () => {
      const tag = normalizeTechTag('React.js');
      expect(tag.name).toBe('React');
      expect(tag.category).toBe('Frontend');
    });

    it('maps "PDPA" to canonical "PDPA Compliance" (Security)', () => {
      const tag = normalizeTechTag('PDPA');
      expect(tag.name).toBe('PDPA Compliance');
      expect(tag.category).toBe('Security');
    });
  });

  describe('normalizeTechList', () => {
    it('deduplicates synonymous tech tags across categories', () => {
      const rawList = [
        'Postgres DB',
        'PostgreSQL',
        'React',
        'React.js',
        'Docker',
        'k8s',
        'ISO 27001',
      ];

      const normalized = normalizeTechList(rawList);

      const names = normalized.map((t) => t.name);
      expect(names).toContain('PostgreSQL');
      expect(names).toContain('React');
      expect(names).toContain('Docker & Containers');
      expect(names).toContain('Kubernetes');
      expect(names).toContain('ISO/IEC 27001');

      // Should only have 1 entry for PostgreSQL and 1 for React
      expect(names.filter((n) => n === 'PostgreSQL')).toHaveLength(1);
      expect(names.filter((n) => n === 'React')).toHaveLength(1);
    });
  });

  describe('categorizeTechnicalRequirement', () => {
    it('categorizes security requirements correctly', () => {
      const cat = categorizeTechnicalRequirement(
        'การจัดเก็บข้อมูลต้องสอดคล้องตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
      );
      expect(cat).toBe('Security');
    });

    it('categorizes infrastructure requirements correctly', () => {
      const cat = categorizeTechnicalRequirement(
        'ระบบศูนย์ข้อมูลต้องรองรับมาตรฐาน Tier III และมีระบบสำรองไฟฟ้า UPS',
      );
      expect(cat).toBe('Infra');
    });

    it('categorizes frontend requirements correctly', () => {
      const cat = categorizeTechnicalRequirement(
        'หน้าจอเว็บและโมบายแอปพลิเคชันต้องรองรับการแสดงผลแบบ Responsive UI/UX',
      );
      expect(cat).toBe('Frontend');
    });

    it('categorizes backend/api requirements correctly', () => {
      const cat = categorizeTechnicalRequirement(
        'เชื่อมต่อระบบผ่าน RESTful API Gateway ตามมาตรฐาน OpenAPI',
      );
      expect(cat).toBe('Backend');
    });
  });

  describe('extractTechEntitiesFromText', () => {
    it('scans raw procurement text and detects tech stack entities', () => {
      const text = `
        โครงการจัดซื้อและพัฒนาระบบคลาวด์ศูนย์ข้อมูล ผู้รับจ้างต้องติดตั้งระบบด้วย Docker และ Kubernetes
        พร้อมฐานข้อมูล PostgreSQL รองรับการเชื่อมต่อผ่าน REST API และผ่านการรับรอง ISO 27001
      `;

      const entities = extractTechEntitiesFromText(text);
      const names = entities.map((e) => e.name);

      expect(names).toContain('Docker & Containers');
      expect(names).toContain('Kubernetes');
      expect(names).toContain('PostgreSQL');
      expect(names).toContain('REST API');
      expect(names).toContain('ISO/IEC 27001');
    });
  });
});
