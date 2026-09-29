// =============================================================================
// config/notification.ts - Notification Rules, Thresholds & Configuration
// (Supports Issues #132, #137, #140)
// =============================================================================

import { NotificationPriority, NotificationType, NotificationPreferences } from '@/types/notification';

export const NOTIFICATION_CONFIG = {
  // Deduplication suppression window in milliseconds
  DEDUPLICATION_WINDOW_MS: 60 * 60 * 1000, // 1 hour

  // Approaching deadline thresholds in days
  DEADLINE_REMINDER_DAYS: [3, 1],

  // Default pagination limit for notification feed
  DEFAULT_PAGE_SIZE: 15,
  MAX_PAGE_SIZE: 50,

  // Default notification preferences for new users
  DEFAULT_PREFERENCES: {
    newOpportunity: true,
    savedUpdate: true,
    deadlineReminder: true,
    emailNotif: true,
    dailyDigest: true,
    interestTags: ['Website', 'AI'],
    budgetMin: null,
    budgetMax: null,
    language: 'th' as const,
  } satisfies Omit<NotificationPreferences, 'recipientId'>,

  // Event Priority Mapping
  EVENT_PRIORITY: {
    PROCUREMENT_MATCHED: 'MEDIUM' as NotificationPriority,
    PROCUREMENT_UPDATED: 'HIGH' as NotificationPriority,
    DEADLINE_APPROACHING: 'URGENT' as NotificationPriority,
    STATUS_CHANGED: 'HIGH' as NotificationPriority,
    TOR_UPDATED: 'HIGH' as NotificationPriority,
  } satisfies Record<NotificationType, NotificationPriority>,

  // Meaningful change qualification rules (Issue #140)
  MEANINGFUL_CHANGE_RULES: {
    // Fields where any change triggers a notification
    CRITICAL_FIELDS: ['status', 'deadline', 'budget', 'contractPrice', 'revision', 'extractionStatus'],

    // Minimum budget change percentage that triggers an update (0 means any change)
    MIN_BUDGET_CHANGE_RATIO: 0.0,

    // Excluded fields that should NEVER trigger notifications
    EXCLUDED_FIELDS: ['_id', 'id', 'updatedAt', 'createdAt', 'discoveredAt', 'processedDate', '__v'],
  },
};
