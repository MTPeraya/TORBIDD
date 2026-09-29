// =============================================================================
// app/api/documents/[projectId]/[fileName]/route.ts - Redirect to Official e-GP
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { INITIAL_PROJECTS } from '@/lib/initialData';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileName: string }> },
) {
  try {
    const { projectId } = await params;
    const cleanProjectId = path.basename(projectId.trim());

    // Resolve project ID (handle 11-digit e-GP ID or internal ID)
    let targetExtId = cleanProjectId;
    if (cleanProjectId.length !== 11) {
      const numId = parseInt(cleanProjectId, 10);
      const found = INITIAL_PROJECTS.find((p) => p.externalId === numId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (found && (found as any).externalProjectId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetExtId = String((found as any).externalProjectId);
      } else {
        targetExtId = '66119169049';
      }
    }

    const egpPortalUrl = `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${targetExtId}`;

    // Redirect to the official government procurement e-GP announcement portal
    return NextResponse.redirect(egpPortalUrl, 307);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to redirect to e-GP', message }, { status: 500 });
  }
}
