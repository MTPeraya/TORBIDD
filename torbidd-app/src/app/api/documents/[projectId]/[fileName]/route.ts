// =============================================================================
// app/api/documents/[projectId]/[fileName]/route.ts - Serve Extracted Documents
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileName: string }> },
) {
  try {
    const { projectId, fileName } = await params;
    const cleanProjectId = path.basename(projectId.trim());
    const cleanFileName = path.basename(decodeURIComponent(fileName.trim()));

    const filePath = path.resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      'storage',
      'documents',
      cleanProjectId,
      cleanFileName,
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(cleanFileName)}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to read document', message }, { status: 500 });
  }
}
