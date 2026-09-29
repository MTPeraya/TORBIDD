// =============================================================================
// app/api/notifications/trigger-evaluation/route.ts - On-demand Notification Evaluation
// (Supports UC-11, Issue #134, Issue #135)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getSessionId } from '@/lib/session';
import { notifyMatchingUsers } from '@/services/procurement-matching';
import { notifySavedProcurementUpdate } from '@/services/procurement-diff';
import { INITIAL_PROJECTS } from '@/lib/initialData';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    const recipientId = authUser?.id || authUser?.email || getSessionId(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'demo_seed';

    if (action === 'evaluate_new' && body.procurement) {
      const created = await notifyMatchingUsers(body.procurement);
      return NextResponse.json({ success: true, count: created.length, notifications: created });
    }

    if (action === 'evaluate_update' && body.oldProcurement && body.newProcurement) {
      const created = await notifySavedProcurementUpdate(body.oldProcurement, body.newProcurement);
      return NextResponse.json({ success: true, count: created.length, notifications: created });
    }

    // Default demo: generates representative notifications for user experience
    const sampleProjects = INITIAL_PROJECTS.slice(0, 3);
    const generated = [];

    for (const project of sampleProjects) {
      const res = await notifyMatchingUsers({
        id: String(project.externalId),
        externalId: project.externalId,
        title: project.title,
        department: project.department,
        budget: project.budget,
        category: project.category,
        requiredTechnologies: project.requiredTechnologies,
        description: project.description,
      });
      generated.push(...res);
    }

    return NextResponse.json({
      success: true,
      recipientId,
      evaluatedProjectsCount: sampleProjects.length,
      generatedCount: generated.length,
      notifications: generated,
    });
  } catch (err) {
    console.error('[POST /api/notifications/trigger-evaluation]', err);
    return NextResponse.json(
      { error: 'Failed to execute notification evaluation pipeline' },
      { status: 500 },
    );
  }
}
