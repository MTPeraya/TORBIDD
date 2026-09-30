// =============================================================================
// services/procurement-matching.ts - Procurement Matching Engine
// (Supports UC-6 & Issue #134: New Matching Procurement & Channel Delivery)
// =============================================================================

import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import UserSettings from '@/models/UserSettings';
import User from '@/models/User';
import { createNotification } from '@/services/database/notifications';
import {
  getNotificationPreferences,
  shouldDeliverNotification,
  getRegisteredRecipientIds,
} from '@/services/notification-preferences';
import { emailDeliveryService } from '@/services/notifications/email-delivery.service';
import {
  NotificationItem,
  NotificationPreferences,
  ProcurementMatchingResult,
} from '@/types/notification';

export interface ProcurementMatchTarget {
  id?: string;
  externalId?: number | string;
  title: { th: string; en: string } | string;
  department?: { th: string; en: string } | string;
  agencyName?: string;
  budget?: number;
  category?: string;
  requiredTechnologies?: string[];
  description?: { th: string; en: string } | string;
  deadline?: Date | string;
}

/**
 * Evaluates whether a procurement matches a user's configured criteria:
 * - Keywords (case-insensitive substring in title, description, or text)
 * - Software-project categories (interestTags matching category or corpus)
 * - Budget range (min/max bounds; missing budget permits match by default)
 * - Issuing agencies (department matching selected agencies)
 */
export function evaluateProcurementMatch(
  procurement: ProcurementMatchTarget,
  preferences: NotificationPreferences,
): ProcurementMatchingResult {
  const reasons: string[] = [];
  const matchedTags: string[] = [];

  // If user disabled new opportunity alerts, it is never a match
  if (!preferences.newOpportunity) {
    return { isMatch: false, score: 0, reasons: ['User disabled new opportunity alerts'], matchedTags: [] };
  }

  // 1. Budget Evaluation
  // Behavior for missing/unknown procurement budgets: If procurement.budget is undefined or null,
  // it is permitted to match, ensuring users don't miss procurement announcements where budgets
  // are specified inside attached TOR documents rather than structured fields.
  if (procurement.budget !== undefined && procurement.budget !== null) {
    if (preferences.budgetMin !== null && procurement.budget < preferences.budgetMin) {
      return {
        isMatch: false,
        score: 0,
        reasons: [`Budget ${procurement.budget} is lower than user minimum ${preferences.budgetMin}`],
        matchedTags: [],
      };
    }
    if (preferences.budgetMax !== null && procurement.budget > preferences.budgetMax) {
      return {
        isMatch: false,
        score: 0,
        reasons: [`Budget ${procurement.budget} exceeds user maximum ${preferences.budgetMax}`],
        matchedTags: [],
      };
    }
  }

  // Extract department text for agency matching
  const deptTh = typeof procurement.department === 'object' ? procurement.department.th : procurement.department || procurement.agencyName || '';
  const deptEn = typeof procurement.department === 'object' ? procurement.department.en : procurement.department || procurement.agencyName || '';
  const deptCorpus = `${deptTh} ${deptEn}`.toLowerCase();

  // 2. Issuing Agency Evaluation (UC-6)
  const userAgencies = (preferences.agencies || []).map((a) => a.toLowerCase().trim()).filter(Boolean);
  if (userAgencies.length > 0) {
    const agencyMatched = userAgencies.some((agency) => deptCorpus.includes(agency) || agency.includes(deptCorpus));
    if (!agencyMatched) {
      return {
        isMatch: false,
        score: 0,
        reasons: ['Procurement issuing agency does not match user selected agencies'],
        matchedTags: [],
      };
    }
    reasons.push(`Matches issuing agency criteria (${deptTh || deptEn})`);
  }

  // Prepare corpus for category and keyword evaluation
  const categoryStr = (procurement.category || '').toLowerCase();
  const reqTechs = (procurement.requiredTechnologies || []).map((t) => t.toLowerCase());

  const titleTh = typeof procurement.title === 'object' ? procurement.title.th : procurement.title || '';
  const titleEn = typeof procurement.title === 'object' ? procurement.title.en : procurement.title || '';
  const descTh = typeof procurement.description === 'object' ? procurement.description.th : procurement.description || '';
  const descEn = typeof procurement.description === 'object' ? procurement.description.en : procurement.description || '';
  const corpus = `${titleTh} ${titleEn} ${descTh} ${descEn} ${categoryStr} ${reqTechs.join(' ')}`.toLowerCase();

  // 3. Custom Keywords Evaluation (UC-6)
  const userKeywords = (preferences.keywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
  const matchedKeywords: string[] = [];
  for (const kw of userKeywords) {
    if (corpus.includes(kw)) {
      matchedKeywords.push(kw);
      reasons.push(`Matches keyword "${kw}"`);
    }
  }

  // 4. Interest Tags & Category Evaluation
  const userTags = (preferences.interestTags || []).map((t) => t.toLowerCase().trim()).filter(Boolean);
  for (const tag of userTags) {
    let tagMatched = false;

    // Check exact category match
    if (categoryStr && (categoryStr.includes(tag) || tag.includes(categoryStr))) {
      tagMatched = true;
    }

    // Check required technologies
    if (!tagMatched && reqTechs.some((tech) => tech.includes(tag) || tag.includes(tech))) {
      tagMatched = true;
    }

    // Check keyword presence in title or description
    if (!tagMatched && corpus.includes(tag)) {
      tagMatched = true;
    }

    if (tagMatched) {
      matchedTags.push(tag);
      reasons.push(`Matches interest category "${tag}"`);
    }
  }

  // Match qualification:
  // If user configured neither tags nor keywords, match is true (within budget and agency).
  // If user configured tags and/or keywords, at least one tag or keyword must match.
  const hasContentFilters = userTags.length > 0 || userKeywords.length > 0;
  const isMatch = !hasContentFilters || (matchedTags.length > 0 || matchedKeywords.length > 0);

  if (!isMatch) {
    return {
      isMatch: false,
      score: 0,
      reasons: ['No matching category or keywords found in procurement'],
      matchedTags: [],
    };
  }

  const score = Math.min(100, (matchedTags.length + matchedKeywords.length) * 30 + 40);

  return {
    isMatch,
    score,
    reasons,
    matchedTags: [...matchedTags, ...matchedKeywords],
  };
}

/**
 * Scans all registered user preferences, evaluates matches for newly published procurements,
 * and generates in-app and/or email notifications based on user channel preferences.
 */
export async function notifyMatchingUsers(
  procurement: ProcurementMatchTarget,
): Promise<NotificationItem[]> {
  const generatedNotifications: NotificationItem[] = [];
  const procurementId = String(procurement.externalId || procurement.id || 'unknown');

  const titleTh = typeof procurement.title === 'object' ? procurement.title.th : procurement.title;
  const titleEn = typeof procurement.title === 'object' ? procurement.title.en : procurement.title;

  let recipients: string[] = [];

  try {
    if (mongoose.connection.readyState === 1) {
      await connectToDatabase();
      const settingsList = await UserSettings.find(
        {},
        'sessionId interestTags keywords agencies budgetMin budgetMax newOpportunity newProjectAlert emailNotif inAppNotif email',
      ).lean();
      recipients = settingsList.map((s) => s.sessionId);
    }
  } catch {
    // If DB is disconnected, use empty
    recipients = [];
  }

  // Include in-memory configured recipients (for unit test or offline fallback)
  const memoryRecipients = getRegisteredRecipientIds();
  recipients = Array.from(new Set([...recipients, ...memoryRecipients]));

  // Ensure at least a guest or test evaluation recipient can be evaluated
  if (recipients.length === 0) {
    recipients = ['default_user_session'];
  }

  for (const recipientId of recipients) {
    const shouldDeliver = await shouldDeliverNotification(recipientId, 'PROCUREMENT_MATCHED', {
      category: procurement.category,
      budget: procurement.budget,
      requiredTechnologies: procurement.requiredTechnologies,
    });
    if (!shouldDeliver) continue;

    const prefs = await getNotificationPreferences(recipientId);
    const matchResult = evaluateProcurementMatch(procurement, prefs);

    // Negative evaluation: do not send notification if not matching
    if (!matchResult.isMatch) {
      continue;
    }

    // Determine enabled channels (UC-6: In-App, Email, Both, Neither)
    const deliverInApp = prefs.inAppNotif !== false && prefs.newOpportunity !== false;
    const deliverEmail = prefs.emailNotif === true && prefs.newOpportunity !== false;

    if (!deliverInApp && !deliverEmail) {
      // User disabled both channels
      continue;
    }

    const formattedBudgetThb = procurement.budget !== undefined && procurement.budget !== null
      ? Number(procurement.budget).toLocaleString('th-TH')
      : 'ตามที่กำหนดใน TOR';

    // 1. Deliver In-App Notification if enabled
    if (deliverInApp) {
      const notification = await createNotification({
        recipientId,
        procurementId,
        type: 'PROCUREMENT_MATCHED',
        priority: 'MEDIUM',
        title: {
          th: `โอกาสจัดซื้อใหม่ตรงกับความสนใจ: ${titleTh}`,
          en: `New Matching Procurement: ${titleEn}`,
        },
        message: {
          th: `พบโครงการใหม่ที่ตรงกับเงื่อนไข (${matchResult.matchedTags.join(', ') || 'ตามงบประมาณ'}) วงเงินงบประมาณ ${formattedBudgetThb} บาท`,
          en: `New opportunity matching your criteria (${matchResult.matchedTags.join(', ') || 'budget criteria'}) with budget ${formattedBudgetThb} THB`,
        },
        linkUrl: `/opportunities/${procurementId}`,
        metadata: {
          procurementTitle: { th: titleTh, en: titleEn },
          procurementCategory: procurement.category,
          procurementBudget: procurement.budget,
          matchReasons: matchResult.reasons,
        },
        idempotencyKey: `match_${recipientId}_${procurementId}`,
      });

      if (notification) {
        generatedNotifications.push(notification);
      }
    }

    // 2. Deliver Email Notification if enabled (UC-6)
    if (deliverEmail) {
      try {
        let recipientEmail: string | null = prefs.email || null;
        let recipientName = 'ผู้ใช้งาน TORBIDD';

        // If no explicit email in preferences, attempt to resolve via User collection or recipientId
        if (!recipientEmail) {
          if (emailDeliveryService.isValidEmail(recipientId)) {
            recipientEmail = recipientId;
          } else if (mongoose.connection.readyState === 1) {
            try {
              const userRecord = await User.findOne({
                $or: [{ googleId: recipientId }, { email: recipientId }],
              }).lean();
              if (userRecord?.email) {
                recipientEmail = userRecord.email;
                if (userRecord.name) recipientName = userRecord.name;
              }
            } catch {
              // Ignore lookup failure
            }
          }
        }

        if (recipientEmail && emailDeliveryService.isValidEmail(recipientEmail)) {
          await emailDeliveryService.sendOpportunityAlert({
            recipientEmail,
            recipientName,
            project: {
              id: procurementId,
              title: procurement.title,
              department: procurement.department || procurement.agencyName,
              budget: procurement.budget,
              deadline: procurement.deadline,
              category: procurement.category,
              description: procurement.description,
            },
            matchReasons: matchResult.reasons,
          });
        }
      } catch (emailErr) {
        // Email failure must NOT stop procurement processing or throw uncaught errors
        console.error(`[notifyMatchingUsers] Email alert delivery failed for ${recipientId}:`, (emailErr as Error).message);
      }
    }
  }

  return generatedNotifications;
}
