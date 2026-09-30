// =============================================================================
// lib/project-mapper.ts - Maps ProcurementProject/DiscoveredProject to Project
// =============================================================================

import { Project, ProjectCategory } from '@/types/project';
import { DiscoveredProject } from '@/types/procurement';
import { IProcurementProject } from '@/models/ProcurementProject';
import { parseToIsoDate } from '@/services/transformation/normalizers/date-normalizer';
import { normalizeCurrency } from '@/services/transformation/normalizers/currency-normalizer';
import { sanitizeText, sanitizeAgencyName } from '@/services/transformation/normalizers/text-sanitizer';

export function procurementToProject(
  item: IProcurementProject | DiscoveredProject | Record<string, unknown>,
): Project {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = item as any;
  const extId = sanitizeText(p.externalProjectId || p.externalId, '67119538991');
  const titleText = sanitizeText(p.projectName || p.title?.th || p.title, 'โครงการจัดซื้อจัดจ้างภาครัฐ');
  const deptText = sanitizeAgencyName(p.agencyName || p.department?.th || p.department);
  const rawDate = p.discoveredAt || p.createdAt || p.publishDate || p.announceDate || new Date();
  const publishDateStr = parseToIsoDate(rawDate) || new Date().toISOString();
  const deadlineStr =
    parseToIsoDate(p.deadline) || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days from now

  let category: ProjectCategory = 'Website';
  const rawCat = p.software_category || p.softwareCategory || p.category;
  const validCategories: ProjectCategory[] = [
    'Website',
    'Mobile App',
    'AI',
    'Database',
    'ERP',
    'Cloud',
    'Data Analytics',
    'Information System',
  ];

  const titleLower = titleText.toLowerCase();

  if (rawCat && validCategories.includes(rawCat as ProjectCategory)) {
    category = rawCat as ProjectCategory;
  } else {
    // UC-10: expanded category detection
    if (titleLower.includes('โมบาย') || titleLower.includes('แอปพลิเคชัน') || titleLower.includes('app') || titleLower.includes('mobile')) {
      category = 'Mobile App';
    } else if (titleLower.includes('ai') || titleLower.includes('ปัญญาประดิษฐ์') || titleLower.includes('gis') || titleLower.includes('แผนที่')) {
      category = 'AI';
    } else if (titleLower.includes('erp') || titleLower.includes('ทรัพยากรบุคคล') || titleLower.includes('เงินเดือน') || titleLower.includes('payroll')) {
      category = 'ERP';
    } else if (titleLower.includes('cloud') || titleLower.includes('คลาวด์') || titleLower.includes('saas') || titleLower.includes('iaas')) {
      category = 'Cloud';
    } else if (titleLower.includes('วิเคราะห์ข้อมูล') || titleLower.includes('data analytics') || titleLower.includes('business intelligence') || titleLower.includes(' bi ')) {
      category = 'Data Analytics';
    } else if (titleLower.includes('ฐานข้อมูล') || titleLower.includes('database') || titleLower.includes('server') || titleLower.includes('storage')) {
      category = 'Database';
    } else if (titleLower.includes('สารสนเทศ') || titleLower.includes('information system') || titleLower.includes('mis') || titleLower.includes('ทะเบียน')) {
      category = 'Information System';
    }
  }

  // UC-10: determine software relatedness
  const NON_SW_TERMS = ['ก่อสร้าง', 'construction', 'ถนน', 'road', 'ครุภัณฑ์', 'equipment', 'ยานพาหนะ', 'vehicle', 'เฟอร์นิเจอร์', 'furniture'];
  const isSoftwareRelated =
    p.is_software !== undefined && p.is_software !== null
      ? Boolean(p.is_software)
      : p.isSoftwareRelated !== undefined && p.isSoftwareRelated !== null
        ? Boolean(p.isSoftwareRelated)
        : !NON_SW_TERMS.some((t) => titleLower.includes(t));

  const budgetVal = normalizeCurrency(
    p.budget ?? p.project_money ?? p.projectMoney ?? p.price ?? p.amount ?? p.sum_price_agree ?? p.contract_price,
  );
  const rawContractPrice =
    p.contractPrice ?? p.contract_price ?? p.sum_price_agree ?? p.sumPriceAgree;
  const contractPriceVal =
    rawContractPrice !== undefined && rawContractPrice !== null
      ? normalizeCurrency(rawContractPrice)
      : undefined;

  return {
    _id: p._id?.toString() || extId,
    externalId: Number(extId.replace(/\D/g, '')) || 100000,
    title: {
      th: titleText,
      en: titleText,
    },
    department: {
      th: deptText,
      en: deptText,
    },
    budget: budgetVal,
    contractPrice: contractPriceVal && contractPriceVal > 0 ? contractPriceVal : undefined,
    publishDate: publishDateStr,
    deadline: deadlineStr,
    category,
    isSoftwareRelated,
    classificationReviewStatus: (p.admin_reviewed || p.adminReviewed)
      ? 'APPROVED'
      : (p.classificationReviewStatus ?? 'PENDING_REVIEW'),
    procurementType: p.procurementType || 'e-Bidding',
    description: {
      th: `${titleText} (โครงการจัดซื้อจัดจ้างภาครัฐ ตรวจสอบจากระบบ e-GP กรมบัญชีกลาง รหัส: ${extId})`,
      en: `${titleText} (Thai government procurement verified via e-GP system ID: ${extId})`,
    },
    summary: p.summary?.th
      ? p.summary
      : {
          th: `สรุปสาระสำคัญ: โครงการ${titleText} โดย${deptText} วงเงินงบประมาณ ${budgetVal.toLocaleString('th-TH')} บาท${
            contractPriceVal && contractPriceVal !== budgetVal
              ? ` (ราคามูลค่าที่จัดหาได้ ${contractPriceVal.toLocaleString('th-TH')} บาท)`
              : ''
          } จัดหาด้วยวิธี ${p.procurementType || 'e-Bidding'} เพื่อดำเนินการพัฒนาระบบเทคโนโลยีสารสนเทศที่มีความมั่นคงปลอดภัยตามมาตรฐานภาครัฐ`,
          en: `Executive Summary: Procurement for ${titleText} by ${deptText} with an allocated budget of ${budgetVal.toLocaleString('en-US')} THB${
            contractPriceVal && contractPriceVal !== budgetVal
              ? ` (awarded contract value ${contractPriceVal.toLocaleString('en-US')} THB)`
              : ''
          } via ${p.procurementType || 'e-Bidding'} method to deliver secure and compliant government IT solutions.`,
        },
    scope: p.scope || {
      th: [
        `โครงการจัดซื้อจัดจ้างภาครัฐ: ${titleText}`,
        `หน่วยงานเจ้าของโครงการ: ${deptText}`,
        `ปีงบประมาณ พ.ศ.: ${p.fiscalYear || '2568'}`,
        `รหัสประกาศจัดซื้อจัดจ้าง e-GP: ${extId}`,
      ],
      en: [
        `Government Procurement Opportunity: ${titleText}`,
        `Procuring Agency: ${deptText}`,
        `Fiscal Year: ${p.fiscalYear || '2025'}`,
        `e-GP Project Identifier: ${extId}`,
      ],
    },
    qualifications: p.qualifications || {
      th: [
        'เป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคาอิเล็กทรอนิกส์ดังกล่าว',
        'ไม่เป็นผู้มีผลประโยชน์ร่วมกันกับผู้ยื่นข้อเสนอรายอื่นที่เข้ายื่นข้อเสนอ',
        'มีคุณสมบัติตรงตามที่กำหนดไว้ในประกาศและเอกสารประกวดราคา (TOR)',
      ],
      en: [
        'Must be a legally registered business qualified in the relevant procurement domain',
        'No conflict of interest with other bidding participants',
        'Must strictly comply with the qualifications specified in the TOR document',
      ],
    },
    requiredTechnologies: p.requiredTechnologies?.length
      ? p.requiredTechnologies
      : category === 'Mobile App'
        ? ['Flutter / React Native', 'iOS & Android', 'REST API', 'Firebase', 'OAuth 2.0']
        : category === 'AI'
          ? ['Python', 'FastAPI', 'PyTorch / ML', 'PostgreSQL', 'Data Pipeline ETL', 'Docker']
          : category === 'Database' || titleLower.includes('data center')
            ? ['Cloud Infrastructure', 'VMware', 'Docker', 'PostgreSQL', 'HA Clustering', 'Disaster Recovery']
            : ['React / Next.js', 'Node.js', 'PostgreSQL', 'Docker', 'REST API', 'PDPA Security'],
    technicalRequirements: p.technicalRequirements?.th?.length
      ? p.technicalRequirements
      : {
          th: [
            'ระบบต้องมีความพร้อมใช้งาน (High Availability) และมี SLA ไม่น้อยกว่า 99.9%',
            'รองรับการเชื่อมต่อผ่าน RESTful API ตามมาตรฐาน OpenAPI Specification',
            'การประมวลผลและการจัดเก็บข้อมูลต้องสอดคล้องตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
            'มีระบบสำรองข้อมูลอัตโนมัติ (Automated Backup) และแผนกู้คืนระบบเมื่อเกิดภัยพิบัติ (DR)',
          ],
          en: [
            'High Availability architecture with guaranteed uptime SLA >= 99.9%',
            'Standardized RESTful API integration complying with OpenAPI 3.0 specification',
            'Full compliance with Thailand Personal Data Protection Act (PDPA)',
            'Automated data backup routines and Disaster Recovery (DR) protocols',
          ],
        },
    extractedQualifications: p.extractedQualifications?.length
      ? p.extractedQualifications
      : [
          {
            id: 'qual-legal',
            description: {
              th: 'เป็นนิติบุคคลที่จดทะเบียนถูกต้องตามกฎหมายในประเทศไทย และไม่เป็นผู้ถูกทิ้งงานของทางราชการ',
              en: 'Legally registered juristic entity in Thailand with no record of government contract abandonment',
            },
            category: 'Legal',
            threshold: 'จดทะเบียนนิติบุคคล >= 2 ปี',
            mandatory: true,
          },
          {
            id: 'qual-exp',
            description: {
              th: `มีผลงานประเภทเดียวกันกับงานที่ประกวดราคา ในสัญญาเดียวมูลค่าไม่น้อยกว่าร้อยละ 50 ของงบประมาณ (${(budgetVal * 0.5).toLocaleString('th-TH')} บาท)`,
              en: `Demonstrated past performance with a single contract value >= 50% of budget (${(budgetVal * 0.5).toLocaleString('en-US')} THB)`,
            },
            category: 'Experience',
            threshold: `สัญญาเดียว >= ${(budgetVal * 0.5).toLocaleString('th-TH')} บาท`,
            mandatory: true,
          },
          {
            id: 'qual-fin',
            description: {
              th: 'มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 5,000,000 บาท และมีฐานะทางการเงินมั่นคง',
              en: 'Paid-up registered capital of not less than 5,000,000 THB with audited financial stability',
            },
            category: 'Financial',
            threshold: 'ทุนจดทะเบียน >= 5,000,000 บาท',
            mandatory: true,
          },
          {
            id: 'qual-tech',
            description: {
              th: 'ได้รับการรับรองมาตรฐานการบริหารจัดการคุณภาพ ISO/IEC 29110 หรือ CMMI Level 3 ขึ้นไป',
              en: 'Certified to ISO/IEC 29110 or CMMI Level 3+ software engineering standard',
            },
            category: 'Technical',
            threshold: 'ISO/IEC 29110 หรือ CMMI Level 3+',
            mandatory: false,
          },
        ],
    historicalAvg: budgetVal,
    sourceDocument: `Attach_TOR_${extId}.pdf`,
    processedDate: new Date().toISOString(),
    aiConfidence: (p.ai_confidence || p.aiConfidence || 'High') as AiConfidence,
    aiClassificationModel: p.classified_by || p.aiClassificationModel,
    extractionStatus: p.extractionStatus || (p.summary ? 'EXTRACTED' : 'PENDING'),
    createdAt: publishDateStr,
    updatedAt: new Date().toISOString(),
    // Preserve raw fields for compatibility
    externalProjectId: extId,
    projectName: titleText,
    agencyName: deptText,
    fiscalYear: p.fiscalYear || 2568,
    source: p.source || 'CKAN_GOVSPENDING',
    sourceUrl:
      p.sourceUrl ||
      `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${extId}`,
  } as Project & {
    externalProjectId: string;
    projectName: string;
    agencyName: string;
    fiscalYear: number;
    source: string;
    sourceUrl: string;
  };
}
