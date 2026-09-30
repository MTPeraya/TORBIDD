// =============================================================================
// services/database/notifications.ts - Notification Repository & DB Access
// (Supports Issue #133 & UC-11)
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import Notification, { INotification } from '@/models/Notification';
import {
  NotificationFeedResponse,
  NotificationItem,
  NotificationPriority,
  NotificationType,
  NotificationMetadata,
} from '@/types/notification';

export interface CreateNotificationParams {
  recipientId: string;
  procurementId: string;
  type: NotificationType;
  priority?: NotificationPriority;
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
  idempotencyKey?: string;
}

export interface GetNotificationsOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

// In-memory fallback for local dev / tests when MongoDB is disconnected
const inMemoryNotifications: NotificationItem[] = [];

function mapDocToItem(doc: Partial<INotification> & { _id?: unknown }): NotificationItem {
  return {
    id: doc._id ? String(doc._id) : (doc as unknown as { id?: string }).id || '',
    recipientId: doc.recipientId || '',
    procurementId: doc.procurementId || '',
    type: doc.type as NotificationType,
    priority: (doc.priority || 'MEDIUM') as NotificationPriority,
    title: doc.title || { th: '', en: '' },
    message: doc.message || { th: '', en: '' },
    linkUrl: doc.linkUrl || '',
    metadata: doc.metadata,
    isRead: !!doc.isRead,
    readAt: doc.readAt || null,
    idempotencyKey: doc.idempotencyKey,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Creates a new notification with deduplication and idempotency safeguards.
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<NotificationItem | null> {
  const {
    recipientId,
    procurementId,
    type,
    priority = 'MEDIUM',
    title,
    message,
    linkUrl,
    metadata = {},
    idempotencyKey,
  } = params;

  try {
    await connectToDatabase();

    // Deduplication check via idempotency key if provided
    if (idempotencyKey) {
      const existing = await Notification.findOne({ idempotencyKey }).lean();
      if (existing) {
        return mapDocToItem(existing);
      }
    }

    const created = await Notification.create({
      recipientId,
      procurementId,
      type,
      priority,
      title,
      message,
      linkUrl,
      metadata,
      idempotencyKey,
      isRead: false,
    });

    return mapDocToItem(created.toObject());
  } catch (err: unknown) {
    // Check for MongoDB duplicate key error (code 11000)
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
      if (idempotencyKey) {
        const existing = await Notification.findOne({ idempotencyKey }).lean();
        if (existing) return mapDocToItem(existing);
      }
      return null;
    }

    // In-memory fallback
    if (idempotencyKey && inMemoryNotifications.some((n) => n.idempotencyKey === idempotencyKey)) {
      return inMemoryNotifications.find((n) => n.idempotencyKey === idempotencyKey)!;
    }

    const fallbackItem: NotificationItem = {
      id: `mock-notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      recipientId,
      procurementId,
      type,
      priority,
      title,
      message,
      linkUrl,
      metadata,
      isRead: false,
      readAt: null,
      idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryNotifications.unshift(fallbackItem);
    return fallbackItem;
  }
}

/**
 * Retrieves paginated notifications and total unread count for a recipient.
 */
export async function getNotifications(
  recipientId: string,
  options: GetNotificationsOptions = {},
): Promise<NotificationFeedResponse> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(50, options.limit || 15));
  const skip = (page - 1) * limit;

  try {
    await connectToDatabase();

    const query: Record<string, unknown> = { recipientId };
    if (options.unreadOnly) {
      query.isRead = false;
    }
    if (options.type) {
      query.type = options.type;
    }

    const [docs, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId, isRead: false }),
    ]);

    return {
      data: docs.map(mapDocToItem),
      unreadCount,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch {
    // In-memory fallback filtering
    let filtered = inMemoryNotifications.filter((n) => n.recipientId === recipientId);
    if (options.unreadOnly) {
      filtered = filtered.filter((n) => !n.isRead);
    }
    if (options.type) {
      filtered = filtered.filter((n) => n.type === options.type);
    }

    const total = filtered.length;
    const unreadCount = inMemoryNotifications.filter(
      (n) => n.recipientId === recipientId && !n.isRead,
    ).length;
    const paged = filtered.slice(skip, skip + limit);

    return {
      data: paged,
      unreadCount,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

/**
 * Gets total unread notifications count for a recipient.
 */
export async function getUnreadCount(recipientId: string): Promise<number> {
  try {
    await connectToDatabase();
    return await Notification.countDocuments({ recipientId, isRead: false });
  } catch {
    return inMemoryNotifications.filter((n) => n.recipientId === recipientId && !n.isRead).length;
  }
}

/**
 * Marks an individual notification as read.
 */
export async function markAsRead(recipientId: string, notificationId: string): Promise<boolean> {
  try {
    await connectToDatabase();
    const result = await Notification.updateOne(
      { _id: notificationId, recipientId },
      { $set: { isRead: true, readAt: new Date() } },
    );
    if (result.matchedCount > 0) return true;
  } catch {
    // DB not connected, proceed to check in-memory
  }

  const inMem = inMemoryNotifications.find(
    (n) => n.id === notificationId && n.recipientId === recipientId,
  );
  if (inMem) {
    inMem.isRead = true;
    inMem.readAt = new Date().toISOString();
    return true;
  }
  return false;
}

/**
 * Marks all notifications for a recipient as read.
 */
export async function markAllAsRead(recipientId: string): Promise<number> {
  try {
    await connectToDatabase();
    const result = await Notification.updateMany(
      { recipientId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return result.modifiedCount;
  } catch {
    let count = 0;
    inMemoryNotifications.forEach((n) => {
      if (n.recipientId === recipientId && !n.isRead) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
        count++;
      }
    });
    return count;
  }
}

/**
 * Deletes a notification by ID.
 */
export async function deleteNotification(
  recipientId: string,
  notificationId: string,
): Promise<boolean> {
  try {
    await connectToDatabase();
    const result = await Notification.deleteOne({ _id: notificationId, recipientId });
    if (result.deletedCount > 0) return true;
  } catch {
    // Proceed to in-memory fallback
  }

  const idx = inMemoryNotifications.findIndex(
    (n) => n.id === notificationId && n.recipientId === recipientId,
  );
  if (idx >= 0) {
    inMemoryNotifications.splice(idx, 1);
    return true;
  }
  return false;
}
