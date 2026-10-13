// =============================================================================
// services/transformation/transformation-adapter.ts
// ETL Transformation & Normalization Pipeline for Heterogeneous Agency Payloads
// =============================================================================

import {
  BatchTransformationSummary,
  NormalizedProcurementProject,
  RawAgencyPayload,
  TransformationResult,
} from './types';
import { parseToIsoDate } from './normalizers/date-normalizer';
import { normalizeCurrency } from './normalizers/currency-normalizer';
import { sanitizeAgencyName, sanitizeText } from './normalizers/text-sanitizer';
import { validateNormalizedProject } from './schema-validator';
import { generateProjectContentHash } from '@/services/database/procurement';

export class TransformationAdapter {
  /**
   * Transform and normalize a single heterogeneous agency payload.
   * Rejects malformed records and flags anomalies with specific field errors.
   */
  public transform(raw: RawAgencyPayload): TransformationResult {
    // 1. Extract and sanitize primary project ID
    const rawId =
      raw.project_id ??
      raw.projectId ??
      raw.external_id ??
      raw.externalId ??
      raw.id;
    const externalProjectId = sanitizeText(rawId, '');

    // 2. Extract and sanitize project name
    const rawTitle = raw.project_name ?? raw.projectName ?? raw.title;
    const projectName = sanitizeText(rawTitle, '');

    // 3. Extract and sanitize agency name
    const rawAgency =
      raw.dept_name ??
      raw.dept_sub_name ??
      raw.agency_name ??
      raw.agencyName ??
      raw.department ??
      raw.organization;
    const agencyName = sanitizeAgencyName(rawAgency);

    // 4. Extract and normalize budget (approved budget has highest priority)
    const rawBudget =
      raw.budget ??
      raw.project_money ??
      raw.projectMoney ??
      raw.price ??
      raw.amount ??
      raw.sum_price_agree ??
      raw.contract_price;
    const isNegativeExplicit =
      typeof rawBudget === 'string' && (rawBudget.trim().startsWith('-') || rawBudget.includes('ติดลบ'));
    const budget = normalizeCurrency(rawBudget, { allowNegative: true });

    // 4b. Extract and normalize contract/procured price (sum_price_agree / contract_price)
    const rawContractPrice =
      raw.contract_price ??
      raw.contractPrice ??
      raw.sum_price_agree ??
      raw.sumPriceAgree;
    const contractPrice =
      rawContractPrice !== undefined && rawContractPrice !== null
        ? normalizeCurrency(rawContractPrice, { allowNegative: false })
        : undefined;

    // 5. Extract and normalize announcement/publish date
    // IMPORTANT: discoveredAt/createdAt are SYNC dates, not announcement dates.
    // Only use actual government-provided date fields for publishDate.
    const rawAnnounceDate =
      raw.publish_date ??
      raw.publishDate ??
      raw.announce_date ??
      raw.announceDate ??
      raw.date ??
      raw.contract_date ??  // For signed contracts, this IS the relevant date
      null;
    const publishDate = rawAnnounceDate
      ? (parseToIsoDate(rawAnnounceDate) || undefined)
      : undefined;

    // 5b. Extract bid submission deadline
    const rawDeadline =
      raw.deadline ??
      raw.submission_deadline ??
      raw.submissionDeadline ??
      raw.close_date ??
      raw.closeDate ??
      raw.end_date ??
      null;
    const deadline = rawDeadline ? (parseToIsoDate(rawDeadline) || undefined) : undefined;

    // 6. Extract and normalize fiscal year
    const rawYear = raw.year ?? raw.fiscal_year ?? raw.fiscalYear;
    let fiscalYear = typeof rawYear === 'number' ? rawYear : parseInt(String(rawYear || ''), 10);
    if (isNaN(fiscalYear) || fiscalYear <= 0) {
      // Derive from publish date (or current date if unknown)
      const pubDateObj = new Date(publishDate || Date.now());
      fiscalYear = pubDateObj.getUTCFullYear() + (pubDateObj.getUTCMonth() >= 9 ? 544 : 543);
    }

    // 7. Extract procurement type
    const rawType =
      raw.procurement_type ??
      raw.procurementType ??
      raw.transaction_sub_type_name ??
      raw.method;
    const procurementType = sanitizeText(rawType, 'e-Bidding');

    // 8. Extract or construct source URLs and document links
    const rawUrl = raw.source_url ?? raw.sourceUrl ?? raw.detail_url;
    const defaultUrl = externalProjectId
      ? `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${externalProjectId}`
      : '';
    const sourceUrl = sanitizeText(rawUrl, defaultUrl);

    const documentLinks: string[] = [];
    if (raw.document_url && typeof raw.document_url === 'string') {
      documentLinks.push(raw.document_url);
    }
    if (Array.isArray(raw.documents)) {
      for (const doc of raw.documents) {
        if (doc?.fileUrl && typeof doc.fileUrl === 'string') {
          documentLinks.push(doc.fileUrl);
        }
      }
    }

    // 9. Generate Secondary Deduplication Key (contentHash)
    const contentHash = generateProjectContentHash({
      externalProjectId,
      projectName,
      budget,
      fiscalYear,
      agencyName,
      procurementType,
    });

    const transformedAt = new Date().toISOString();

    const candidate: Partial<NormalizedProcurementProject> = {
      externalProjectId,
      projectName,
      agencyName,
      fiscalYear,
      budget,
      contractPrice: contractPrice && contractPrice > 0 ? contractPrice : undefined,
      publishDate: publishDate || undefined,
      deadline: deadline || undefined,
      procurementType,
      source: (raw.source as string) || 'CENTRAL_API',
      sourceUrl,
      documentLinks,
      contentHash,
      revision: typeof raw.revision === 'number' ? raw.revision : 1,
      transformedAt,
    };

    // 10. Run Schema Validation
    const evaluation = validateNormalizedProject(candidate);

    // If explicit negative was supplied, add error if not already caught
    if (isNegativeExplicit && !evaluation.errors.some((e) => e.field === 'budget')) {
      evaluation.status = 'REJECTED';
      evaluation.errors.push({
        field: 'budget',
        message: 'Budget must not be negative',
        rawValue: rawBudget,
      });
    }

    if (evaluation.status === 'REJECTED') {
      return {
        status: 'REJECTED',
        flags: evaluation.flags,
        errors: evaluation.errors,
        rawPayload: raw,
      };
    }

    return {
      status: evaluation.status,
      data: candidate as NormalizedProcurementProject,
      flags: evaluation.flags,
      errors: [],
      rawPayload: raw,
    };
  }

  /**
   * Batch transformation for diverse agency datasets with aggregated metrics.
   */
  public transformBatch(rawList: RawAgencyPayload[]): BatchTransformationSummary {
    const items: TransformationResult[] = [];
    const validProjects: NormalizedProcurementProject[] = [];
    let validCount = 0;
    let flaggedCount = 0;
    let rejectedCount = 0;

    for (const raw of rawList) {
      const result = this.transform(raw);
      items.push(result);

      if (result.status === 'VALID') {
        validCount++;
        if (result.data) validProjects.push(result.data);
      } else if (result.status === 'FLAGGED') {
        flaggedCount++;
        if (result.data) validProjects.push(result.data);
      } else {
        rejectedCount++;
      }
    }

    const summary: BatchTransformationSummary = {
      total: rawList.length,
      validCount,
      flaggedCount,
      rejectedCount,
      items,
      validProjects,
    };

    console.info('[ETL Transformation Summary]', {
      total: summary.total,
      validCount: summary.validCount,
      flaggedCount: summary.flaggedCount,
      rejectedCount: summary.rejectedCount,
    });

    return summary;
  }
}

export const transformationAdapter = new TransformationAdapter();
