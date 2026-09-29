import { ProjectCreateSchema, ProjectUpdateSchema } from '../validation';

describe('Admin Validation Schemas', () => {
  describe('ProjectCreateSchema', () => {
    it('accepts a valid full project object', () => {
      const validProject = {
        title: { th: 'โครงการระบบคลาวด์', en: 'BMA Cloud Project' },
        department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy Dept' },
        budget: 12000000,
        publishDate: '2026-09-01',
        deadline: '2026-10-01',
        category: 'Database',
        procurementType: 'e-Bidding',
        description: { th: 'รายละเอียดไทย', en: 'English description' },
        scope: {
          th: ['ติดตั้งเซิร์ฟเวอร์', 'เชื่อมต่อระบบ'],
          en: ['Install servers', 'Connect systems'],
        },
        qualifications: {
          th: ['จดทะเบียนในไทย'],
          en: ['Registered in Thailand'],
        },
        aiConfidence: 'High',
      };

      const result = ProjectCreateSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it('rejects missing bilingual title', () => {
      const invalid = {
        title: { th: 'ไทยอย่างเดียว' }, // missing en
        department: { th: 'สำนัก', en: 'Dept' },
        budget: 5000000,
        publishDate: '2026-09-01',
        deadline: '2026-10-01',
        category: 'Website',
        procurementType: 'e-Bidding',
        description: { th: 'ไทย', en: 'EN' },
        scope: { th: ['งาน'], en: ['Work'] },
        qualifications: { th: ['คุณสมบัติ'], en: ['Qual'] },
      };

      const result = ProjectCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects negative budget', () => {
      const invalid = {
        title: { th: 'โครงการ', en: 'Project' },
        department: { th: 'สำนัก', en: 'Dept' },
        budget: -1000,
        publishDate: '2026-09-01',
        deadline: '2026-10-01',
        category: 'Website',
        procurementType: 'e-Bidding',
        description: { th: 'ไทย', en: 'EN' },
        scope: { th: ['งาน'], en: ['Work'] },
        qualifications: { th: ['คุณสมบัติ'], en: ['Qual'] },
      };

      const result = ProjectCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid category', () => {
      const invalid = {
        title: { th: 'โครงการ', en: 'Project' },
        department: { th: 'สำนัก', en: 'Dept' },
        budget: 5000000,
        publishDate: '2026-09-01',
        deadline: '2026-10-01',
        category: 'HardwareServer',
        procurementType: 'e-Bidding',
        description: { th: 'ไทย', en: 'EN' },
        scope: { th: ['งาน'], en: ['Work'] },
        qualifications: { th: ['คุณสมบัติ'], en: ['Qual'] },
      };

      const result = ProjectCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('ProjectUpdateSchema', () => {
    it('accepts partial update payload', () => {
      const partialUpdate = {
        budget: 18500000,
        aiConfidence: 'Medium',
      };

      const result = ProjectUpdateSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('accepts title update only', () => {
      const titleUpdate = {
        title: { th: 'ชื่อใหม่', en: 'New Title' },
      };

      const result = ProjectUpdateSchema.safeParse(titleUpdate);
      expect(result.success).toBe(true);
    });
  });
});
