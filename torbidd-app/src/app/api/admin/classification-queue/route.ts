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

    const [total, projects] = await Promise.all([
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

    // Summary counts for the overview panel
    const [pendingCount, approvedCount, correctedCount] = await Promise.all([
      Project.countDocuments({ classificationReviewStatus: 'PENDING_REVIEW' }),
      Project.countDocuments({ classificationReviewStatus: 'APPROVED' }),
      Project.countDocuments({ classificationReviewStatus: 'CORRECTED' }),
    ]);

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
