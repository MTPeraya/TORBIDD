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

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json(
        {
          error: 'TOR Document Not Found',
          message: `No downloaded TOR document found for project ${cleanId}. Run document ingestion first.`,
        },
        { status: 404 },
      );
    }

    // Run automated extraction (Vertex AI multimodal with heuristic fallback)
    const result = await extractTorFromFile(filePath, {
      projectId: cleanId,
      fileName: path.basename(filePath),
      projectContext: {
        projectName: project?.projectName,
        agencyName: project?.agencyName,
        budget: project?.budget,
        fiscalYear: project?.fiscalYear,
        procurementType: project?.procurementType,
      },
    });

    // Update database
    const updatedProject = await updateProcurementProjectExtraction(cleanId, result);

    return NextResponse.json({
      success: true,
      message: 'TOR document successfully processed automatically',
      projectId: cleanId,
      sourceDocument: path.basename(filePath),
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
