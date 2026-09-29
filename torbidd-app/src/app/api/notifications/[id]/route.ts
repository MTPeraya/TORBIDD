// =============================================================================
// app/api/notifications/[id]/route.ts - Operations on a single notification
// (Supports Issue #136)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getSessionId } from '@/lib/session';
import { markAsRead, deleteNotification } from '@/services/database/notifications';

export const dynamic = 'force-dynamic';

function resolveRecipientId(req: NextRequest): string {
  const authUser = getAuthSessionFromRequest(req);
  if (authUser?.id) return authUser.id;
  if (authUser?.email) return authUser.email;
  return getSessionId(req);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const recipientId = resolveRecipientId(req);
    const success = await markAsRead(recipientId, id);

    if (!success) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('[PATCH /api/notifications/[id]]', err);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const recipientId = resolveRecipientId(req);
    const success = await deleteNotification(recipientId, id);

    if (!success) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('[DELETE /api/notifications/[id]]', err);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 },
    );
  }
}
