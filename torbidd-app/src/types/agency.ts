// =============================================================================
// types/agency.ts - Government Agency / Department Types & Reference Data
// (Supports Issue #149: Government Agency Filter)
// =============================================================================

export interface Agency {
  id: string;
  name: {
    th: string;
    en: string;
  };
  shortName?: {
    th: string;
    en: string;
  };
  code?: string;
}

export const BANGKOK_AGENCIES: Agency[] = [
  {
    id: 'dept-strategy',
    code: 'BMA-SED',
    name: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Dept.',
    },
    shortName: { th: 'สยป.', en: 'SED' },
  },
  {
    id: 'dept-education',
    code: 'BMA-EDU',
    name: {
      th: 'สำนักการศึกษา',
      en: 'Education Dept.',
    },
    shortName: { th: 'สนศ.', en: 'EDU' },
  },
  {
    id: 'dept-environment',
    code: 'BMA-ENV',
    name: {
      th: 'สำนักสิ่งแวดล้อม',
      en: 'Environment Dept.',
    },
    shortName: { th: 'สสิ่งแวดล้อม', en: 'ENV' },
  },
  {
    id: 'dept-culture-sports',
    code: 'BMA-CST',
    name: {
      th: 'สำนักวัฒนธรรม กีฬา และการท่องเที่ยว',
      en: 'Culture, Sports & Tourism Dept.',
    },
    shortName: { th: 'สวค.', en: 'CST' },
  },
  {
    id: 'dept-health',
    code: 'BMA-HLT',
    name: {
      th: 'สำนักอนามัย',
      en: 'Health Dept.',
    },
    shortName: { th: 'สนอ.', en: 'HLT' },
  },
  {
    id: 'dept-medical',
    code: 'BMA-MED',
    name: {
      th: 'สำนักการแพทย์',
      en: 'Medical Services Dept.',
    },
    shortName: { th: 'สนพ.', en: 'MED' },
  },
  {
    id: 'dept-social',
    code: 'BMA-SOC',
    name: {
      th: 'สำนักพัฒนาสังคม',
      en: 'Social Development Dept.',
    },
    shortName: { th: 'สพส.', en: 'SOC' },
  },
  {
    id: 'dept-finance',
    code: 'BMA-FIN',
    name: {
      th: 'สำนักการคลัง',
      en: 'Finance Dept.',
    },
    shortName: { th: 'สนค.', en: 'FIN' },
  },
  {
    id: 'dept-traffic',
    code: 'BMA-TRF',
    name: {
      th: 'สำนักการจราจรและขนส่ง',
      en: 'Traffic and Transport Dept.',
    },
    shortName: { th: 'สจส.', en: 'TRF' },
  },
];

/**
 * Normalizes agency identifier or text (Thai name, English name, or ID)
 */
export function matchesAgency(
  agencyValue: { th: string; en: string },
  candidate: string,
): boolean {
  const normCand = candidate.trim().toLowerCase();
  const normTh = agencyValue.th.toLowerCase();
  const normEn = agencyValue.en.toLowerCase();

  return (
    normTh === normCand ||
    normEn === normCand ||
    normTh.includes(normCand) ||
    normEn.includes(normCand) ||
    candidate.includes(agencyValue.th) ||
    candidate.includes(agencyValue.en)
  );
}
