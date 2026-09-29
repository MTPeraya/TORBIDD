// =============================================================================
// app/docs/[...path]/route.ts - Backward Compatibility for Legacy /docs/ URLs
// Redirects /docs/[fileName] or /docs/[projectId]/[fileName] to /api/documents/...
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: pathSegments } = await params;
    const fileName = pathSegments[pathSegments.length - 1] || 'document.pdf';
    const cleanFileName = decodeURIComponent(fileName);

    // Try to extract project ID from path or filename
    let projectId = pathSegments.length > 1 ? pathSegments[0] : '';
    if (!projectId) {
      const match = cleanFileName.match(/\d{5,11}/);
      if (match) {
        projectId = match[0];
      } else {
        const numMatch = cleanFileName.match(/\d+/);
        if (numMatch) {
          projectId = numMatch[0];
        }
      }
    }

    const extId = projectId && projectId.length === 11 ? projectId : '66119169049';
    return NextResponse.redirect(
      `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${extId}`,
      307,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to route document', message }, { status: 500 });
  }
}
