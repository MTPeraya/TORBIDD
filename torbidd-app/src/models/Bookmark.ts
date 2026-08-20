// =============================================================================
// models/Bookmark.ts - Mongoose Schema for User Bookmarks
// =============================================================================

import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IBookmark extends Document {
  sessionId: string;
  projectId: Types.ObjectId;
  createdAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>(
  {
    sessionId: { type: String, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Compound unique index: one bookmark per session per project
BookmarkSchema.index({ sessionId: 1, projectId: 1 }, { unique: true });

const Bookmark: Model<IBookmark> =
  (mongoose.models.Bookmark as Model<IBookmark>) ?? mongoose.model<IBookmark>('Bookmark', BookmarkSchema);

export default Bookmark;
