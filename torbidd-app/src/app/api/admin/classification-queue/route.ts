// =============================================================================
// app/api/admin/classification-queue/route.ts
// GET /api/admin/classification-queue — list projects pending admin review (UC-10)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Project from '@/models/Project';

const QueueQuerySchema = z.object({
  status: z.enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED', 'all']).optional().default('PENDING_REVIEW'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    // ── Auth guard: admins only ─────────────────────────────────────────────
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = status === 'all' ? {} : { classificationReviewStatus: status };

    const [dbTotal, dbProjects] = await Promise.all([
      Project.countDocuments(query),
      Project.find(query)
        .select(
          'externalId title department category isSoftwareRelated aiConfidence classificationReviewStatus classificationReviewedBy classificationReviewedAt classificationReviewNote publishDate processedDate',
        )
        .sort({ processedDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    let total = dbTotal;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let projects: any[] = dbProjects;

    // Summary counts for the overview panel
    let [pendingCount, approvedCount, correctedCount] = await Promise.all([
      Project.countDocuments({ classificationReviewStatus: 'PENDING_REVIEW' }),
      Project.countDocuments({ classificationReviewStatus: 'APPROVED' }),
      Project.countDocuments({ classificationReviewStatus: 'CORRECTED' }),
    ]);

    // Fallback: If Project collection is empty, populate from ProcurementProject
    if (total === 0 && projects.length === 0) {
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

      const [procTotal, procDocs, pCount, aCount, cCount] = await Promise.all([
        ProcurementProject.countDocuments(procQuery),
        ProcurementProject.find(procQuery)
          .sort({ discoveredAt: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ProcurementProject.countDocuments({ admin_reviewed: { $ne: true } }),
        ProcurementProject.countDocuments({ admin_reviewed: true, is_software: true }),
        ProcurementProject.countDocuments({ admin_reviewed: true, is_software: false }),
      ]);

      total = procTotal;
      pendingCount = pCount;
      approvedCount = aCount;
      correctedCount = cCount;

      projects = procDocs.map((p) => ({
        _id: String(p._id),
        externalId: p.externalProjectId as unknown as number,
        title: { th: p.projectName, en: p.projectName },
        department: { th: p.agencyName, en: p.agencyName },
        category: (p.software_category || 'Information System') as any,
        isSoftwareRelated: p.is_software ?? true,
        aiConfidence: (p.ai_confidence || 'High') as any,
        classificationReviewStatus: (p.admin_reviewed
          ? (p.is_software ? 'APPROVED' : 'CORRECTED')
          : 'PENDING_REVIEW') as any,
        classificationReviewedBy: p.classified_by,
        classificationReviewedAt: p.classified_at,
        classificationReviewNote: p.classification_reason,
        publishDate: (p.discoveredAt || p.createdAt || new Date()).toISOString(),
        processedDate: (p.discoveredAt || p.createdAt || new Date()).toISOString(),
      }));
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
