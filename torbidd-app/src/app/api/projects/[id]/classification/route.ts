// =============================================================================
// app/api/projects/[id]/classification/route.ts
// PATCH /api/projects/:id/classification  — Admin override for UC-10
// Allows system administrators to review, approve, or correct AI classifications.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Project from '@/models/Project';
import ProcurementProject from '@/models/ProcurementProject';
import { VALID_CATEGORIES } from '@/lib/validation';

const ClassificationOverrideSchema = z.object({
  category: z.enum(VALID_CATEGORIES),
  isSoftwareRelated: z.boolean(),
  classificationReviewStatus: z.enum(['APPROVED', 'CORRECTED']),
  classificationReviewNote: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Auth guard: admins only ─────────────────────────────────────────────
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || authUser.role !== 'admin') {
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

    const { id } = await params;
    const idStr = String(id).trim();

    // Support both numeric externalId and MongoDB _id
    const filter = /^\d+$/.test(idStr) ? { externalId: Number(idStr) } : { _id: idStr };

    const updated = await Project.findOneAndUpdate(
      filter,
      {
        $set: {
          category: parsed.data.category,
          isSoftwareRelated: parsed.data.isSoftwareRelated,
          classificationReviewStatus: parsed.data.classificationReviewStatus,
          classificationReviewNote: parsed.data.classificationReviewNote ?? null,
          classificationReviewedBy: authUser.id ?? authUser.email ?? 'admin',
          classificationReviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    );

    if (updated) {
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
    }

    // Fallback: check ProcurementProject
    const procFilter = {
      $or: [
        { externalProjectId: idStr },
        ...( /^[0-9a-fA-F]{24}$/.test(idStr) ? [{ _id: idStr }] : [] ),
      ],
    };

    const updatedProc = await ProcurementProject.findOneAndUpdate(
      procFilter,
      {
        $set: {
          software_category: parsed.data.category,
          is_software: parsed.data.isSoftwareRelated,
          admin_reviewed: true,
          classified_by: 'admin',
          classified_at: new Date(),
          classification_reason:
            parsed.data.classificationReviewNote ||
            (parsed.data.isSoftwareRelated
              ? 'Administrator confirmed software classification (UC-10)'
              : 'Administrator confirmed non-software listing (UC-4 A5)'),
        },
      },
      { new: true },
    );

    if (updatedProc) {
      return NextResponse.json({
        data: {
          _id: updatedProc._id,
          externalId: updatedProc.externalProjectId,
          category: updatedProc.software_category,
          isSoftwareRelated: updatedProc.is_software,
          classificationReviewStatus: parsed.data.classificationReviewStatus,
          classificationReviewNote: parsed.data.classificationReviewNote,
          classificationReviewedBy: authUser.id ?? authUser.email ?? 'admin',
          classificationReviewedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  } catch (err) {
    console.error('[PATCH /api/projects/:id/classification]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/projects/:id/classification — fetch classification detail only
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectToDatabase();

    const { id } = await params;
    const idStr = String(id).trim();
    const filter = /^\d+$/.test(idStr) ? { externalId: Number(idStr) } : { _id: idStr };

    const project = await Project.findOne(filter).select(
      'externalId title category isSoftwareRelated aiConfidence classificationReviewStatus classificationReviewedBy classificationReviewedAt classificationReviewNote',
    );

    if (project) {
      return NextResponse.json({ data: project });
    }

    // Fallback: check ProcurementProject
    const procFilter = {
      $or: [
        { externalProjectId: idStr },
        ...( /^[0-9a-fA-F]{24}$/.test(idStr) ? [{ _id: idStr }] : [] ),
      ],
    };
    const proc = await ProcurementProject.findOne(procFilter);
    if (proc) {
      return NextResponse.json({
        data: {
          _id: proc._id,
          externalId: proc.externalProjectId,
          title: { th: proc.projectName, en: proc.projectName },
          category: proc.software_category || 'Information System',
          isSoftwareRelated: proc.is_software ?? true,
          aiConfidence: proc.ai_confidence || 'High',
          classificationReviewStatus: proc.admin_reviewed ? 'APPROVED' : 'PENDING_REVIEW',
          classificationReviewedBy: proc.classified_by,
          classificationReviewedAt: proc.classified_at,
          classificationReviewNote: proc.classification_reason,
        },
      });
    }

    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  } catch (err) {
    console.error('[GET /api/projects/:id/classification]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
