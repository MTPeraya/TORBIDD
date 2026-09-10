// =============================================================================
// app/api/projects/[id]/route.ts - GET /api/projects/[id]
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectById,
  getProjectByExternalId,
  updateProject,
  deleteProject,
} from '@/services/database/projects';
import { ProjectUpdateSchema } from '@/lib/validation';
import { INITIAL_PROJECTS } from '@/lib/initialData';
import { enrichProjectDetail } from '@/lib/projectDetailHelper';
import { Project } from '@/types/project';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Check if numeric externalId
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      try {
        const project = await getProjectByExternalId(numId);
        if (project) {
          return NextResponse.json({
            data: enrichProjectDetail(project as unknown as Project),
          });
        }
      } catch {}
      const fallback = INITIAL_PROJECTS.find((p) => p.externalId === numId);
      if (fallback) {
        return NextResponse.json({ data: enrichProjectDetail(fallback) });
      }
    }

    // Check if ObjectId
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      try {
        const project = await getProjectById(id);
        if (project) {
          return NextResponse.json({
            data: enrichProjectDetail(project as unknown as Project),
          });
        }
      } catch {}
    }

    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  } catch (err) {
    console.error('[GET /api/projects/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = ProjectUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      const updated = await updateProject(id, parsed.data);
      if (updated) {
        return NextResponse.json({
          data: enrichProjectDetail(updated as unknown as Project),
          success: true,
        });
      }
    } catch {}

    // Fallback response for offline or mock item
    return NextResponse.json({
      data: {
        id,
        ...parsed.data,
        updatedAt: new Date().toISOString(),
      },
      success: true,
      isMock: true,
    });
  } catch (err) {
    console.error('[PUT /api/projects/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    try {
      const deleted = await deleteProject(id);
      if (deleted) {
        return NextResponse.json({ success: true, id });
      }
    } catch {}

    // Fallback success for offline/mock deletions
    return NextResponse.json({ success: true, id, isMock: true });
  } catch (err) {
    console.error('[DELETE /api/projects/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

