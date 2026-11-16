// =============================================================================
// services/database/bookmarks.ts - Bookmark Repository
// SEC-06: Resource Ownership and Object-Level Authorization — ASVS V8.2.2
// =============================================================================
// When an authenticated userId is provided, bookmarks are scoped to that user.
// Anonymous callers fall back to sessionId scoping (unchanged behaviour).
// This prevents IDOR: a user cannot read or delete another user's bookmarks.
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import Bookmark from '@/models/Bookmark';
import mongoose from 'mongoose';

/**
 * Retrieve all bookmarks for a session or authenticated user.
 *
 * @param sessionId The anonymous session ID (always present).
 * @param userId    Optional authenticated user ID. When provided, bookmarks
 *                  are filtered by userId (SEC-06 ownership scope).
 */
export async function getBookmarks(sessionId: string, userId?: string | null): Promise<string[]> {
  await connectToDatabase();

  // SEC-06: Prefer user-scoped query when authenticated
  const query = userId
    ? { userId }
    : { sessionId };

  const bookmarks = await Bookmark.find(query).select('projectId').lean();
  return bookmarks.map((b) => b.projectId.toString());
}

/**
 * Add a bookmark for a session or authenticated user.
 *
 * @param sessionId The anonymous session ID.
 * @param projectId The project to bookmark.
 * @param userId    Optional authenticated user ID.
 */
export async function addBookmark(
  sessionId: string,
  projectId: string,
  userId?: string | null,
): Promise<void> {
  await connectToDatabase();
  await Bookmark.findOneAndUpdate(
    { sessionId, projectId: new mongoose.Types.ObjectId(projectId) },
    {
      sessionId,
      projectId: new mongoose.Types.ObjectId(projectId),
      // SEC-06: Associate bookmark with authenticated user when available
      ...(userId ? { userId } : {}),
    },
    { upsert: true },
  );
}

/**
 * Remove a bookmark, enforcing ownership when userId is provided.
 *
 * SEC-06: When userId is provided, deletion is scoped to that user's bookmarks.
 * If the bookmark exists but belongs to a different user, `removed` will be
 * false (the caller returns 404 to avoid leaking existence — ASVS V8.2.2).
 *
 * @param sessionId The anonymous session ID.
 * @param projectId The project whose bookmark to remove.
 * @param userId    Optional authenticated user ID for ownership scoping.
 */
export async function removeBookmark(
  sessionId: string,
  projectId: string,
  userId?: string | null,
): Promise<boolean> {
  await connectToDatabase();

  // SEC-06: Scope deletion by userId when authenticated
  const filter = userId
    ? { userId, projectId: new mongoose.Types.ObjectId(projectId) }
    : { sessionId, projectId: new mongoose.Types.ObjectId(projectId) };

  const result = await Bookmark.deleteOne(filter);
  return result.deletedCount > 0;
}
