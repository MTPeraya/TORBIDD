// =============================================================================
// app/api/notifications/route.ts - GET, PATCH, POST /api/notifications
// (Supports Issue #136 & UC-11)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getSessionId } from '@/lib/session';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  createNotification,
} from '@/services/database/notifications';
import { NotificationType } from '@/types/notification';

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
    const { searchParams } = req.nextUrl;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '15', 10);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = (searchParams.get('type') as NotificationType) || undefined;

    const result = await getNotifications(recipientId, {
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 15 : limit,
      unreadOnly,
      type,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/notifications]', err);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const recipientId = resolveRecipientId(req);
    const body = await req.json();

    if (body.action === 'markAllRead') {
      const modifiedCount = await markAllAsRead(recipientId);
      return NextResponse.json({ success: true, modifiedCount });
    }

    if (body.action === 'markRead' && body.id) {
      const success = await markAsRead(recipientId, String(body.id));
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
  } catch (err) {
    console.error('[PATCH /api/notifications]', err);
    return NextResponse.json(
      { error: 'Failed to update notification status' },
      { status: 500 },
    );
  }
}

// Development and testing helper to generate a sample notification
export async function POST(req: NextRequest) {
  try {
    const recipientId = resolveRecipientId(req);
    const body = await req.json();

    const notif = await createNotification({
      recipientId,
      procurementId: body.procurementId || '67119538991',
      type: body.type || 'PROCUREMENT_MATCHED',
      priority: body.priority || 'MEDIUM',
      title: body.title || {
        th: 'โครงการจัดซื้อใหม่ตรงกับความสนใจ',
        en: 'New Matching Procurement Opportunity',
      },
      message: body.message || {
        th: 'พบโครงการใหม่ที่ตรงกับหมวดหมู่ที่คุณติดตาม',
        en: 'A new procurement matching your profile is available',
      },
      linkUrl: body.linkUrl || '/opportunities/67119538991',
      metadata: body.metadata || {},
    });

    return NextResponse.json({ success: true, data: notif });
  } catch (err) {
    console.error('[POST /api/notifications]', err);
    return NextResponse.json(
      { error: 'Failed to create test notification' },
      { status: 500 },
    );
  }
}
