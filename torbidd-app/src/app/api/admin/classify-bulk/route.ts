// =============================================================================
// app/api/admin/classify-bulk/route.ts
// POST /api/admin/classify-bulk — Trigger bulk AI classification for projects (UC-10)
// Reclassifies projects with PENDING_REVIEW status or all projects if force=true.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Project from '@/models/Project';
import { classifyProject } from '@/services/ai/classifier';

const BulkClassifySchema = z.object({
  force: z.boolean().optional().default(false), // if true, reclassify ALL projects
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
});

export async function POST(req: NextRequest) {
  try {
    // ── Auth guard: admins only ─────────────────────────────────────────────
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BulkClassifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { force, limit } = parsed.data;

    await connectToDatabase();

    // Build query: only PENDING_REVIEW unless force=true
    const query = force ? {} : { classificationReviewStatus: 'PENDING_REVIEW' };

    const projects = await Project.find(query)
      .select('_id externalId title description isSoftwareRelated category classificationReviewStatus')
      .limit(limit)
      .lean();

    if (projects.length === 0) {
      return NextResponse.json({
        data: { processed: 0, updated: 0, failed: 0, message: 'No projects to classify' },
      });
    }

    let updated = 0;
    let failed = 0;

    // Classify in series to avoid overwhelming Vertex AI quotas
    for (const project of projects) {
      try {
        const titleEn = (project.title as { en: string })?.en ?? '';
        const descEn = (project.description as { en: string })?.en ?? '';

        const result = await classifyProject(titleEn, descEn);

        await Project.findByIdAndUpdate(project._id, {
          $set: {
            category: result.category,
            isSoftwareRelated: result.isSoftwareRelated,
            aiConfidence: result.confidence,
            // Only set PENDING_REVIEW if not already reviewed by human
            ...(!(project.classificationReviewStatus === 'APPROVED' ||
              project.classificationReviewStatus === 'CORRECTED')
              ? { classificationReviewStatus: 'PENDING_REVIEW' }
              : {}),
          },
        });
        updated++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      data: {
        processed: projects.length,
        updated,
        failed,
        message: `Classified ${updated}/${projects.length} projects successfully`,
      },
    });
  } catch (err) {
    console.error('[POST /api/admin/classify-bulk]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
