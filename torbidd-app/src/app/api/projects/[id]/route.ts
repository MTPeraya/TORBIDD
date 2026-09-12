// =============================================================================
// app/api/projects/[id]/route.ts - GET /api/projects/[id]
// Returns project metadata and its associated documents.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getProjectById, getProjectByExternalId } from '@/services/database/projects';
import {
  getProjectWithDocuments,
  getDocumentsByProjectId,
} from '@/services/database/procurement';
import { INITIAL_PROJECTS } from '@/lib/initialData';

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
        return NextResponse.json({
          data: {
            ...procurementData.project,
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
    }

    // 3. Try ObjectId against existing Project model
    if (/^[0-9a-fA-F]{24}$/.test(cleanId)) {
      try {
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
