// =============================================================================
// app/api/admin/classification-queue/route.ts
// GET /api/admin/classification-queue — list projects pending admin review (UC-10)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorization/backend';
import { connectToDatabase } from '@/lib/mongodb';
import Project from '@/models/Project';
import { ProjectCategory, AiConfidence, ClassificationReviewStatus } from '@/types/project';

interface QueueProjectItem {
  _id: string;
  externalId: number;
  title: { th: string; en: string };
  department: { th: string; en: string };
  category: ProjectCategory;
  isSoftwareRelated: boolean;
  aiConfidence: AiConfidence;
  classificationReviewStatus: ClassificationReviewStatus;
  classificationReviewedBy?: string;
  classificationReviewedAt?: Date;
  classificationReviewNote?: string;
  publishDate: string;
  processedDate: string;
}

const QueueQuerySchema = z.object({
  status: z.enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED', 'all']).optional().default('PENDING_REVIEW'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    // ── SEC-08: Backend authorization enforcement (defence-in-depth) ─────────
    const authUser = getAuthSessionFromRequest(req);
    const authCheck = requireAdmin(authUser);
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const url = req.nextUrl.searchParams;
    const parsed = QueueQuerySchema.safeParse({
      status: url.get('status') ?? undefined,
      page: url.get('page') ?? undefined,
      limit: url.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { status, page, limit } = parsed.data;

    await connectToDatabase();

    // 1. Prioritize real ingested ProcurementProject records over seeded static Project records
    const { default: ProcurementProject } = await import('@/models/ProcurementProject');
    const procQuery: Record<string, unknown> = {};
    if (status === 'PENDING_REVIEW') {
      procQuery.admin_reviewed = { $ne: true };
    } else if (status === 'APPROVED') {
      procQuery.admin_reviewed = true;
      procQuery.is_software = true;
    } else if (status === 'CORRECTED') {
      procQuery.admin_reviewed = true;
      procQuery.is_software = false;
    }

    const [procAllCount, procTotal, procDocs, pCount, aCount, cCount] = await Promise.all([
      ProcurementProject.countDocuments({}),
      ProcurementProject.countDocuments(procQuery),
      ProcurementProject.find(procQuery)
        .select('-rawPayload')
        .sort({ discoveredAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProcurementProject.countDocuments({ admin_reviewed: { $ne: true } }),
      ProcurementProject.countDocuments({ admin_reviewed: true, is_software: true }),
      ProcurementProject.countDocuments({ admin_reviewed: true, is_software: false }),
    ]);

    let total = procTotal;
    let pendingCount = pCount;
    let approvedCount = aCount;
    let correctedCount = cCount;
    let projects: QueueProjectItem[] = procDocs.map((p) => ({
      _id: String(p._id),
      externalId: Number(String(p.externalProjectId || '').replace(/\D/g, '')) || 100000,
      title: { th: p.projectName, en: p.projectNameEn || p.projectName },
      department: { th: p.agencyName, en: p.agencyNameEn || p.agencyName },
      category: (p.software_category || 'Information System') as ProjectCategory,
      isSoftwareRelated: p.is_software ?? true,
      aiConfidence: (p.ai_confidence || 'High') as AiConfidence,
      classificationReviewStatus: (p.admin_reviewed
        ? (p.is_software ? 'APPROVED' : 'CORRECTED')
        : 'PENDING_REVIEW') as ClassificationReviewStatus,
      classificationReviewedBy: p.classified_by,
      classificationReviewedAt: p.classified_at,
      classificationReviewNote: p.classification_reason,
      publishDate: (p.publishDate || p.discoveredAt || p.createdAt || new Date()).toISOString(),
      processedDate: (p.discoveredAt || p.createdAt || new Date()).toISOString(),
    }));

    // 2. Fallback to Project collection only when ProcurementProject collection has no records
    if (procAllCount === 0) {
      const query: Record<string, unknown> = status === 'all' ? {} : { classificationReviewStatus: status };

      const [dbTotal, dbProjects, dbPending, dbApproved, dbCorrected] = await Promise.all([
        Project.countDocuments(query),
        Project.find(query)
          .select(
            'externalId title department category isSoftwareRelated aiConfidence classificationReviewStatus classificationReviewedBy classificationReviewedAt classificationReviewNote publishDate processedDate',
          )
          .sort({ processedDate: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Project.countDocuments({ classificationReviewStatus: 'PENDING_REVIEW' }),
        Project.countDocuments({ classificationReviewStatus: 'APPROVED' }),
        Project.countDocuments({ classificationReviewStatus: 'CORRECTED' }),
      ]);

      total = dbTotal;
      projects = dbProjects as unknown as QueueProjectItem[];
      pendingCount = dbPending;
      approvedCount = dbApproved;
      correctedCount = dbCorrected;
    }

    return NextResponse.json({
      data: projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        pendingCount,
        approvedCount,
        correctedCount,
      },
    });
  } catch (err) {
    console.error('[GET /api/admin/classification-queue]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
