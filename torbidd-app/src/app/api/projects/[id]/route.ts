// =============================================================================
// app/api/projects/[id]/route.ts - GET, PUT, DELETE /api/projects/[id]
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
import { enrichProjectDetail } from '@/lib/projectDetailHelper';
import { Project } from '@/types/project';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';

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
        // Automatic AI Extraction: If not yet extracted, trigger extraction automatically in background / server
        const procProj = procurementData.project as unknown as {
          extractionStatus?: string;
          summary?: { th?: string };
          externalProjectId?: string;
          projectName?: string;
          agencyName?: string;
          budget?: number;
          fiscalYear?: number;
          procurementType?: string;
          deadline?: Date;
          contractDate?: Date;
          contractFinishDate?: Date;
        };

        if (procProj.extractionStatus !== 'EXTRACTED' || !procProj.summary?.th) {
          try {
            const extId = procProj.externalProjectId || cleanId;
            const documents = procurementData.documents || [];
            const torDoc = documents.find(
              (d) => d.documentType === 'ATTACH_TOR' || d.fileName.toLowerCase().includes('tor'),
            );
            
            let filePath = torDoc?.storageReference;
            const { getIngestionConfig } = await import('@/lib/config');
            const pathModule = await import('node:path');
            const fsModule = await import('node:fs');
            
            if (!filePath || !fsModule.existsSync(filePath)) {
              const storageBase = getIngestionConfig().resolvedStoragePath;
              const candidateDir = pathModule.join(storageBase, extId);
              if (fsModule.existsSync(candidateDir)) {
                const files = fsModule.readdirSync(candidateDir);
                const torFile = files.find((f) => f.toLowerCase().includes('tor') || f.toLowerCase().endsWith('.pdf'));
                if (torFile) {
                  filePath = pathModule.join(candidateDir, torFile);
                }
              }
            }

            const projectContext = {
              projectName: procProj.projectName,
              agencyName: procProj.agencyName,
              budget: procProj.budget,
              fiscalYear: procProj.fiscalYear,
              procurementType: procProj.procurementType,
              deadline: procProj.deadline ? new Date(procProj.deadline).toISOString().split('T')[0] : undefined,
              contractFinishDate: procProj.contractFinishDate ? new Date(procProj.contractFinishDate).toISOString().split('T')[0] : undefined,
              contractDate: procProj.contractDate ? new Date(procProj.contractDate).toISOString().split('T')[0] : undefined,
            };

            const { extractTorFromFile, extractTorFromBuffer } = await import('@/services/ai/tor-extractor');
            const { updateProcurementProjectExtraction } = await import('@/services/database/procurement');

            let extractResult;
            if (filePath && fsModule.existsSync(filePath)) {
              extractResult = await extractTorFromFile(filePath, {
                projectId: extId,
                fileName: pathModule.basename(filePath),
                projectContext,
              });
            } else {
              extractResult = await extractTorFromBuffer(undefined, {
                projectId: extId,
                fileName: `e-GP_Announcement_${extId}`,
                projectContext,
              });
            }

            if (extractResult) {
              const updated = await updateProcurementProjectExtraction(extId, extractResult);
              if (updated) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                procurementData.project = (typeof (updated as any).toObject === 'function' ? (updated as any).toObject() : updated);
              }
            }
          } catch (autoExtractErr) {
            console.warn(`[Auto-Extraction] Background extraction skipped for ${cleanId}:`, autoExtractErr);
          }
        }

        const { procurementToProject } = await import('@/lib/project-mapper');
        const mapped = procurementToProject(procurementData.project);
        const enriched = enrichProjectDetail(mapped);
        return NextResponse.json({
          data: {
            ...enriched,
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
          const documents = await getDocumentsByProjectId(String(numId));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const projectObj = typeof (project as any).toObject === 'function' ? (project as any).toObject() : project;
          return NextResponse.json({
            data: {
              ...enrichProjectDetail(projectObj as unknown as Project),
              documents,
            },
          });
        }
      } catch {}

    }

    // 3. Try ObjectId against existing Project model
    if (/^[0-9a-fA-F]{24}$/.test(cleanId)) {
      try {
        const project = await getProjectById(cleanId);
        if (project) {
          const documents = await getDocumentsByProjectId(cleanId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const projectObj = typeof (project as any).toObject === 'function' ? (project as any).toObject() : project;
          return NextResponse.json({
            data: {
              ...enrichProjectDetail(projectObj as unknown as Project),
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
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

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
