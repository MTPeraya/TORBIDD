// =============================================================================
// app/api/projects/[id]/classification/route.ts
// PATCH /api/projects/:id/classification  — Admin override for UC-10
// Allows system administrators to review, approve, or correct AI classifications.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Project from '@/models/Project';
import { VALID_CATEGORIES } from '@/lib/validation';

const ClassificationOverrideSchema = z.object({
  category: z.enum(VALID_CATEGORIES),
  isSoftwareRelated: z.boolean(),
  classificationReviewStatus: z.enum(['APPROVED', 'CORRECTED']),
  classificationReviewNote: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // ── Auth guard: admins only ─────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = ClassificationOverrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const { id } = params;

    // Support both numeric externalId and MongoDB _id
    const filter = /^\d+$/.test(id) ? { externalId: Number(id) } : { _id: id };

    const updated = await Project.findOneAndUpdate(
      filter,
      {
        $set: {
          category: parsed.data.category,
          isSoftwareRelated: parsed.data.isSoftwareRelated,
          classificationReviewStatus: parsed.data.classificationReviewStatus,
          classificationReviewNote: parsed.data.classificationReviewNote ?? null,
          classificationReviewedBy: (session.user as { id?: string; email?: string }).id
            ?? session.user.email
            ?? 'admin',
          classificationReviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        _id: updated._id,
        externalId: updated.externalId,
        category: updated.category,
        isSoftwareRelated: updated.isSoftwareRelated,
        classificationReviewStatus: updated.classificationReviewStatus,
        classificationReviewNote: updated.classificationReviewNote,
        classificationReviewedBy: updated.classificationReviewedBy,
        classificationReviewedAt: updated.classificationReviewedAt,
      },
    });
  } catch (err) {
    console.error('[PATCH /api/projects/:id/classification]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/projects/:id/classification — fetch classification detail only
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectToDatabase();

    const { id } = params;
    const filter = /^\d+$/.test(id) ? { externalId: Number(id) } : { _id: id };

    const project = await Project.findOne(filter).select(
      'externalId title category isSoftwareRelated aiConfidence classificationReviewStatus classificationReviewedBy classificationReviewedAt classificationReviewNote',
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ data: project });
  } catch (err) {
    console.error('[GET /api/projects/:id/classification]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
