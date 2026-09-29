// =============================================================================
// models/SyncLog.ts - Mongoose Schema for API Synchronization Logs
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';

export type SyncTriggerType = 'manual' | 'scheduled';
export type SyncStatusType = 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';

export interface ISyncLog extends Document {
  triggerType: SyncTriggerType;
  status: SyncStatusType;
  recordsSyncedCount: number;
  source: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  errorMessage?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SyncLogSchema = new Schema<ISyncLog>(
  {
    triggerType: {
      type: String,
      enum: ['manual', 'scheduled'],
      required: true,
      default: 'manual',
      index: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'IN_PROGRESS'],
      required: true,
      default: 'IN_PROGRESS',
      index: true,
    },
    recordsSyncedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      required: true,
      default: 'CKAN_GOVSPENDING & National e-GP',
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      index: true,
    },
    durationMs: {
      type: Number,
      min: 0,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

SyncLogSchema.index({ status: 1, completedAt: -1 });

const SyncLog: Model<ISyncLog> =
  (mongoose.models.SyncLog as Model<ISyncLog>) ??
  mongoose.model<ISyncLog>('SyncLog', SyncLogSchema);

export default SyncLog;
