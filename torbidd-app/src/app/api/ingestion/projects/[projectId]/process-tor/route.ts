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

    let documents = await getDocumentsByProjectId(cleanId);

    // 1. Look for ANNOUNCEMENT document (e-GP official notice containing real agency, budget, timeline, fiscal year)
    let announDoc = documents.find(
      (d) =>
        d.documentType === 'ANNOUNCEMENT' ||
        d.fileName.toLowerCase().startsWith('annoudoc') ||
        d.fileName.toLowerCase().includes('bidding notice') ||
        d.fileName.toLowerCase().includes('notice'),
    );

    // 2. Look for ATTACH_TOR document (technical specifications & scope)
    let torDoc = documents.find(
      (d) => d.documentType === 'ATTACH_TOR' || d.fileName.toLowerCase().includes('tor'),
    );

    let torFilePath = torDoc?.storageReference;
    let announFilePath = announDoc?.storageReference;

    const storageBase = getIngestionConfig().resolvedStoragePath;
    const candidateDir = path.join(storageBase, cleanId);

    if ((!torFilePath || !fs.existsSync(torFilePath)) && fs.existsSync(candidateDir)) {
      const files = fs.readdirSync(candidateDir);
      const torFile = files.find((f) => f.toLowerCase().includes('tor') || f.toLowerCase().endsWith('.pdf'));
      if (torFile) torFilePath = path.join(candidateDir, torFile);
    }

    if ((!announFilePath || !fs.existsSync(announFilePath)) && fs.existsSync(candidateDir)) {
      const files = fs.readdirSync(candidateDir);
      const aFile = files.find((f) => f.toLowerCase().startsWith('annoudoc') || f.toLowerCase().includes('notice'));
      if (aFile) announFilePath = path.join(candidateDir, aFile);
    }

    // If documents not found locally, attempt to ingest/download ZIP package from e-GP
    if ((!torFilePath || !fs.existsSync(torFilePath)) && (!announFilePath || !fs.existsSync(announFilePath))) {
      try {
        const { IngestionService } = await import('@/services/ingestion/ingestion.service');
        const ingestionService = new IngestionService();
        await ingestionService.ingestProjectDocuments(cleanId);

        documents = await getDocumentsByProjectId(cleanId);
        announDoc = documents.find(
          (d) =>
            d.documentType === 'ANNOUNCEMENT' ||
            d.fileName.toLowerCase().startsWith('annoudoc') ||
            d.fileName.toLowerCase().includes('bidding notice') ||
            d.fileName.toLowerCase().includes('notice'),
        );
        torDoc = documents.find(
          (d) => d.documentType === 'ATTACH_TOR' || d.fileName.toLowerCase().includes('tor'),
        );

        if (fs.existsSync(candidateDir)) {
          const files = fs.readdirSync(candidateDir);
          const torFile = files.find((f) => f.toLowerCase().includes('tor') || f.toLowerCase().endsWith('.pdf'));
          if (torFile) torFilePath = path.join(candidateDir, torFile);

          const aFile = files.find((f) => f.toLowerCase().startsWith('annoudoc') || f.toLowerCase().includes('notice'));
          if (aFile) announFilePath = path.join(candidateDir, aFile);
        }
      } catch (ingestErr) {
        console.warn(`[Process-TOR] Auto document ingestion attempt for ${cleanId}:`, ingestErr);
      }
    }

    // Extract official announcement metadata (Fiscal Year, Budget, Timeline, Agency) if announcement doc exists
    let announResult = null;
    if (announFilePath && fs.existsSync(announFilePath)) {
      try {
        const { extractAnnouncementFromFile } = await import('@/services/ai/tor-extractor');
        announResult = await extractAnnouncementFromFile(announFilePath, {
          projectId: cleanId,
          fileName: path.basename(announFilePath),
        });
      } catch (announErr) {
        console.warn(`[Process-TOR] Announcement extraction failed for ${cleanId}:`, announErr);
      }
    }

    const projectContext = {
      projectName: announResult?.projectName || project?.projectName,
      agencyName: announResult?.agencyName || project?.agencyName,
      budget: announResult?.budget || project?.budget,
      fiscalYear: announResult?.fiscalYear || project?.fiscalYear,
      procurementType: announResult?.procurementMethod || project?.procurementType,
      deadline: announResult?.deadline || (project?.deadline ? new Date(project.deadline).toISOString().split('T')[0] : undefined),
      contractFinishDate: (project as unknown as Record<string, unknown>)?.contractFinishDate
        ? new Date((project as unknown as Record<string, unknown>).contractFinishDate as string).toISOString().split('T')[0]
        : undefined,
      contractDate: (project as unknown as Record<string, unknown>)?.contractDate
        ? new Date((project as unknown as Record<string, unknown>).contractDate as string).toISOString().split('T')[0]
        : undefined,
    };

    let result;
    if (torFilePath && fs.existsSync(torFilePath)) {
      // Run automated extraction on downloaded TOR file
      result = await extractTorFromFile(torFilePath, {
        projectId: cleanId,
        fileName: path.basename(torFilePath),
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

    const finalResult = {
      ...result,
      agencyName: announResult?.agencyName || projectContext.agencyName,
      fiscalYear: announResult?.fiscalYear || projectContext.fiscalYear,
      budget: announResult?.budget || result.budget || projectContext.budget,
      medianPrice: announResult?.medianPrice || result.medianPrice,
      publishDate: announResult?.publishDate || result.publishDate,
      deadline: announResult?.deadline || result.deadline,
      timeline: announResult?.timeline || result.timeline,
    };

    // Update database with comprehensive official announcement and TOR specs
    const updatedProject = await updateProcurementProjectExtraction(cleanId, finalResult);

    return NextResponse.json({
      success: true,
      message: torFilePath
        ? 'TOR document and official announcement successfully processed'
        : 'Project procurement details and requirements successfully extracted by AI',
      projectId: cleanId,
      sourceDocument: torFilePath ? path.basename(torFilePath) : `e-GP_Announcement_${cleanId}`,
      confidence: result.confidence,
      extraction: finalResult,
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
