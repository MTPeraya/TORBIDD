// =============================================================================
// models/SyncError.ts - Mongoose Schema for Dead Letter Queue (DLQ) & Sync Errors
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';

export type DlqStatus = 'PENDING' | 'RESOLVED' | 'DISCARDED';

export interface ISyncError extends Document {
  errorCode: string;
  errorMessage: string;
  requestUrl?: string;
  requestParameters?: Record<string, unknown>;
  stackTrace?: string;
  payloadSnippet?: string;
  retryCount: number;
  source: string;
  status: DlqStatus;
  alertSent: boolean;
  alertSentAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SyncErrorSchema = new Schema<ISyncError>(
  {
    errorCode: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    errorMessage: {
      type: String,
      required: true,
      trim: true,
    },
    requestUrl: {
      type: String,
      trim: true,
    },
    requestParameters: {
      type: Schema.Types.Mixed,
      default: {},
    },
    stackTrace: {
      type: String,
      trim: true,
    },
    payloadSnippet: {
      type: String,
      trim: true,
    },
    retryCount: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    source: {
      type: String,
      required: true,
      default: 'CKAN_GOVSPENDING',
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED', 'DISCARDED'],
      default: 'PENDING',
      index: true,
    },
    alertSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    alertSentAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: String,
      trim: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

SyncErrorSchema.index({ status: 1, createdAt: -1 });

const SyncError: Model<ISyncError> =
  (mongoose.models.SyncError as Model<ISyncError>) ??
  mongoose.model<ISyncError>('SyncError', SyncErrorSchema);

export default SyncError;
