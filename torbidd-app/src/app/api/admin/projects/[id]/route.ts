// =============================================================================
// app/api/admin/projects/[id]/route.ts
// Administrative Project Mutation & Management (SEC-21 / ASVS V15.3.1, V15.3.3, V15.4.2)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorization/backend';
import connectToDatabase from '@/lib/mongodb';
import ProcurementProject from '@/models/ProcurementProject';
import { AdminProjectUpdateSchema } from '@/lib/validation';
import { applyAntiCacheHeaders } from '@/lib/security-headers';
import { isPrototypePollutionKey } from '@/lib/safe-object';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    const authCheck = requireAdmin(authUser);
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const { id } = await params;
    const cleanId = id.trim();

    await connectToDatabase();

    // Query atomically by externalProjectId or MongoDB _id
    const project = await ProcurementProject.findOne({
      $or: [
        { externalProjectId: cleanId },
        ...(/^[0-9a-fA-F]{24}$/.test(cleanId) ? [{ _id: cleanId }] : []),
      ],
    })
      .select('externalProjectId projectName agencyName budget fiscalYear procurementType is_software software_category classification_reason admin_reviewed createdAt updatedAt')
      .lean();

    if (!project) {
      return applyAntiCacheHeaders(
        NextResponse.json({ error: 'Project not found' }, { status: 404 }),
      );
    }

    return applyAntiCacheHeaders(NextResponse.json({ success: true, data: project }));
  } catch (err) {
    console.error('[GET /api/admin/projects/[id]]', err);
    return applyAntiCacheHeaders(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleUpdate(req, params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleUpdate(req, params);
}

async function handleUpdate(
  req: NextRequest,
  paramsPromise: Promise<{ id: string }>,
) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    const authCheck = requireAdmin(authUser);
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const { id } = await paramsPromise;
    const cleanId = id.trim();

    const rawBody = await req.json();

    // ASVS req_id 15.3.6: Reject prototype pollution attempts
    for (const key of Object.keys(rawBody)) {
      if (isPrototypePollutionKey(key)) {
        return applyAntiCacheHeaders(
          NextResponse.json(
            { error: 'Invalid payload: prototype pollution key detected' },
            { status: 400 },
          ),
        );
      }
    }

    // ASVS req_id 15.3.3: Countermeasures against mass assignment via strict schema allowlisting
    const parsed = AdminProjectUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return applyAntiCacheHeaders(
        NextResponse.json(
          {
            error: 'Invalid project update fields (mass assignment blocked)',
            details: parsed.error.flatten(),
          },
          { status: 400 },
        ),
      );
    }

    await connectToDatabase();

    // ASVS req_id 15.4.2: Enforce atomic state checks and updates to prevent TOCTOU race conditions
    const updated = await ProcurementProject.findOneAndUpdate(
      {
        $or: [
          { externalProjectId: cleanId },
          ...(/^[0-9a-fA-F]{24}$/.test(cleanId) ? [{ _id: cleanId }] : []),
        ],
      },
      {
        $set: {
          ...parsed.data,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    ).select('externalProjectId projectName agencyName budget fiscalYear procurementType is_software software_category classification_reason admin_reviewed updatedAt');

    if (!updated) {
      return applyAntiCacheHeaders(
        NextResponse.json({ error: 'Project not found' }, { status: 404 }),
      );
    }

    return applyAntiCacheHeaders(
      NextResponse.json({
        success: true,
        message: 'Project updated successfully',
        data: updated,
      }),
    );
  } catch (err) {
    console.error('[UPDATE /api/admin/projects/[id]]', err);
    return applyAntiCacheHeaders(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    const authCheck = requireAdmin(authUser);
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const { id } = await params;
    const cleanId = id.trim();

    await connectToDatabase();

    // ASVS req_id 15.4.2: Atomic single operation deletion
    const deleted = await ProcurementProject.findOneAndDelete({
      $or: [
        { externalProjectId: cleanId },
        ...(/^[0-9a-fA-F]{24}$/.test(cleanId) ? [{ _id: cleanId }] : []),
      ],
    });

    if (!deleted) {
      return applyAntiCacheHeaders(
        NextResponse.json({ error: 'Project not found' }, { status: 404 }),
      );
    }

    return applyAntiCacheHeaders(
      NextResponse.json({ success: true, message: 'Project deleted successfully', id: cleanId }),
    );
  } catch (err) {
    console.error('[DELETE /api/admin/projects/[id]]', err);
    return applyAntiCacheHeaders(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    );
  }
}
