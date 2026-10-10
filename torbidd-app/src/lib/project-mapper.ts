// =============================================================================
// lib/project-mapper.ts - Maps ProcurementProject/DiscoveredProject to Project
// =============================================================================

import { Project, ProjectCategory, AiConfidence, TorStatus } from '@/types/project';
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

  // ─── Actual Announcement Date (publishDate) ────────────────────────────────
  // Priority: actual announcement/publish date fields FIRST.
  // discoveredAt / createdAt are SYNC dates, not announcement dates — never use
  // them as publishDate. Only fall back if truly no date is available.
  const rawAnnounceDate =
    p.publish_date ??
    p.publishDate ??
    p.announce_date ??
    p.announceDate ??
    p.date ??
    p.contract_date ??
    p.startDate ??
    p.start_date ??
    null;

  const publishDateStr = parseToIsoDate(rawAnnounceDate) || null;

  // ─── Sync / Processed Date ─────────────────────────────────────────────────
  // This is when WE synced the record from the source — NOT the announcement date.
  const rawSyncDate =
    p.discoveredAt ?? p.updatedAt ?? p.createdAt ?? p.processedDate ?? new Date();
  const processedDateStr = parseToIsoDate(rawSyncDate) || new Date().toISOString();

  // ─── Deadline ──────────────────────────────────────────────────────────────
  // Use real deadline from TOR/source. Do NOT default to "14 days from now" —
  // that misleads users about whether a job is still open.
  const rawDeadline =
    p.deadline ??
    p.submission_deadline ??
    p.submissionDeadline ??
    p.close_date ??
    p.closeDate ??
    p.end_date ??
    p.endDate ??
    null;
  const deadlineStr = parseToIsoDate(rawDeadline) || null;

  // ─── Fiscal Year ───────────────────────────────────────────────────────────
  // Priority: 1) Explicitly saved fiscalYear (e.g. from admin edit or official data)
  //           2) Derived from actual announcement/contract date (Oct 1 -> Sep 30)
  //           3) 11-digit e-GP ID prefix (e.g. 68xxxxxxxxx -> 2568)
  let fiscalYear: number | undefined;

  const rawFy = p.fiscalYear || p.fiscal_year || p.year;
  if (typeof rawFy === 'number' && rawFy >= 2500 && rawFy <= 2600) {
    fiscalYear = rawFy;
  } else if (typeof rawFy === 'string' && !isNaN(Number(rawFy)) && Number(rawFy) >= 2500 && Number(rawFy) <= 2600) {
    fiscalYear = Number(rawFy);
  }

  if (!fiscalYear) {
    const targetDateForFy = publishDateStr || parseToIsoDate(p.contractDate || p.contract_date || p.transaction_date);
    if (targetDateForFy) {
      const d = new Date(targetDateForFy);
      if (!isNaN(d.getTime())) {
        const month = d.getUTCMonth(); // 0-indexed: 9 = Oct
        const ceYear = d.getUTCFullYear();
        fiscalYear = ceYear + (month >= 9 ? 544 : 543);
      }
    }
  }

  if (!fiscalYear && extId && /^\d{11}$/.test(extId)) {
    const prefix = parseInt(extId.substring(0, 2), 10);
    if (prefix >= 60 && prefix <= 75) {
      fiscalYear = 2500 + prefix;
    }
  }

  // ─── Category ──────────────────────────────────────────────────────────────
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

  // ─── Software Relatedness ──────────────────────────────────────────────────
  // UC-10: determine software relatedness
  // Software license/subscription procurement IS software-related.
  const NON_SW_TERMS = ['ก่อสร้าง', 'construction', 'ถนน', 'road', 'ครุภัณฑ์', 'equipment', 'ยานพาหนะ', 'vehicle', 'เฟอร์นิเจอร์', 'furniture'];
  // License/subscription terms that ARE software-related
  const SW_LICENSE_TERMS = [
    'ลิขสิทธิ์', 'license', 'licence', 'subscription', 'สิทธิ์การใช้', 'สิทธิ์ใช้งาน',
    'โปรแกรมลิขสิทธิ์', 'software license', 'software subscription', 'บอกรับสมาชิก',
    'เช่าระบบ', 'เช่าซอฟต์แวร์', 'บำรุงรักษาซอฟต์แวร์', 'maintenance software',
    'annual license', 'software maintenance',
  ];
  const isSoftwareLicense = SW_LICENSE_TERMS.some((t) => titleLower.includes(t));

  const isSoftwareRelated =
    p.is_software !== undefined && p.is_software !== null
      ? Boolean(p.is_software)
      : p.isSoftwareRelated !== undefined && p.isSoftwareRelated !== null
        ? Boolean(p.isSoftwareRelated)
        : isSoftwareLicense || !NON_SW_TERMS.some((t) => titleLower.includes(t));

  // ─── Budget ────────────────────────────────────────────────────────────────
  const budgetVal = normalizeCurrency(
    p.budget ?? p.project_money ?? p.projectMoney ?? p.price ?? p.amount ?? p.sum_price_agree ?? p.contract_price,
  );
  const rawContractPrice =
    p.contractPrice ?? p.contract_price ?? p.sum_price_agree ?? p.sumPriceAgree;
  const contractPriceVal =
    rawContractPrice !== undefined && rawContractPrice !== null
      ? normalizeCurrency(rawContractPrice)
      : undefined;

  // ─── TOR Status ────────────────────────────────────────────────────────────
  // Reflect whether a TOR document actually exists for this project.
  let torStatus: TorStatus;
  if (p.extractionStatus === 'EXTRACTED' && (p.summary?.th || p.extractedQualifications?.length)) {
    torStatus = 'AVAILABLE';
  } else if (p.extractionStatus === 'PENDING' || p.extractionStatus === 'FAILED') {
    torStatus = 'PENDING';
  } else if (p.documents && Array.isArray(p.documents) && p.documents.some((d: { documentType: string }) => d.documentType === 'ATTACH_TOR')) {
    torStatus = 'AVAILABLE';
  } else {
    // If no extraction data and no TOR document attached, mark as no TOR available
    torStatus = (p.summary?.th || p.extractedQualifications?.length) ? 'AVAILABLE' : 'NO_TOR';
  }

  // ─── Final publishDate for display ────────────────────────────────────────
  // If we couldn't get a real announcement date, use processedDate but we'll
  // clearly label it as "Sync Date" in the UI rather than "Published Date".
  const finalPublishDate = publishDateStr || processedDateStr;

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
    publishDate: finalPublishDate,
    deadline: deadlineStr || '', // Empty string = unknown deadline; UI will show "N/A"
    fiscalYear,
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
      : undefined, // No fake summary — if no TOR extracted, show nothing
    scope: p.scope && Array.isArray(p.scope?.th) && p.scope.th.length > 0 ? p.scope : undefined,
    qualifications: p.qualifications && Array.isArray(p.qualifications?.th) && p.qualifications.th.length > 0 ? p.qualifications : undefined,
    // Only show technologies if actually extracted from TOR documents (no hardcoded fallbacks)
    requiredTechnologies: p.requiredTechnologies?.length ? p.requiredTechnologies : [],
    // Only show technical requirements if actually extracted from TOR documents
    technicalRequirements: p.technicalRequirements?.th?.length ? p.technicalRequirements : undefined,
    // Only show qualifications if actually extracted from TOR documents
    extractedQualifications: p.extractedQualifications?.length ? p.extractedQualifications : [],

    historicalAvg: budgetVal,
    sourceDocument: p.sourceDocument || `Attach_TOR_${extId}.pdf`,
    torStatus,
    processedDate: processedDateStr, // Real sync/processed date
    aiConfidence: (p.ai_confidence || p.aiConfidence || 'Medium') as AiConfidence, // Default Medium not High
    aiClassificationModel: p.classified_by || p.aiClassificationModel,
    extractionStatus: p.extractionStatus || 'PENDING',
    createdAt: processedDateStr,
    updatedAt: processedDateStr,
    timeline: p.timeline && Array.isArray(p.timeline) && p.timeline.length > 0 ? p.timeline : undefined,
    contractDate: p.contractDate || p.contract_date || p.transaction_date,
    contractFinishDate: p.contractFinishDate || p.contract_finish_date,
    winnerName: p.winnerName || p.winner_name,
    medianPrice: p.medianPrice || p.price_build,
    status: p.status || (p.contractPrice || contractPriceVal ? 'จัดทำสัญญาแล้ว' : 'ประกาศเชิญชวน'),
    // Preserve raw fields for compatibility
    externalProjectId: extId,
    projectName: titleText,
    agencyName: deptText,
    source: p.source || 'CKAN_GOVSPENDING',
    sourceUrl:
      p.sourceUrl ||
      `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${extId}`,
    // Pass through actual publish date detection flag so UI can distinguish
    _hasActualPublishDate: !!publishDateStr,
  } as Project & {
    externalProjectId: string;
    projectName: string;
    agencyName: string;
    fiscalYear: number;
    source: string;
    sourceUrl: string;
    _hasActualPublishDate: boolean;
  };
}
