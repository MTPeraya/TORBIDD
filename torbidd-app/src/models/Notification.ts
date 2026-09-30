// =============================================================================
// models/Notification.ts - Mongoose Schema & Model for User Notifications
// (Supports Issue #133 & UC-11)
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';
import { NotificationPriority, NotificationType, NotificationMetadata } from '@/types/notification';

export interface INotification extends Document {
  recipientId: string; // Auth user ID or session UUID
  procurementId: string; // External project ID or MongoDB ID
  type: NotificationType;
  priority: NotificationPriority;
  title: {
    th: string;
    en: string;
  };
  message: {
    th: string;
    en: string;
  };
  linkUrl: string;
  metadata?: NotificationMetadata;
  isRead: boolean;
  readAt?: Date | null;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BilingualSchema = new Schema(
  {
    th: { type: String, required: true },
    en: { type: String, required: true },
  },
  { _id: false },
);

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    procurementId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'PROCUREMENT_MATCHED',
        'PROCUREMENT_UPDATED',
        'DEADLINE_APPROACHING',
        'STATUS_CHANGED',
        'TOR_UPDATED',
      ],
      index: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    title: {
      type: BilingualSchema,
      required: true,
    },
    message: {
      type: BilingualSchema,
      required: true,
    },
    linkUrl: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// High performance compound indexes for fast feed retrieval & unread counts
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, type: 1, createdAt: -1 });

const Notification: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) ??
  mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
