// =============================================================================
// app/api/documents/[projectId]/[fileName]/route.ts - Redirect to Official e-GP
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import connectToDatabase from '@/lib/mongodb';
import ProcurementProject from '@/models/ProcurementProject';
import Project from '@/models/Project';

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
      try {
        await connectToDatabase();
        const numId = parseInt(cleanProjectId, 10);
        if (!isNaN(numId)) {
          const pp = await ProcurementProject.findOne({
            $or: [{ externalProjectId: cleanProjectId }, { revision: numId }],
          }).lean();
          if (pp?.externalProjectId) {
            targetExtId = pp.externalProjectId;
          } else {
            const p = await Project.findOne({ externalId: numId }).lean();
            if (p && (p as unknown as Record<string, unknown>).externalProjectId) {
              targetExtId = String((p as unknown as Record<string, unknown>).externalProjectId);
            }
          }
        }
      } catch {}
    }

    const egpPortalUrl = `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${targetExtId}`;

    // Redirect to the official government procurement e-GP announcement portal
    return NextResponse.redirect(egpPortalUrl, 307);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to redirect to e-GP', message }, { status: 500 });
  }
}
