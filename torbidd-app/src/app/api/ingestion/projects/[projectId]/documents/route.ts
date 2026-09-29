// =============================================================================
// app/api/ingestion/projects/[projectId]/documents/route.ts
// POST /api/ingestion/projects/[projectId]/documents
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdParamSchema } from '@/lib/validation';
import { IngestionService } from '@/services/ingestion/ingestion.service';

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

    const service = new IngestionService();
    const result = await service.ingestProjectDocuments(parsed.data.projectId);

    return NextResponse.json({
      success: true,
      projectId: result.projectId,
      externalProjectId: result.externalProjectId,
      documentsFound: result.documentsFound,
      alreadyIngested: result.alreadyIngested ?? false,
      documents: result.documents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/ingestion/projects/[projectId]/documents]', message);

    if (message.includes('must contain exactly 11 numeric digits')) {
      return NextResponse.json(
        { error: 'Invalid Project ID format', message },
        { status: 400 },
      );
    }

    if (
      message.includes('no document metadata') ||
      message.includes('No downloadable archive') ||
      message.includes('has no downloadable announcement archive')
    ) {
      return NextResponse.json(
        { error: 'Archive Not Found', message },
        { status: 404 },
      );
    }

    if (message.includes('Missing ATTACH_TOR')) {
      return NextResponse.json(
        { error: 'Missing ATTACH_TOR', message },
        { status: 422 },
      );
    }

    if (message.includes('not a valid ZIP') || message.includes('unsafe path traversal')) {
      return NextResponse.json(
        { error: 'Invalid or Malicious Archive', message },
        { status: 400 },
      );
    }

    if (message.includes('network error') || message.includes('connection failed') || message.includes('timeout')) {
      return NextResponse.json(
        { error: 'e-GP Service Unavailable', message },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: 'Document ingestion failed', message },
      { status: 500 },
    );
  }
}
