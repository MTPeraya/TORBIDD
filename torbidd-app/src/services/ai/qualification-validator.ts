// =============================================================================
// services/ai/qualification-validator.ts
// Validation logic to extract explicit criteria values and flag restrictive
// or high-risk qualification clauses in government TOR documents.
// Based on Thai Procurement Act B.E. 2560 (มาตรา 8) & Comptroller General Circular ว 214
// =============================================================================

import {
  ExtractedQualificationItem,
  QualificationCriteriaType,
  QualificationCriteriaValue,
  RestrictiveClauseAssessment,
} from '@/types/project';

export interface QualificationValidationSummary {
  totalClauses: number;
  mandatoryCount: number;
  optionalCount: number;
  restrictiveCount: number;
  highestRiskLevel: 'Safe' | 'Low' | 'Medium' | 'High';
  riskScore: number; // 0 to 100
  items: ExtractedQualificationItem[];
}

/**
 * Parses numeric currency value from Thai or English string (e.g., "5,000,000 บาท", "5M THB", "ร้อยละ 50")
 */
export function parseNumericBaht(text: string, budget = 0): number | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase().replace(/,/g, '');

  // Percentage of budget (e.g. ร้อยละ 50, 50%, 50% ของงบ)
  const pctMatch = lower.match(/(?:ร้อยละ\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*%)/);
  if (pctMatch && budget > 0) {
    const pct = parseFloat(pctMatch[1] || pctMatch[2]);
    return Math.round((pct / 100) * budget);
  }

  // Millions notation (e.g. 5 ล้านบาท, 5m thb)
  const millionMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:ล้านบาท|ล้าน|m\s*thb|m)/);
  if (millionMatch) {
    return Math.round(parseFloat(millionMatch[1]) * 1000000);
  }

  // Exact number notation (e.g. 5000000 บาท)
  const exactMatch = lower.match(/(\d{6,12})/);
  if (exactMatch) {
    return parseInt(exactMatch[1], 10);
  }

  return undefined;
}

/**
 * Extracts explicit criteria type and normalized criteria values from description/threshold.
 */
export function extractCriteriaValue(
  item: Partial<ExtractedQualificationItem>,
  projectBudget = 0,
): { criteriaType: QualificationCriteriaType; criteriaValue: QualificationCriteriaValue } {
  const descTh = item.description?.th || '';
  const descEn = item.description?.en || '';
  const threshold = item.threshold || '';
  const combined = `${descTh} ${descEn} ${threshold}`.toLowerCase();

  // 1. Past Project Value (ผลงานย้อนหลังสัญญาเดียว)
  if (
    combined.includes('ผลงาน') ||
    combined.includes('past performance') ||
    combined.includes('contract value') ||
    combined.includes('สัญญาเดียว') ||
    item.category === 'Experience'
  ) {
    const val = parseNumericBaht(threshold, projectBudget) || parseNumericBaht(descTh, projectBudget);
    const displayVal = val
      ? `${(val / 1000000).toLocaleString('th-TH', { maximumFractionDigits: 1 })}M THB`
      : threshold || 'N/A';
    return {
      criteriaType: 'past_project_value',
      criteriaValue: {
        key: 'min_past_project_value',
        value: displayVal,
        unit: 'THB',
        numericValue: val,
      },
    };
  }

  // 2. Registered Capital (ทุนจดทะเบียน)
  if (
    combined.includes('ทุนจดทะเบียน') ||
    combined.includes('capital') ||
    combined.includes('paid-up') ||
    item.category === 'Financial'
  ) {
    const val = parseNumericBaht(threshold, projectBudget) || parseNumericBaht(descTh, projectBudget);
    const displayVal = val
      ? `${(val / 1000000).toLocaleString('th-TH', { maximumFractionDigits: 1 })}M THB`
      : threshold || 'N/A';
    return {
      criteriaType: 'registered_capital',
      criteriaValue: {
        key: 'min_registered_capital',
        value: displayVal,
        unit: 'THB',
        numericValue: val,
      },
    };
  }

  // 3. Personnel Experience (ประสบการณ์บุคลากร)
  const yearsMatch = combined.match(/(\d+)\s*(?:ปี|years)/);
  if (
    combined.includes('บุคลากร') ||
    combined.includes('ผู้เชี่ยวชาญ') ||
    combined.includes('personnel') ||
    combined.includes('years of experience')
  ) {
    const years = yearsMatch ? parseInt(yearsMatch[1], 10) : undefined;
    return {
      criteriaType: 'personnel_experience',
      criteriaValue: {
        key: 'min_personnel_years',
        value: years ? `${years} Years` : threshold || 'Qualified Staff',
        unit: 'years',
        numericValue: years,
      },
    };
  }

  // 4. Certifications (ISO / CMMI)
  if (
    combined.includes('iso') ||
    combined.includes('cmmi') ||
    combined.includes('certificate') ||
    combined.includes('มาตรฐาน')
  ) {
    const certs: string[] = [];
    if (combined.includes('29110')) certs.push('ISO/IEC 29110');
    if (combined.includes('27001')) certs.push('ISO/IEC 27001');
    if (combined.includes('9001')) certs.push('ISO 9001');
    if (combined.includes('cmmi')) certs.push('CMMI Level 3+');

    return {
      criteriaType: 'certifications',
      criteriaValue: {
        key: 'required_certifications',
        value: certs.length > 0 ? certs.join(', ') : threshold || 'Certified Standards',
      },
    };
  }

  // 5. Legal Status (สถานะนิติบุคคล)
  return {
    criteriaType: 'legal_status',
    criteriaValue: {
      key: 'legal_compliance',
      value: threshold || 'Registered Juristic Entity',
    },
  };
}

/**
 * Validates a qualification clause and determines if it is restrictive or anti-competitive.
 */
export function assessRestrictiveClause(
  item: ExtractedQualificationItem,
  projectBudget = 0,
): RestrictiveClauseAssessment {
  const descTh = item.description?.th || '';
  const descEn = item.description?.en || '';
  const threshold = item.threshold || '';
  const combined = `${descTh} ${descEn} ${threshold}`.toLowerCase();

  // Rule 1: Single Past Contract Value > 50% of budget (Comptroller General Circular ว 214)
  if (item.criteriaType === 'past_project_value' || item.category === 'Experience') {
    const pastVal = item.criteriaValue?.numericValue || parseNumericBaht(threshold, projectBudget);
    if (pastVal && projectBudget > 0) {
      const ratio = pastVal / projectBudget;
      if (ratio > 0.5) {
        const pct = Math.round(ratio * 100);
        return {
          isRestrictive: true,
          riskLevel: ratio >= 0.7 ? 'High' : 'Medium',
          flagReason: {
            th: `กำหนดมูลค่าผลงานสัญญาเดียวสูงถึง ${pct}% ของงบประมาณ (เกินเกณฑ์แนะนำ 50% ตามหนังสือเวียน ว 214)`,
            en: `Single contract past performance required is ${pct}% of budget (exceeds standard 50% ceiling under Circular W 214)`,
          },
          legalReference: 'หนังสือเวียนกรมบัญชีกลาง ด่วนที่สุด ที่ กค (กวจ) 0405.2/ว 214',
          recommendation: {
            th: 'ควรท้วงติงหรือสอบถามหน่วยงานให้ปรับลดมูลค่าผลงานลงมาไม่เกิน 50% ของงบประมาณเพื่อเปิดกว้างการแข่งขัน',
            en: 'Consider requesting clarification to lower threshold to <= 50% to maintain fair competition',
          },
        };
      }
    }
  }

  // Rule 2: Unreasonably high registered capital (> 20M THB or > 50% of small/medium budget)
  if (item.criteriaType === 'registered_capital' || item.category === 'Financial') {
    const capitalVal = item.criteriaValue?.numericValue || parseNumericBaht(threshold, projectBudget);
    if (capitalVal) {
      const isExtreme = capitalVal > 20000000 && projectBudget < 20000000;
      const isHighRatio = projectBudget > 0 && capitalVal / projectBudget > 0.8;
      if (isExtreme || isHighRatio) {
        return {
          isRestrictive: true,
          riskLevel: 'Medium',
          flagReason: {
            th: `กำหนดทุนจดทะเบียน ${(capitalVal / 1000000).toFixed(0)} ล้านบาท ซึ่งสูงเกินสัดส่วนของมูลค่าโครงการ`,
            en: `Registered capital requirement of ${(capitalVal / 1000000).toFixed(0)}M THB is disproportionate to procurement budget`,
          },
          legalReference: 'พ.ร.บ. การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 มาตรา 8 (ความโปร่งใสและเปิดกว้าง)',
          recommendation: {
            th: 'ตรวจสอบว่าเป็นเงื่อนไขที่กีดกันผู้ประกอบการ SME หรือไม่',
            en: 'Check if this creates unwarranted barriers for SME tech providers',
          },
        };
      }
    }
  }

  // Rule 3: Proprietary single-vendor certifications without "or equivalent"
  const proprietaryKeywords = ['cisco', 'oracle', 'sap', 'microsoft exclusive', 'เฉพาะแบรนด์', 'เฉพาะตัวแทน'];
  for (const kw of proprietaryKeywords) {
    if (combined.includes(kw) && !combined.includes('เทียบเท่า') && !combined.includes('equivalent')) {
      return {
        isRestrictive: true,
        riskLevel: 'High',
        flagReason: {
          th: `ระบุใบรับรองผลิตภัณฑ์เฉพาะเจาะจง (${kw}) โดยไม่มีคำว่า "หรือเทียบเท่า" อาจเข้าข่ายล็อคสเปก`,
          en: `Specifies proprietary vendor certification (${kw}) without allowing equivalent credentials`,
        },
        legalReference: 'พ.ร.บ. การจัดซื้อจัดจ้างฯ พ.ศ. 2560 มาตรา 8 วรรคหนึ่ง (2)',
        recommendation: {
          th: 'ยื่นคำร้องขออุทธรณ์/วิจารณ์ร่าง TOR ให้เพิ่มคำว่า "หรือเทียบเท่า"',
          en: 'Submit public hearing comments to explicitly allow equivalent credentials',
        },
      };
    }
  }

  // Rule 4: Excessive personnel experience requirements (> 10 years)
  if (item.criteriaType === 'personnel_experience') {
    const years = item.criteriaValue?.numericValue;
    if (years && years > 10) {
      return {
        isRestrictive: true,
        riskLevel: 'Low',
        flagReason: {
          th: `กำหนดประสบการณ์บุคลากรสูงถึง ${years} ปี ซึ่งอาจเกินความจำเป็นสำหรับเทคโนโลยีสมัยใหม่`,
          en: `Demands ${years} years personnel experience, which may restrict modern software developers`,
        },
        legalReference: 'แนวทางการกำหนดคุณสมบัติผู้เสนอราคาด้านเทคโนโลยีสารสนเทศภาครัฐ',
        recommendation: {
          th: 'พิจารณาใช้ใบรับรองวิชาชีพหรือผลงานโครงการทดแทนจำนวนปีประสบการณ์',
          en: 'Consider offering professional certifications in lieu of long calendar experience',
        },
      };
    }
  }

  // Default: Safe / Standard qualification
  return {
    isRestrictive: false,
    riskLevel: 'Safe',
  };
}

/**
 * Enriches and validates a complete list of qualification items for a procurement project.
 */
export function validateAndEnrichQualifications(
  qualifications: ExtractedQualificationItem[],
  projectBudget = 0,
): QualificationValidationSummary {
  let restrictiveCount = 0;
  let mandatoryCount = 0;
  let optionalCount = 0;
  let highestRisk: 'Safe' | 'Low' | 'Medium' | 'High' = 'Safe';

  const riskScores: Record<string, number> = {
    Safe: 0,
    Low: 10,
    Medium: 25,
    High: 50,
  };
  let totalRiskScore = 0;

  const enrichedItems = qualifications.map((q) => {
    // 1. Extract explicit criteria values
    const { criteriaType, criteriaValue } = extractCriteriaValue(q, projectBudget);

    const mergedItem: ExtractedQualificationItem = {
      ...q,
      criteriaType: q.criteriaType || criteriaType,
      criteriaValue: q.criteriaValue || criteriaValue,
    };

    // 2. Assess restrictive clause risk
    const assessment = q.riskAssessment || assessRestrictiveClause(mergedItem, projectBudget);
    mergedItem.riskAssessment = assessment;

    if (mergedItem.mandatory) mandatoryCount++;
    else optionalCount++;

    if (assessment.isRestrictive) {
      restrictiveCount++;
      totalRiskScore += riskScores[assessment.riskLevel] || 0;

      if (assessment.riskLevel === 'High') {
        highestRisk = 'High';
      } else if (assessment.riskLevel === 'Medium' && highestRisk !== 'High') {
        highestRisk = 'Medium';
      } else if (assessment.riskLevel === 'Low' && highestRisk === 'Safe') {
        highestRisk = 'Low';
      }
    }

    return mergedItem;
  });

  return {
    totalClauses: enrichedItems.length,
    mandatoryCount,
    optionalCount,
    restrictiveCount,
    highestRiskLevel: highestRisk,
    riskScore: Math.min(100, totalRiskScore),
    items: enrichedItems,
  };
}
