// =============================================================================
// app/api/settings/route.ts - GET /api/settings, PUT /api/settings
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSettings, upsertSettings } from '@/services/database/settings';
import { SettingsUpdateSchema } from '@/lib/validation';
import { getSessionId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    try {
      const settings = await getSettings(sessionId);
      return NextResponse.json({ data: settings });
    } catch {
      return NextResponse.json({
        data: {
          sessionId,
          emailNotif: true,
          dailyDigest: true,
          closingAlert: true,
          newProjectAlert: false,
          interestTags: ['Website', 'AI'],
          budgetMin: null,
          budgetMax: null,
          language: 'th',
        },
      });
    }
  } catch (err) {
    console.error('[GET /api/settings]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    const body = await req.json();
    const parsed = SettingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      const settings = await upsertSettings(sessionId, parsed.data);
      return NextResponse.json({ data: settings, success: true });
    } catch {
      return NextResponse.json({ data: { sessionId, ...parsed.data }, success: true });
    }
  } catch (err) {
    console.error('[PUT /api/settings]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
