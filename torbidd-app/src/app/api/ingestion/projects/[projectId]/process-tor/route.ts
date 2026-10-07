// =============================================================================
// app/api/ingestion/projects/[projectId]/process-tor/route.ts
// POST /api/ingestion/projects/[projectId]/process-tor
// Issue #91: Automated TOR document processing endpoint
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { ProjectIdParamSchema } from '@/lib/validation';
import { extractTorFromFile } from '@/services/ai/tor-extractor';
import {
  getDocumentsByProjectId,
  getProcurementProjectByExternalId,
  updateProcurementProjectExtraction,
} from '@/services/database/procurement';
import { getIngestionConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const parsed = ProjectIdParamSchema.safeParse({ projectId });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid Project ID',
          details: 'Project ID must be an 11-digit numeric string',
        },
        { status: 400 },
      );
    }

    const cleanId = parsed.data.projectId;
    const project = await getProcurementProjectByExternalId(cleanId);

    // Prevent redundant LLM calls if already extracted and cached in database (unless ?force=true)
    const force = _req.nextUrl.searchParams.get('force') === 'true';
    if (!force && project?.extractionStatus === 'EXTRACTED' && project?.summary?.th) {
      return NextResponse.json({
        success: true,
        message: 'TOR document summary already extracted and cached in database',
        cached: true,
        projectId: cleanId,
        confidence: 'High',
        extraction: {
          summary: project.summary,
          requiredTechnologies: project.requiredTechnologies || [],
          technicalRequirements: project.technicalRequirements || { th: [], en: [] },
          extractedQualifications: project.extractedQualifications || [],
        },
        updatedProject: project,
      });
    }

    const documents = await getDocumentsByProjectId(cleanId);

    // Look for ATTACH_TOR document
    const torDoc = documents.find(
      (d) => d.documentType === 'ATTACH_TOR' || d.fileName.toLowerCase().includes('tor'),
    );

    let filePath = torDoc?.storageReference;
    if (!filePath || !fs.existsSync(filePath)) {
      // Check default storage folder
      const storageBase = getIngestionConfig().resolvedStoragePath;
      const candidateDir = path.join(storageBase, cleanId);
      if (fs.existsSync(candidateDir)) {
        const files = fs.readdirSync(candidateDir);
        const torFile = files.find((f) => f.toLowerCase().includes('tor') || f.toLowerCase().endsWith('.pdf'));
        if (torFile) {
          filePath = path.join(candidateDir, torFile);
        }
      }
    }

    // If not found locally, attempt to ingest/download from e-GP
    if (!filePath || !fs.existsSync(filePath)) {
      try {
        const { IngestionService } = await import('@/services/ingestion/ingestion.service');
        const ingestionService = new IngestionService();
        await ingestionService.ingestProjectDocuments(cleanId);

        const storageBase = getIngestionConfig().resolvedStoragePath;
        const candidateDir = path.join(storageBase, cleanId);
        if (fs.existsSync(candidateDir)) {
          const files = fs.readdirSync(candidateDir);
          const torFile = files.find((f) => f.toLowerCase().includes('tor') || f.toLowerCase().endsWith('.pdf'));
          if (torFile) {
            filePath = path.join(candidateDir, torFile);
          }
        }
      } catch (ingestErr) {
        console.warn(`[Process-TOR] Auto document ingestion attempt for ${cleanId}:`, ingestErr);
      }
    }

    const projectContext = {
      projectName: project?.projectName,
      agencyName: project?.agencyName,
      budget: project?.budget,
      fiscalYear: project?.fiscalYear,
      procurementType: project?.procurementType,
      deadline: project?.deadline ? new Date(project.deadline).toISOString().split('T')[0] : undefined,
      contractFinishDate: (project as unknown as Record<string, unknown>)?.contractFinishDate
        ? new Date((project as unknown as Record<string, unknown>).contractFinishDate as string).toISOString().split('T')[0]
        : undefined,
      contractDate: (project as unknown as Record<string, unknown>)?.contractDate
        ? new Date((project as unknown as Record<string, unknown>).contractDate as string).toISOString().split('T')[0]
        : undefined,
    };

    let result;
    if (filePath && fs.existsSync(filePath)) {
      // Run automated extraction on downloaded PDF file
      result = await extractTorFromFile(filePath, {
        projectId: cleanId,
        fileName: path.basename(filePath),
        projectContext,
      });
    } else {
      // Fall back gracefully: extract and synthesize from project context and announcement data
      const { extractTorFromBuffer } = await import('@/services/ai/tor-extractor');
      result = await extractTorFromBuffer(undefined, {
        projectId: cleanId,
        fileName: `e-GP_Announcement_${cleanId}`,
        projectContext,
      });
    }

    // Update database
    const updatedProject = await updateProcurementProjectExtraction(cleanId, result);

    return NextResponse.json({
      success: true,
      message: filePath
        ? 'TOR document successfully processed automatically'
        : 'Project procurement details and requirements successfully extracted by AI',
      projectId: cleanId,
      sourceDocument: filePath ? path.basename(filePath) : `e-GP_Announcement_${cleanId}`,
      confidence: result.confidence,
      extraction: result,
      updatedProject,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/ingestion/projects/[projectId]/process-tor]', message);

    return NextResponse.json(
      { error: 'Automatic TOR processing failed', message },
      { status: 500 },
    );
  }
}
