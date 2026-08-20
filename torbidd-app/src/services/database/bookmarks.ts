// =============================================================================
// services/database/bookmarks.ts - Bookmark Repository
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import Bookmark from '@/models/Bookmark';
import mongoose from 'mongoose';

export async function getBookmarks(sessionId: string): Promise<string[]> {
  await connectToDatabase();
  const bookmarks = await Bookmark.find({ sessionId }).select('projectId').lean();
  return bookmarks.map((b) => b.projectId.toString());
}

export async function addBookmark(sessionId: string, projectId: string): Promise<void> {
  await connectToDatabase();
  await Bookmark.findOneAndUpdate(
    { sessionId, projectId: new mongoose.Types.ObjectId(projectId) },
    { sessionId, projectId: new mongoose.Types.ObjectId(projectId) },
    { upsert: true },
  );
}

export async function removeBookmark(sessionId: string, projectId: string): Promise<boolean> {
  await connectToDatabase();
  const result = await Bookmark.deleteOne({
    sessionId,
    projectId: new mongoose.Types.ObjectId(projectId),
  });
  return result.deletedCount > 0;
}
