// =============================================================================
// lib/project-mapper.ts - Maps ProcurementProject/DiscoveredProject to Project
// =============================================================================

import { Project, ProjectCategory, AiConfidence } from '@/types/project';
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
    description: typeof p.description === 'object' && p.description?.th
      ? p.description
      : typeof p.description === 'string' && p.description.trim()
        ? { th: p.description, en: p.description }
        : { th: titleText, en: titleText },
    summary: p.summary?.th
      ? p.summary
      : {
          th: `สรุปสาระสำคัญ: โครงการ${titleText} โดย${deptText} วงเงินงบประมาณ ${budgetVal.toLocaleString('th-TH')} บาท${
            contractPriceVal && contractPriceVal !== budgetVal
              ? ` (ราคามูลค่าที่จัดหาได้ ${contractPriceVal.toLocaleString('th-TH')} บาท)`
              : ''
          } จัดหาด้วยวิธี ${p.procurementType || 'e-Bidding'}`,
          en: `Executive Summary: Procurement for ${titleText} by ${deptText} with an allocated budget of ${budgetVal.toLocaleString('en-US')} THB${
            contractPriceVal && contractPriceVal !== budgetVal
              ? ` (awarded contract value ${contractPriceVal.toLocaleString('en-US')} THB)`
              : ''
          } via ${p.procurementType || 'e-Bidding'} method`,
        },
    scope: p.scope && Array.isArray(p.scope?.th) && p.scope.th.length > 0 ? p.scope : undefined,
    qualifications: p.qualifications && Array.isArray(p.qualifications?.th) && p.qualifications.th.length > 0 ? p.qualifications : undefined,
    // Only show technologies if actually extracted from TOR documents (no hardcoded fallbacks)
    requiredTechnologies: p.requiredTechnologies?.length ? p.requiredTechnologies : [],
    // Only show technical requirements if actually extracted from TOR documents
    technicalRequirements: p.technicalRequirements?.th?.length ? p.technicalRequirements : undefined,
    // Only show qualifications if actually extracted from TOR documents
    extractedQualifications: p.extractedQualifications?.length ? p.extractedQualifications : [],

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
