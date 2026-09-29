// =============================================================================
// services/notification-preferences.ts - Notification Preferences Service
// (Supports Issue #137)
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import UserSettings from '@/models/UserSettings';
import { NOTIFICATION_CONFIG } from '@/config/notification';
import { NotificationPreferences, NotificationType } from '@/types/notification';

// In-memory preferences fallback cache for when DB is unavailable or in unit tests
const inMemoryPreferences: Map<string, NotificationPreferences> = new Map();

export function getRegisteredRecipientIds(): string[] {
  return Array.from(inMemoryPreferences.keys());
}

/**
 * Retrieves the notification preferences for a specific recipient (user or session).
 * Returns default preferences if not yet configured.
 */
export async function getNotificationPreferences(
  recipientId: string,
): Promise<NotificationPreferences> {
  try {
    await connectToDatabase();
    const settings = await UserSettings.findOne({ sessionId: recipientId }).lean();

    if (settings) {
      return {
        recipientId,
        inAppNotif: settings.inAppNotif ?? NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.inAppNotif,
        newOpportunity: settings.newOpportunity ?? settings.newProjectAlert ?? NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.newOpportunity,
        savedUpdate: settings.savedUpdate ?? NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.savedUpdate,
        deadlineReminder: settings.deadlineReminder ?? settings.closingAlert ?? NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.deadlineReminder,
        emailNotif: settings.emailNotif ?? NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.emailNotif,
        dailyDigest: settings.dailyDigest ?? NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.dailyDigest,
        keywords: Array.isArray(settings.keywords) ? settings.keywords : [...NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.keywords],
        interestTags: Array.isArray(settings.interestTags) ? settings.interestTags : [...NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.interestTags],
        agencies: Array.isArray(settings.agencies) ? settings.agencies : [...NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.agencies],
        budgetMin: settings.budgetMin ?? null,
        budgetMax: settings.budgetMax ?? null,
        language: settings.language || NOTIFICATION_CONFIG.DEFAULT_PREFERENCES.language,
        email: settings.email ?? null,
      };
    }
  } catch {
    // Proceed to in-memory fallback
  }

  if (inMemoryPreferences.has(recipientId)) {
    return inMemoryPreferences.get(recipientId)!;
  }

  const defaultPref: NotificationPreferences = {
    recipientId,
    ...NOTIFICATION_CONFIG.DEFAULT_PREFERENCES,
  };
  return defaultPref;
}

/**
 * Persists updated notification preferences to the database and cache.
 * Applies immediately in real time.
 */
export async function updateNotificationPreferences(
  recipientId: string,
  update: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(recipientId);
  const merged: NotificationPreferences = {
    ...current,
    ...update,
    recipientId,
  };

  try {
    await connectToDatabase();
    await UserSettings.findOneAndUpdate(
      { sessionId: recipientId },
      {
        $set: {
          sessionId: recipientId,
          inAppNotif: merged.inAppNotif ?? true,
          emailNotif: merged.emailNotif,
          dailyDigest: merged.dailyDigest,
          closingAlert: merged.deadlineReminder,
          newProjectAlert: merged.newOpportunity,
          newOpportunity: merged.newOpportunity,
          savedUpdate: merged.savedUpdate,
          deadlineReminder: merged.deadlineReminder,
          keywords: merged.keywords ?? [],
          interestTags: merged.interestTags,
          agencies: merged.agencies ?? [],
          budgetMin: merged.budgetMin,
          budgetMax: merged.budgetMax,
          language: merged.language,
          email: merged.email ?? null,
        },
      },
      { upsert: true, new: true },
    );
  } catch {
    // Fall back to memory cache
  }

  inMemoryPreferences.set(recipientId, merged);
  return merged;
}

/**
 * Evaluates whether an outbound notification should be delivered based on
 * the recipient's configured preferences.
 */
export async function shouldDeliverNotification(
  recipientId: string,
  eventType: NotificationType,
  procurement?: {
    category?: string;
    budget?: number;
    requiredTechnologies?: string[];
  },
): Promise<boolean> {
  const prefs = await getNotificationPreferences(recipientId);

  // 1. Check category toggle
  switch (eventType) {
    case 'PROCUREMENT_MATCHED':
      if (!prefs.newOpportunity) return false;
      break;
    case 'PROCUREMENT_UPDATED':
    case 'STATUS_CHANGED':
    case 'TOR_UPDATED':
      if (!prefs.savedUpdate) return false;
      break;
    case 'DEADLINE_APPROACHING':
      if (!prefs.deadlineReminder) return false;
      break;
    default:
      break;
  }

  // 2. For matched procurements, check budget thresholds
  if (eventType === 'PROCUREMENT_MATCHED' && procurement) {
    if (procurement.budget !== undefined && procurement.budget !== null) {
      if (prefs.budgetMin !== null && procurement.budget < prefs.budgetMin) {
        return false;
      }
      if (prefs.budgetMax !== null && procurement.budget > prefs.budgetMax) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Evaluates whether an in-app notification should be created.
 * Enforces: inAppNotif !== false AND general category eligibility.
 */
export async function shouldDeliverInApp(
  recipientId: string,
  eventType: NotificationType,
  procurement?: {
    category?: string;
    budget?: number;
    requiredTechnologies?: string[];
  },
): Promise<boolean> {
  const prefs = await getNotificationPreferences(recipientId);
  if (prefs.inAppNotif === false) {
    return false;
  }
  return await shouldDeliverNotification(recipientId, eventType, procurement);
}

/**
 * Evaluates whether an email notification should be sent.
 * Enforces: emailNotif === true AND general category eligibility.
 */
export async function shouldDeliverEmail(
  recipientId: string,
  eventType: NotificationType,
  procurement?: {
    category?: string;
    budget?: number;
    requiredTechnologies?: string[];
  },
): Promise<boolean> {
  const prefs = await getNotificationPreferences(recipientId);
  if (!prefs.emailNotif) {
    return false;
  }
  return await shouldDeliverNotification(recipientId, eventType, procurement);
}
