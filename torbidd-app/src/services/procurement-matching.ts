// =============================================================================
// services/procurement-matching.ts - Procurement Matching Engine
// (Supports Issue #134 & UC-11 Main Flow: New Matching Procurement)
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import UserSettings from '@/models/UserSettings';
import { createNotification } from '@/services/database/notifications';
import { getNotificationPreferences, shouldDeliverNotification } from '@/services/notification-preferences';
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
  budget: number;
  category?: string;
  requiredTechnologies?: string[];
  description?: { th: string; en: string } | string;
}

/**
 * Evaluates whether a procurement matches a user's configured interests and budget criteria.
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

  // 2. Interest Tags & Category Evaluation
  const userTags = (preferences.interestTags || []).map((t) => t.toLowerCase().trim());
  if (userTags.length === 0) {
    // If no tags specified, default to match if within budget
    return {
      isMatch: true,
      score: 50,
      reasons: ['Within budget criteria with no specific category restrictions'],
      matchedTags: [],
    };
  }

  const categoryStr = (procurement.category || '').toLowerCase();
  const reqTechs = (procurement.requiredTechnologies || []).map((t) => t.toLowerCase());

  const titleTh = typeof procurement.title === 'object' ? procurement.title.th : procurement.title || '';
  const titleEn = typeof procurement.title === 'object' ? procurement.title.en : procurement.title || '';
  const descTh = typeof procurement.description === 'object' ? procurement.description.th : procurement.description || '';
  const descEn = typeof procurement.description === 'object' ? procurement.description.en : procurement.description || '';
  const corpus = `${titleTh} ${titleEn} ${descTh} ${descEn} ${categoryStr} ${reqTechs.join(' ')}`.toLowerCase();

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
      reasons.push(`Matches interest tag "${tag}"`);
    }
  }

  const isMatch = matchedTags.length > 0;
  const score = isMatch ? Math.min(100, matchedTags.length * 35 + 30) : 0;

  return {
    isMatch,
    score,
    reasons,
    matchedTags,
  };
}

/**
 * Scans all registered user preferences, evaluates matches for newly published procurements,
 * and generates notifications for qualifying recipients.
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
    await connectToDatabase();
    const settingsList = await UserSettings.find({}, 'sessionId interestTags budgetMin budgetMax newOpportunity newProjectAlert').lean();
    recipients = settingsList.map((s) => s.sessionId);
  } catch {
    // If DB is disconnected, use empty or default recipient
    recipients = [];
  }

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

    const formattedBudgetThb = Number(procurement.budget || 0).toLocaleString('th-TH');

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
        th: `พบโครงการใหม่ในหมวดหมู่ ${matchResult.matchedTags.join(', ')} วงเงินงบประมาณ ${formattedBudgetThb} บาท`,
        en: `New opportunity matching your interests (${matchResult.matchedTags.join(', ')}) with budget ${formattedBudgetThb} THB`,
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

  return generatedNotifications;
}
