import {
  parseNumericBaht,
  extractCriteriaValue,
  assessRestrictiveClause,
  validateAndEnrichQualifications,
} from '../qualification-validator';
import { ExtractedQualificationItem } from '@/types/project';

describe('qualification-validator', () => {
  describe('parseNumericBaht', () => {
    it('parses direct Thai currency strings', () => {
      expect(parseNumericBaht('5,000,000 บาท')).toBe(5000000);
      expect(parseNumericBaht('10 ล้านบาท')).toBe(10000000);
      expect(parseNumericBaht('2.5 ล้าน')).toBe(2500000);
    });

    it('calculates percentage of budget', () => {
      expect(parseNumericBaht('ร้อยละ 50 ของงบประมาณ', 10000000)).toBe(5000000);
      expect(parseNumericBaht('50%', 20000000)).toBe(10000000);
    });
  });

  describe('extractCriteriaValue', () => {
    it('structures past project value criteria', () => {
      const item: Partial<ExtractedQualificationItem> = {
        category: 'Experience',
        threshold: 'สัญญาเดียว >= 5,000,000 บาท',
        description: { th: 'มีผลงานสัญญาเดียว', en: 'Single contract experience' },
      };
      const res = extractCriteriaValue(item, 10000000);
      expect(res.criteriaType).toBe('past_project_value');
      expect(res.criteriaValue.key).toBe('min_past_project_value');
      expect(res.criteriaValue.numericValue).toBe(5000000);
      expect(res.criteriaValue.value).toBe('5M THB');
    });

    it('structures registered capital criteria', () => {
      const item: Partial<ExtractedQualificationItem> = {
        category: 'Financial',
        threshold: 'ทุนจดทะเบียน >= 10,000,000 บาท',
        description: { th: 'มีทุนจดทะเบียนชำระแล้ว', en: 'Paid-up registered capital' },
      };
      const res = extractCriteriaValue(item, 20000000);
      expect(res.criteriaType).toBe('registered_capital');
      expect(res.criteriaValue.key).toBe('min_registered_capital');
      expect(res.criteriaValue.numericValue).toBe(10000000);
    });

    it('structures personnel experience criteria', () => {
      const item: Partial<ExtractedQualificationItem> = {
        category: 'Technical',
        threshold: 'ประสบการณ์อย่างน้อย 5 ปี',
        description: { th: 'มีบุคลากรผู้เชี่ยวชาญ', en: 'Certified personnel' },
      };
      const res = extractCriteriaValue(item);
      expect(res.criteriaType).toBe('personnel_experience');
      expect(res.criteriaValue.key).toBe('min_personnel_years');
      expect(res.criteriaValue.numericValue).toBe(5);
    });

    it('structures ISO/CMMI certification criteria', () => {
      const item: Partial<ExtractedQualificationItem> = {
        category: 'Technical',
        threshold: 'ISO/IEC 29110 หรือ CMMI Level 3+',
        description: { th: 'มาตรฐานสากล', en: 'International standards' },
      };
      const res = extractCriteriaValue(item);
      expect(res.criteriaType).toBe('certifications');
      expect(res.criteriaValue.key).toBe('required_certifications');
      expect(res.criteriaValue.value).toContain('ISO/IEC 29110');
    });
  });

  describe('assessRestrictiveClause', () => {
    it('flags single contract requirements > 50% of budget as restrictive', () => {
      const item: ExtractedQualificationItem = {
        id: 'qual-exp-high',
        category: 'Experience',
        criteriaType: 'past_project_value',
        criteriaValue: {
          key: 'min_past_project_value',
          value: '8M THB',
          numericValue: 8000000,
        },
        threshold: 'สัญญาเดียว >= 8,000,000 บาท',
        description: { th: 'มีผลงานสัญญาเดียว', en: 'Past project track record' },
        mandatory: true,
      };

      // Project budget is 10M, but requirement asks for 8M (80% > 50%)
      const assessment = assessRestrictiveClause(item, 10000000);
      expect(assessment.isRestrictive).toBe(true);
      expect(assessment.riskLevel).toBe('High');
      expect(assessment.legalReference).toContain('ว 214');
    });

    it('considers normal past project requirements (<= 50%) safe', () => {
      const item: ExtractedQualificationItem = {
        id: 'qual-exp-safe',
        category: 'Experience',
        criteriaType: 'past_project_value',
        criteriaValue: {
          key: 'min_past_project_value',
          value: '4M THB',
          numericValue: 4000000,
        },
        threshold: 'สัญญาเดียว >= 4,000,000 บาท',
        description: { th: 'มีผลงานสัญญาเดียว', en: 'Past project track record' },
        mandatory: true,
      };

      const assessment = assessRestrictiveClause(item, 10000000);
      expect(assessment.isRestrictive).toBe(false);
      expect(assessment.riskLevel).toBe('Safe');
    });

    it('flags proprietary single-vendor certification without equivalent', () => {
      const item: ExtractedQualificationItem = {
        id: 'qual-vendor-lock',
        category: 'Technical',
        criteriaType: 'certifications',
        threshold: 'Cisco Certified Expert เท่านั้น',
        description: { th: 'ต้องมีใบรับรองจาก Cisco เท่านั้น', en: 'Cisco certificate only' },
        mandatory: true,
      };

      const assessment = assessRestrictiveClause(item, 5000000);
      expect(assessment.isRestrictive).toBe(true);
      expect(assessment.riskLevel).toBe('High');
      expect(assessment.flagReason?.th).toContain('ล็อคสเปก');
    });
  });

  describe('validateAndEnrichQualifications', () => {
    it('enriches items with criteria values and identifies restrictive clauses in project', () => {
      const items: ExtractedQualificationItem[] = [
        {
          id: 'qual-1',
          category: 'Legal',
          threshold: 'จดทะเบียนนิติบุคคล >= 2 ปี',
          description: { th: 'เป็นนิติบุคคล', en: 'Legal entity' },
          mandatory: true,
        },
        {
          id: 'qual-2',
          category: 'Experience',
          threshold: 'สัญญาเดียว >= 8,000,000 บาท',
          description: { th: 'ผลงานย้อนหลังสัญญาเดียว', en: 'Single contract' },
          mandatory: true,
        },
        {
          id: 'qual-3',
          category: 'Technical',
          threshold: 'ISO/IEC 29110 หรือเทียบเท่า',
          description: { th: 'มาตรฐานสากล', en: 'Standard' },
          mandatory: false,
        },
      ];

      const summary = validateAndEnrichQualifications(items, 10000000);
      expect(summary.totalClauses).toBe(3);
      expect(summary.mandatoryCount).toBe(2);
      expect(summary.optionalCount).toBe(1);
      expect(summary.restrictiveCount).toBe(1);
      expect(summary.highestRiskLevel).toBe('High');
      expect(summary.items[1].criteriaValue?.key).toBe('min_past_project_value');
      expect(summary.items[1].riskAssessment?.isRestrictive).toBe(true);
    });
  });
});
