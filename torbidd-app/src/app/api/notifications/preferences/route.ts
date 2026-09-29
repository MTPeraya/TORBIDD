// =============================================================================
// app/api/notifications/preferences/route.ts - User Notification Preferences API
// (Supports Issue #137)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getSessionId } from '@/lib/session';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/services/notification-preferences';

import { NotificationPreferencesSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

function resolveRecipientId(req: NextRequest): string {
  const authUser = getAuthSessionFromRequest(req);
  if (authUser?.id) return authUser.id;
  if (authUser?.email) return authUser.email;
  return getSessionId(req);
}

export async function GET(req: NextRequest) {
  try {
    const recipientId = resolveRecipientId(req);
    const prefs = await getNotificationPreferences(recipientId);
    return NextResponse.json({ data: prefs });
  } catch (err) {
    console.error('[GET /api/notifications/preferences]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve notification preferences' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const recipientId = resolveRecipientId(req);
    const body = await req.json();

    const validationResult = NotificationPreferencesSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid preference values', details: validationResult.error.format() },
        { status: 400 },
      );
    }

    const updated = await updateNotificationPreferences(recipientId, validationResult.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PUT /api/notifications/preferences]', err);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 },
    );
  }
}
