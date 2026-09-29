// =============================================================================
// models/SystemMetadata.ts - Mongoose Schema for System Metadata & Last Sync State
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';
import { SyncTriggerType } from './SyncLog';

export type SystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export interface ISystemMetadata extends Document {
  key: string;
  lastSuccessfulSyncAt?: Date;
  lastAttemptAt: Date;
  lastStatus: SystemHealthStatus;
  recordsSyncedCount: number;
  lastTriggerType: SyncTriggerType;
  lastErrorMessage?: string;
  nextScheduledSyncAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SystemMetadataSchema = new Schema<ISystemMetadata>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    lastSuccessfulSyncAt: {
      type: Date,
      index: true,
    },
    lastAttemptAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastStatus: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'DOWN'],
      default: 'HEALTHY',
    },
    recordsSyncedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastTriggerType: {
      type: String,
      enum: ['manual', 'scheduled'],
      default: 'manual',
    },
    lastErrorMessage: {
      type: String,
      trim: true,
    },
    nextScheduledSyncAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

const SystemMetadata: Model<ISystemMetadata> =
  (mongoose.models.SystemMetadata as Model<ISystemMetadata>) ??
  mongoose.model<ISystemMetadata>('SystemMetadata', SystemMetadataSchema);

export default SystemMetadata;
