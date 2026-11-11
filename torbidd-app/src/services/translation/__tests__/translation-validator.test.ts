// =============================================================================
// services/translation/__tests__/translation-validator.test.ts
// Unit tests for TranslationValidator quality validation
// =============================================================================

import {
  TranslationValidator,
} from '../translation-validator';

describe('TranslationValidator', () => {
  describe('Valid English output', () => {
    it('accepts standard English translation for Thai source', () => {
      const source = 'โครงการพัฒนาระบบคลาวด์ กทม.';
      const translation = 'BMA Cloud System Development Project';

      const result = TranslationValidator.validate(source, translation);

      expect(result.isValid).toBe(true);
      expect(result.code).toBe('OK');
    });

    it('accepts English translations containing numbers, punctuation, and symbols', () => {
      const source = 'จ้างติดตั้งระบบเครือข่ายความเร็วสูง 100 Gbps งบประมาณ 12,500,000 บาท';
      const translation =
        'Procurement of high-speed 100 Gbps network system, budget: 12,500,000 Baht.';

      const result = TranslationValidator.validate(source, translation);

      expect(result.isValid).toBe(true);
      expect(result.code).toBe('OK');
    });

    it('accepts technical IT and software procurement specifications in English', () => {
      const source = 'จัดซื้อลิขสิทธิ์ซอฟต์แวร์ VMware vSphere และ Red Hat OpenShift Enterprise';
      const translation =
        'Procurement of VMware vSphere and Red Hat OpenShift Enterprise software licenses';

      const result = TranslationValidator.validate(source, translation);

      expect(result.isValid).toBe(true);
      expect(result.code).toBe('OK');
    });

    it('accepts mixed Thai-English source translated to clean English', () => {
      const source = 'พัฒนาระบบ Big Data Analytics และ AI สำหรับ Smart City กรุงเทพมหานคร';
      const translation =
        'Development of Big Data Analytics and AI system for Bangkok Smart City';

      const result = TranslationValidator.validate(source, translation);

      expect(result.isValid).toBe(true);
      expect(result.code).toBe('OK');
      expect(result.thaiRatio).toBe(0);
    });

    it('accepts English-only source text retaining identical English output', () => {
      const source = 'Cisco Catalyst 9300 48-port PoE+ Switch';
      const translation = 'Cisco Catalyst 9300 48-port PoE+ Switch';

      const result = TranslationValidator.validate(source, translation, {
        allowIdenticalIfNoThai: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.code).toBe('OK');
    });
  });

  describe('Unchanged Thai text rejection', () => {
    it('rejects translation when translated text is identical to Thai source', () => {
      const source = 'โครงการจ้างที่ปรึกษาพัฒนาระบบสารสนเทศ';
      const translation = 'โครงการจ้างที่ปรึกษาพัฒนาระบบสารสนเทศ';

      const result = TranslationValidator.validate(source, translation);

      expect(result.isValid).toBe(false);
      expect(result.code).toBe('UNCHANGED_THAI');
      expect(result.reason).toContain('identical to Thai source text');
    });

    it('rejects translation when text differs only by whitespace', () => {
      const source = 'สำนักการจราจรและขนส่ง';
      const translation = '   สำนักการจราจรและขนส่ง   ';

      const result = TranslationValidator.validate(source, translation);

      expect(result.isValid).toBe(false);
      expect(result.code).toBe('UNCHANGED_THAI');
    });

    it('rejects translation when translated output remains predominantly Thai characters', () => {
      const source = 'โครงการพัฒนาระบบคลาวด์และดาต้าเซ็นเตอร์';
      const translation = 'โครงการพัฒนาระบบคลาวด์ (Cloud System)'; // Mostly Thai characters

      const result = TranslationValidator.validate(source, translation, {
        maxThaiRatio: 0.2,
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe('UNCHANGED_THAI');
      expect(result.reason).toContain('excessive Thai characters');
      expect(result.thaiRatio).toBeGreaterThan(0.2);
    });
  });

  describe('Empty and whitespace results', () => {
    it('rejects empty string translation', () => {
      const source = 'ระบบสารสนเทศ';
      const translation = '';

      const result = TranslationValidator.validate(source, translation);

      expect(result.isValid).toBe(false);
      expect(result.code).toBe('EMPTY_TRANSLATION');
      expect(result.reason).toContain('empty');
    });

    it('rejects whitespace-only translation', () => {
      const source = 'ระบบสารสนเทศ';
      const translation = '   \t  \n  ';

      const result = TranslationValidator.validate(source, translation);

      expect(result.isValid).toBe(false);
      expect(result.code).toBe('EMPTY_TRANSLATION');
    });

    it('rejects null or undefined translation', () => {
      const source = 'ระบบสารสนเทศ';

      expect(TranslationValidator.validate(source, null).isValid).toBe(false);
      expect(TranslationValidator.validate(source, null).code).toBe('EMPTY_TRANSLATION');

      expect(TranslationValidator.validate(source, undefined).isValid).toBe(false);
      expect(TranslationValidator.validate(source, undefined).code).toBe('EMPTY_TRANSLATION');
    });

    it('rejects non-string translation types safely', () => {
      const source = 'ระบบสารสนเทศ';

      expect(TranslationValidator.validate(source, 12345).isValid).toBe(false);
      expect(TranslationValidator.validate(source, {}).isValid).toBe(false);
      expect(TranslationValidator.validate(source, []).isValid).toBe(false);
    });
  });

  describe('Malformed translations', () => {
    const errorKeywords = ['undefined', 'null', '[ERROR]', 'error', 'N/A', 'NaN', '[object Object]'];

    errorKeywords.forEach((token) => {
      it(`rejects placeholder or error token: "${token}"`, () => {
        const source = 'โครงการทดสอบ';
        const result = TranslationValidator.validate(source, token);

        expect(result.isValid).toBe(false);
        expect(result.code).toBe('MALFORMED');
        expect(result.reason).toContain('error token');
      });
    });

    it('rejects translations consisting solely of punctuation marks', () => {
      const source = 'โครงการจัดซื้ออุปกรณ์ไอที';
      const punctuationOutputs = ['...', '---', '???', '.,;:!?', '---/---'];

      punctuationOutputs.forEach((punct) => {
        const result = TranslationValidator.validate(source, punct);
        expect(result.isValid).toBe(false);
        expect(result.code).toBe('MALFORMED');
        expect(result.reason).toContain('only punctuation');
      });
    });
  });

  describe('Missing source fields safety', () => {
    it('safely rejects null, undefined, and empty source text without throwing', () => {
      const inputs = [null, undefined, '', '   ', 0, false, {}];

      inputs.forEach((invalidSource) => {
        const result = TranslationValidator.validate(invalidSource, 'Valid English Translation');
        expect(result.isValid).toBe(false);
        expect(result.code).toBe('MISSING_SOURCE');
      });
    });

    it('safely handles both source and translation being empty', () => {
      const result = TranslationValidator.validate('', '');
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('MISSING_SOURCE');
    });
  });

  describe('Edge cases: Unicode, formatting, and helper methods', () => {
    it('detects Thai characters correctly with containsThai', () => {
      expect(TranslationValidator.containsThai('สวัสดี')).toBe(true);
      expect(TranslationValidator.containsThai('Hello สวัสดี')).toBe(true);
      expect(TranslationValidator.containsThai('Hello World 123')).toBe(false);
      expect(TranslationValidator.containsThai(null)).toBe(false);
      expect(TranslationValidator.containsThai('')).toBe(false);
    });

    it('calculates Thai character ratio accurately with getThaiRatio', () => {
      const allThai = 'กขคง';
      expect(TranslationValidator.getThaiRatio(allThai)).toBe(1.0);

      const mixed = 'กขAB';
      expect(TranslationValidator.getThaiRatio(mixed)).toBe(0.5);

      const allEnglish = 'ABCD 1234';
      expect(TranslationValidator.getThaiRatio(allEnglish)).toBe(0.0);

      expect(TranslationValidator.getThaiRatio('')).toBe(0.0);
      expect(TranslationValidator.getThaiRatio(null)).toBe(0.0);
    });

    it('handles Thai Unicode tone marks and vowel signs gracefully', () => {
      const source = 'น้ำดื่มสะอาดเพื่อสุขภาพ';
      const translation = 'Clean drinking water for good health';

      const result = TranslationValidator.validate(source, translation);
      expect(result.isValid).toBe(true);
      expect(result.code).toBe('OK');
    });

    it('handles special typography symbols (quotes, em-dashes, bullets) properly', () => {
      const source = '“โครงการพัฒนาระบบ AI — เฟส 1” • กรุงเทพมหานคร';
      const translation = '“AI System Development Project — Phase 1” • Bangkok';

      const result = TranslationValidator.validate(source, translation);
      expect(result.isValid).toBe(true);
      expect(result.code).toBe('OK');
    });

    it('correctly validates a batch of translation entries with validateBatch', () => {
      const batchEntries = [
        {
          field: 'title',
          source: 'โครงการพัฒนาระบบคลาวด์',
          translation: 'Cloud System Development Project',
        },
        {
          field: 'department',
          source: 'สำนักการระบายน้ำ',
          translation: 'สำนักการระบายน้ำ', // Unchanged Thai
        },
        {
          field: 'description',
          source: 'ระบบตรวจวัดน้ำท่วม',
          translation: '', // Empty
        },
      ];

      const batchResults = TranslationValidator.validateBatch(batchEntries);

      expect(batchResults.title.isValid).toBe(true);
      expect(batchResults.title.code).toBe('OK');

      expect(batchResults.department.isValid).toBe(false);
      expect(batchResults.department.code).toBe('UNCHANGED_THAI');

      expect(batchResults.description.isValid).toBe(false);
      expect(batchResults.description.code).toBe('EMPTY_TRANSLATION');
    });
  });
});
