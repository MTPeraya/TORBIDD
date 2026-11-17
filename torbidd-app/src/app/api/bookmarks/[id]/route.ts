// =============================================================================
// app/api/bookmarks/[id]/route.ts - DELETE /api/bookmarks/[id]
// SEC-06: Resource Ownership and Object-Level Authorization — ASVS V8.2.2
// =============================================================================
// Before deleting, verifies ownership when the user is authenticated.
// Returns 404 (not 403) for cross-user bookmark access to avoid leaking existence.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { removeBookmark } from '@/services/database/bookmarks';
import { getSessionId } from '@/lib/session';
import { getAuthSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionId = getSessionId(req);

    // SEC-06: Resolve authenticated user ID for ownership scoping
    const authUser = getAuthSessionFromRequest(req);
    const userId = authUser?.id ?? null;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    try {
      // SEC-06: removeBookmark scopes deletion by userId (when authenticated),
      // returning false when the bookmark exists but belongs to another user.
      // The caller returns 404 — not 403 — to avoid leaking existence (ASVS V8.2.2).
      const removed = await removeBookmark(sessionId, id, userId);
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
