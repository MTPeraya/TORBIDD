// =============================================================================
// app/api/bookmarks/[id]/route.ts - DELETE /api/bookmarks/[id]
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { removeBookmark } from '@/services/database/bookmarks';
import { getSessionId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionId = getSessionId(req);

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    try {
      const removed = await removeBookmark(sessionId, id);
      if (!removed) {
        return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/bookmarks/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
