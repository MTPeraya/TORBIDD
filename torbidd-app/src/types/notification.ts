// =============================================================================
// types/notification.ts - Notification Types, Event Schemas & Payload Contracts
// (Supports UC-11, Issues #132, #133, #134, #135, #136, #137, #140)
// =============================================================================

export type NotificationType =
  | 'PROCUREMENT_MATCHED'
  | 'PROCUREMENT_UPDATED'
  | 'DEADLINE_APPROACHING'
  | 'STATUS_CHANGED'
  | 'TOR_UPDATED';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type NotificationChannel = 'in_app' | 'email' | 'line' | 'webhook';

export interface ChangedFieldRecord {
  field: string;
  fieldLabel: {
    th: string;
    en: string;
  };
  oldValue: unknown;
  newValue: unknown;
  description?: {
    th: string;
    en: string;
  };
}

export interface NotificationMetadata {
  procurementTitle?: {
    th: string;
    en: string;
  };
  procurementCategory?: string;
  procurementBudget?: number;
  agencyName?: string;
  changedFields?: ChangedFieldRecord[];
  matchReasons?: string[];
  daysRemaining?: number;
  revision?: number;
  sourceUrl?: string;
  [key: string]: unknown;
}

export interface NotificationItem {
  id: string;
  recipientId: string; // auth userId or session UUID
  procurementId: string; // externalId or MongoDB ObjectId
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
  readAt?: Date | string | null;
  idempotencyKey?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface NotificationPreferences {
  recipientId?: string;
  inAppNotif?: boolean;
  newOpportunity: boolean;
  savedUpdate: boolean;
  deadlineReminder: boolean;
  emailNotif: boolean;
  dailyDigest: boolean;
  keywords?: string[];
  interestTags: string[];
  agencies?: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  language: 'th' | 'en';
  email?: string | null;
}

export interface OpportunityEmailPayload {
  recipientEmail: string;
  recipientName?: string;
  project: {
    id: string | number;
    title: { th: string; en: string } | string;
    department?: { th: string; en: string } | string;
    budget?: number;
    deadline?: Date | string;
    category?: string;
    description?: { th: string; en: string } | string;
  };
  matchReasons?: string[];
}

export interface DeadlineReminderEmailPayload {
  recipientEmail: string;
  recipientName?: string;
  project: {
    id: string | number;
    title: { th: string; en: string } | string;
    department?: { th: string; en: string } | string;
    budget?: number;
    deadline: Date | string;
  };
  daysRemaining: number;
}

export interface NotificationFeedResponse {
  data: NotificationItem[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProcurementMatchingResult {
  isMatch: boolean;
  score: number;
  reasons: string[];
  matchedTags: string[];
}

export interface ProcurementDiffResult {
  hasMeaningfulChange: boolean;
  changeType: NotificationType;
  priority: NotificationPriority;
  changedFields: ChangedFieldRecord[];
  summary: {
    th: string;
    en: string;
  };
}
