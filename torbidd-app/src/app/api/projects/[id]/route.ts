// =============================================================================
// app/api/projects/[id]/route.ts - GET /api/projects/[id]
// Returns project metadata and its associated documents.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectById,
  getProjectByExternalId,
  updateProject,
  deleteProject,
} from '@/services/database/projects';
import {
  getProjectWithDocuments,
  getDocumentsByProjectId,
} from '@/services/database/procurement';
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
    const cleanId = id.trim();

    // 1. Try finding in ProcurementProject + ProcurementDocument
    try {
      const procurementData = await getProjectWithDocuments(cleanId);
      if (procurementData) {
        const { procurementToProject } = await import('@/lib/project-mapper');
        const mapped = procurementToProject(procurementData.project);
        return NextResponse.json({
          data: {
            ...procurementData.project,
            ...mapped,
            documents: procurementData.documents,
          },
        });
      }
    } catch {
      // Continue to try Project model
    }

    // 2. Try numeric externalId against existing Project model
    const numId = parseInt(cleanId, 10);
    if (!isNaN(numId)) {
      try {
        const project = await getProjectByExternalId(numId);
        if (project) {
          return NextResponse.json({
            data: enrichProjectDetail(project as unknown as Project),
          });
        }
        if (project) {
          const documents = await getDocumentsByProjectId(String(numId));
          return NextResponse.json({
            data: {
              ...(typeof project.toObject === 'function' ? project.toObject() : project),
              documents,
            },
          });
        }
      } catch {}

      const fallback = INITIAL_PROJECTS.find((p) => p.externalId === numId);
      if (fallback) {
        return NextResponse.json({
          data: {
            ...fallback,
            documents: [],
          },
        });
      }
      if (fallback) {
        return NextResponse.json({ data: enrichProjectDetail(fallback) });
      }
    }

    // 3. Try ObjectId against existing Project model
    if (/^[0-9a-fA-F]{24}$/.test(cleanId)) {
      try {
        const project = await getProjectById(id);
        if (project) {
          return NextResponse.json({
            data: enrichProjectDetail(project as unknown as Project),
          });
        }
        const project = await getProjectById(cleanId);
        if (project) {
          const documents = await getDocumentsByProjectId(cleanId);
          return NextResponse.json({
            data: {
              ...(typeof project.toObject === 'function' ? project.toObject() : project),
              documents,
            },
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

