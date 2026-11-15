// =============================================================================
// models/Bookmark.ts - Mongoose Schema for User Bookmarks
// =============================================================================

import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IBookmark extends Document {
  sessionId: string;
  projectId: Types.ObjectId;
  /**
   * SEC-06: Authenticated user ID (Google sub / MongoDB _id string).
   * When set, ownership checks use this field instead of sessionId.
   * null for anonymous (session-only) bookmarks.
   */
  userId: string | null;
  createdAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>(
  {
    sessionId: { type: String, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    /**
     * SEC-06: Authenticated user identifier.
     * Null for anonymous (session-scoped) bookmarks.
     * When present, ownership checks use this field (ASVS V8.2.2).
     */
    userId: { type: String, default: null, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Compound unique index: one bookmark per session per project
BookmarkSchema.index({ sessionId: 1, projectId: 1 }, { unique: true });

// Sparse index for user-scoped bookmark queries (SEC-06)
BookmarkSchema.index({ userId: 1, projectId: 1 }, { sparse: true });

const Bookmark: Model<IBookmark> =
  (mongoose.models.Bookmark as Model<IBookmark>) ?? mongoose.model<IBookmark>('Bookmark', BookmarkSchema);

export default Bookmark;
