// =============================================================================
// lib/projectDetailHelper.ts - Enrichment & Helpers for Procurement Detail Viewer
// =============================================================================

import {
  Project,
  TimelineEvent,
  BudgetBreakdownItem,
  HighlightedQualification,
  DocumentSection,
  AiMetadata,
} from '@/types/project';
import { daysUntil } from '@/lib/utils';

export function enrichProjectDetail(project: Project): Project {
  // If already fully enriched with real data, return as-is
  if (
    project.timeline &&
    project.timeline.length > 0 &&
    project.documentSections &&
    project.documentSections.length > 0 &&
    project.budgetBreakdown &&
    project.budgetBreakdown.length > 0
  ) {
    return project;
  }

  // ─── Timeline ──────────────────────────────────────────────────────────────
  // ONLY include milestones for which REAL dates exist in official data.
  // NEVER generate fake or estimated dates (+7 days, +3 days, etc.).
  const timeline: TimelineEvent[] = [];

  if (project.timeline && project.timeline.length > 0) {
    timeline.push(...project.timeline);
  } else {
    const publishDateObj = project.publishDate ? new Date(project.publishDate) : null;
    const deadlineDateObj = project.deadline ? new Date(project.deadline) : null;
    const pAny = project as unknown as Record<string, unknown>;
    const contractDateRaw = pAny.contractDate ?? pAny.contract_date ?? pAny.transactionDate ?? pAny.transaction_date;
    const contractFinishDateRaw = pAny.contractFinishDate ?? pAny.contract_finish_date;
    const winnerName = (pAny.winnerName ?? pAny.winner_name) as string | undefined;

    if (publishDateObj && !isNaN(publishDateObj.getTime())) {
      timeline.push({
        id: 'announcement',
        event: {
          th: 'ประกาศจัดซื้อจัดจ้างอย่างเป็นทางการ',
          en: 'Official Procurement Announcement Published',
        },
        date: project.publishDate,
        description: {
          th: 'เผยแพร่ประกาศผ่านระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)',
          en: 'Published via official e-GP procurement system',
        },
        status: 'completed',
      });
    }

    if (deadlineDateObj && !isNaN(deadlineDateObj.getTime())) {
      const daysToDeadline = daysUntil(project.deadline);
      timeline.push({
        id: 'bid-deadline',
        event: {
          th: 'กำหนดยื่นข้อเสนอและเสนอราคาผ่านระบบ e-GP',
          en: 'Bid Submission & Proposal Deadline',
        },
        date: project.deadline,
        description: {
          th: 'วันปิดรับข้อเสนออย่างเป็นทางการตามประกาศ e-GP',
          en: 'Official bid submission closing date via e-GP',
        },
        status: daysToDeadline < 0 ? 'completed' : 'active',
      });
    }

    if (contractDateRaw) {
      const cDateStr = typeof contractDateRaw === 'string' ? contractDateRaw : (contractDateRaw as Date).toISOString();
      const cDateObj = new Date(cDateStr);
      if (!isNaN(cDateObj.getTime())) {
        timeline.push({
          id: 'contract-award',
          event: {
            th: 'ลงนามสัญญา / ประกาศผลผู้ชนะ',
            en: 'Contract Award & Signing',
          },
          date: cDateStr,
          description: {
            th: winnerName ? `ผู้ชนะการเสนอราคา: ${winnerName}` : 'ลงนามสัญญาเรียบร้อยแล้ว',
            en: winnerName ? `Contract Awardee: ${winnerName}` : 'Contract awarded and executed',
          },
          status: 'completed',
        });
      }
    }

    if (contractFinishDateRaw) {
      const fDateStr = typeof contractFinishDateRaw === 'string' ? contractFinishDateRaw : (contractFinishDateRaw as Date).toISOString();
      const fDateObj = new Date(fDateStr);
      if (!isNaN(fDateObj.getTime())) {
        const daysToFinish = daysUntil(fDateStr);
        timeline.push({
          id: 'contract-finish',
          event: {
            th: 'กำหนดสิ้นสุดสัญญา / ส่งมอบงานงวดสุดท้าย',
            en: 'Contract Completion & Final Delivery',
          },
          date: fDateStr,
          description: {
            th: 'กำหนดสิ้นสุดสัญญาตามข้อตกลงจัดซื้อจัดจ้าง',
            en: 'Scheduled contract completion date',
          },
          status: daysToFinish < 0 ? 'completed' : 'upcoming',
        });
      }
    }
  }

  // ─── Budget Breakdown ──────────────────────────────────────────────────────
  // NEVER synthesize fake budget allocation percentages.
  // Only display budget breakdown if real itemized items were extracted from the TOR.
  const budgetBreakdown: BudgetBreakdownItem[] | undefined =
    project.budgetBreakdown && project.budgetBreakdown.length > 0
      ? project.budgetBreakdown
      : undefined;

  // ─── Highlighted Qualifications ───────────────────────────────────────────
  // Only use real extracted qualifications from TOR. No fabricated ones.
  const rawQuals = project.qualifications?.th || [];
  const rawQualsEn = project.qualifications?.en || [];
  const extractedQuals = project.extractedQualifications || [];

  const highlightedQualifications: HighlightedQualification[] = [];

  // Use structured qualifications if available (from TOR extraction)
  if (extractedQuals.length > 0) {
    extractedQuals.slice(0, 3).forEach((q, i) => {
      highlightedQualifications.push({
        type: q.mandatory ? 'critical' : 'standard',
        title: {
          th: q.description?.th ? `คุณสมบัติที่ ${i + 1}` : `Qualification ${i + 1}`,
          en: q.description?.en ? `Qualification ${i + 1}` : `Qualification ${i + 1}`,
        },
        description: q.description,
      });
    });
  } else if (rawQuals.length > 0) {
    // Use simple text qualifications from TOR
    rawQuals.slice(0, 3).forEach((th, i) => {
      highlightedQualifications.push({
        type: i === 0 ? 'critical' : 'standard',
        title: {
          th: `คุณสมบัติที่ ${i + 1}`,
          en: `Qualification ${i + 1}`,
        },
        description: {
          th,
          en: rawQualsEn[i] || th,
        },
      });
    });
  }
  // If no qualifications available, we return empty array — UI should show "No TOR / qualifications N/A"

  // ─── Document Sections ────────────────────────────────────────────────────
  // Only generate document sections if project has real scope/qualification data from TOR.
  // Label everything clearly.
  const docTitleTh = project.title?.th || 'โครงการจัดซื้อจัดจ้าง';
  const docTitleEn = project.title?.en || 'Procurement Project';
  const deptTh = project.department?.th || 'หน่วยงาน';
  const deptEn = project.department?.en || 'Agency';
  const budget = project.budget || 0;

  const documentSections: DocumentSection[] = [];

  // Only add sections that contain real extracted data
  if (project.scope?.th?.length || project.qualifications?.th?.length) {
    documentSections.push({
      sectionId: 'article-1',
      articleNumber: 'ข้อ 1',
      title: {
        th: 'ความเป็นมาและวัตถุประสงค์โครงการ',
        en: 'Article 1: Background and Objectives',
      },
      page: 1,
      content: {
        th: `${deptTh} มีความประสงค์จะดำเนินการจัดซื้อจัดจ้าง \"${docTitleTh}\" วงเงินงบประมาณ ${budget.toLocaleString('th-TH')} บาท`,
        en: `${deptEn} intends to procure \"${docTitleEn}\" with an allocated budget of ${budget.toLocaleString('en-US')} THB.`,
      },
      extractedHighlights: budget > 0
        ? [{ th: `วงเงินงบประมาณ: ${budget.toLocaleString('th-TH')} บาท`, en: `Budget: ${budget.toLocaleString('en-US')} THB` }]
        : [],
    });
  }

  if (project.qualifications?.th?.length) {
    documentSections.push({
      sectionId: 'article-2',
      articleNumber: 'ข้อ 2',
      title: {
        th: 'คุณสมบัติของผู้ยื่นข้อเสนอราคา',
        en: 'Article 2: Bidder Qualifications and Eligibility',
      },
      page: 2,
      content: {
        th: (project.qualifications.th || []).map((q, i) => `${i + 1}. ${q}`).join('\n'),
        en: (project.qualifications.en || []).map((q, i) => `${i + 1}. ${q}`).join('\n'),
      },
      extractedHighlights: (project.qualifications.th || []).slice(0, 3).map((th, i) => ({
        th,
        en: project.qualifications?.en?.[i] || th,
      })),
    });
  }

  if (project.scope?.th?.length) {
    documentSections.push({
      sectionId: 'article-3',
      articleNumber: 'ข้อ 3',
      title: {
        th: 'ขอบเขตของงานและข้อกำหนดทางเทคนิค (Scope of Work)',
        en: 'Article 3: Technical Specifications & Scope of Work',
      },
      page: 3,
      content: {
        th: (project.scope.th || []).map((s, i) => `3.${i + 1} ${s}`).join('\n'),
        en: (project.scope.en || []).map((s, i) => `3.${i + 1} ${s}`).join('\n'),
      },
      extractedHighlights: (project.scope.th || []).slice(0, 4).map((th, i) => ({
        th,
        en: project.scope?.en?.[i] || th,
      })),
    });
  }

  if (budget > 0) {
    documentSections.push({
      sectionId: 'article-5',
      articleNumber: 'ข้อ 5',
      title: {
        th: 'งบประมาณ ค่าจ้าง และการจ่ายเงิน',
        en: 'Article 5: Budget, Pricing and Payment Terms',
      },
      page: 5,
      content: {
        th: `วงเงินงบประมาณที่ได้รับจัดสรรทั้งสิ้น ${budget.toLocaleString('th-TH')} บาท`,
        en: `Allocated budget ceiling is ${budget.toLocaleString('en-US')} THB.`,
      },
      extractedHighlights: [
        {
          th: `วงเงินงบประมาณ: ${budget.toLocaleString('th-TH')} บาท`,
          en: `Budget allocation: ${budget.toLocaleString('en-US')} THB`,
        },
      ],
    });
  }

  // ─── AI Metadata ──────────────────────────────────────────────────────────
  const aiMetadata: AiMetadata = {
    model: project.aiClassificationModel || 'Keyword Rule-based Classifier',
    confidenceScore: project.aiConfidence === 'High' ? 90 : project.aiConfidence === 'Medium' ? 75 : 55,
    verifiedByHuman: project.classificationReviewStatus === 'APPROVED' || project.classificationReviewStatus === 'CORRECTED',
    extractedClausesCount: (project.scope?.th?.length || 0) + (project.qualifications?.th?.length || 0) + (project.extractedQualifications?.length || 0),
    lastVerifiedDate: project.processedDate || new Date().toISOString(),
  };

  return {
    ...project,
    sourceUrl: project.sourceUrl || `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${(project as { externalProjectId?: string | number }).externalProjectId || project.externalId}`,
    documentUrl:
      project.documentUrl && !project.documentUrl.startsWith('/docs/')
        ? project.documentUrl
        : `/api/documents/${(project as { externalProjectId?: string | number }).externalProjectId || project.externalId}/${encodeURIComponent(project.sourceDocument || `TOR_${project.externalId}.pdf`)}`,
    timeline: timeline.length > 0 ? timeline : undefined,
    budgetBreakdown,
    highlightedQualifications: highlightedQualifications.length > 0 ? highlightedQualifications : undefined,
    documentSections: documentSections.length > 0 ? documentSections : undefined,
    aiMetadata,
    // Do NOT add fake contactInfo — it misleads users.
    // Contact info should only come from actual TOR extraction.
  };
}
