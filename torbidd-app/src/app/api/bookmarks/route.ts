// =============================================================================
// app/api/bookmarks/route.ts - GET /api/bookmarks, POST /api/bookmarks
// SEC-06: Resource Ownership and Object-Level Authorization — ASVS V8.2.2
// =============================================================================
// When the user is authenticated, bookmarks are scoped by userId.
// Anonymous users continue to use sessionId scoping (unchanged).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getBookmarks, addBookmark } from '@/services/database/bookmarks';
import { BookmarkCreateSchema } from '@/lib/validation';
import { getSessionId } from '@/lib/session';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { applyAntiCacheHeaders } from '@/lib/security-headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    // SEC-06: Resolve authenticated user ID for ownership scoping
    const authUser = getAuthSessionFromRequest(req);
    const userId = authUser?.id ?? null;

    try {
      const bookmarks = await getBookmarks(sessionId, userId);
      return applyAntiCacheHeaders(NextResponse.json({ data: bookmarks }));
    } catch {
      return applyAntiCacheHeaders(NextResponse.json({ data: [] }));
    }
  } catch (err) {
    console.error('[GET /api/bookmarks]', err);
    return applyAntiCacheHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    // SEC-06: Resolve authenticated user ID for ownership scoping
    const authUser = getAuthSessionFromRequest(req);
    const userId = authUser?.id ?? null;

    const body = await req.json();
    const parsed = BookmarkCreateSchema.safeParse(body);

    if (!parsed.success) {
      return applyAntiCacheHeaders(
        NextResponse.json(
          { error: 'Invalid request body', details: parsed.error.flatten() },
          { status: 400 },
        ),
      );
    }

    try {
      await addBookmark(sessionId, parsed.data.projectId, userId);
    } catch {}

    return applyAntiCacheHeaders(NextResponse.json({ success: true }, { status: 201 }));
  } catch (err) {
    console.error('[POST /api/bookmarks]', err);
    return applyAntiCacheHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
