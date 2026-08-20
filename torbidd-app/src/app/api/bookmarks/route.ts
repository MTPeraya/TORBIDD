// =============================================================================
// app/api/bookmarks/route.ts - GET /api/bookmarks, POST /api/bookmarks
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getBookmarks, addBookmark } from '@/services/database/bookmarks';
import { BookmarkCreateSchema } from '@/lib/validation';
import { getSessionId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    try {
      const bookmarks = await getBookmarks(sessionId);
      return NextResponse.json({ data: bookmarks });
    } catch {
      return NextResponse.json({ data: [] });
    }
  } catch (err) {
    console.error('[GET /api/bookmarks]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    const body = await req.json();
    const parsed = BookmarkCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      await addBookmark(sessionId, parsed.data.projectId);
    } catch {}

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/bookmarks]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
