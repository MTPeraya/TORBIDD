// =============================================================================
// services/procurement-diff.ts - Saved Procurement Update & Diff Detector
// (Supports Issue #135, Issue #140 & UC-11 Main Flow: Saved Procurement Update)
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import Bookmark from '@/models/Bookmark';
import { createNotification } from '@/services/database/notifications';
import { shouldDeliverNotification } from '@/services/notification-preferences';
import {
  ChangedFieldRecord,
  NotificationItem,
  NotificationPriority,
  NotificationType,
  ProcurementDiffResult,
} from '@/types/notification';

export interface ProcurementComparable {
  id?: string;
  externalId?: number | string;
  externalProjectId?: string;
  title: { th: string; en: string } | string;
  department?: { th: string; en: string } | string;
  agencyName?: string;
  budget?: number;
  contractPrice?: number;
  deadline?: Date | string;
  status?: string;
  revision?: number;
  extractionStatus?: string;
  sourceDocument?: string;
  [key: string]: unknown;
}

/**
 * Detects whether meaningful changes occurred between an older and newer version
 * of a procurement record, according to rules defined in Issue #140.
 */
export function detectProcurementChanges(
  oldProcurement: ProcurementComparable,
  newProcurement: ProcurementComparable,
): ProcurementDiffResult {
  const changedFields: ChangedFieldRecord[] = [];
  let changeType: NotificationType = 'PROCUREMENT_UPDATED';
  let priority: NotificationPriority = 'HIGH';

  // 1. Check Status Change
  if (oldProcurement.status && newProcurement.status && oldProcurement.status !== newProcurement.status) {
    changedFields.push({
      field: 'status',
      fieldLabel: { th: 'สถานะโครงการ', en: 'Project Status' },
      oldValue: oldProcurement.status,
      newValue: newProcurement.status,
      description: {
        th: `เปลี่ยนสถานะจาก "${oldProcurement.status}" เป็น "${newProcurement.status}"`,
        en: `Status changed from "${oldProcurement.status}" to "${newProcurement.status}"`,
      },
    });
    changeType = 'STATUS_CHANGED';
    priority = newProcurement.status === 'cancelled' || newProcurement.status === 'closingSoon' ? 'URGENT' : 'HIGH';
  }

  // 2. Check Submission Deadline Change
  if (oldProcurement.deadline && newProcurement.deadline) {
    const oldDeadline = new Date(oldProcurement.deadline).getTime();
    const newDeadline = new Date(newProcurement.deadline).getTime();
    const diffDays = Math.round(Math.abs(newDeadline - oldDeadline) / (1000 * 60 * 60 * 24));

    if (diffDays >= 1) {
      const isExtended = newDeadline > oldDeadline;
      const newFormatted = new Date(newProcurement.deadline).toLocaleDateString('th-TH');
      changedFields.push({
        field: 'deadline',
        fieldLabel: { th: 'กำหนดการยื่นข้อเสนอ', en: 'Submission Deadline' },
        oldValue: oldProcurement.deadline,
        newValue: newProcurement.deadline,
        description: {
          th: isExtended ? `ขยายเวลากำหนดส่งถึง ${newFormatted}` : `ปรับเปลี่ยนกำหนดส่งเป็น ${newFormatted}`,
          en: isExtended ? `Deadline extended to ${new Date(newProcurement.deadline).toLocaleDateString('en-US')}` : `Deadline adjusted to ${new Date(newProcurement.deadline).toLocaleDateString('en-US')}`,
        },
      });
      priority = 'HIGH';
    }
  }

  // 3. Check Budget / Contract Price Change
  if (oldProcurement.budget !== undefined && newProcurement.budget !== undefined && oldProcurement.budget !== newProcurement.budget) {
    const oldBudget = Number(oldProcurement.budget);
    const newBudget = Number(newProcurement.budget);
    changedFields.push({
      field: 'budget',
      fieldLabel: { th: 'วงเงินงบประมาณ', en: 'Approved Budget' },
      oldValue: oldBudget,
      newValue: newBudget,
      description: {
        th: `ปรับวงเงินงบประมาณเป็น ${newBudget.toLocaleString('th-TH')} บาท`,
        en: `Budget updated to ${newBudget.toLocaleString('en-US')} THB`,
      },
    });
    priority = 'HIGH';
  }

  if (oldProcurement.contractPrice !== newProcurement.contractPrice && newProcurement.contractPrice !== undefined) {
    changedFields.push({
      field: 'contractPrice',
      fieldLabel: { th: 'ราคาตกลงซื้อจ้าง', en: 'Contract Award Price' },
      oldValue: oldProcurement.contractPrice,
      newValue: newProcurement.contractPrice,
      description: {
        th: `บันทึกราคาตกลงซื้อจ้าง ${Number(newProcurement.contractPrice).toLocaleString('th-TH')} บาท`,
        en: `Contract award price recorded: ${Number(newProcurement.contractPrice).toLocaleString('en-US')} THB`,
      },
    });
  }

  // 4. Check TOR Revision / Document Updates
  const oldRevision = Number(oldProcurement.revision || 1);
  const newRevision = Number(newProcurement.revision || 1);
  if (newRevision > oldRevision || (oldProcurement.sourceDocument !== newProcurement.sourceDocument && newProcurement.sourceDocument)) {
    changedFields.push({
      field: 'revision',
      fieldLabel: { th: 'เอกสาร TOR / ร่างประกาศ', en: 'TOR Document Revision' },
      oldValue: oldRevision,
      newValue: newRevision,
      description: {
        th: `มีการอัปเดตเอกสาร TOR ฉบับปรับปรุง (Revision ${newRevision})`,
        en: `TOR document updated with new amendments (Revision ${newRevision})`,
      },
    });
    changeType = 'TOR_UPDATED';
    priority = 'HIGH';
  }

  const hasMeaningfulChange = changedFields.length > 0;

  // Build summary descriptions
  const summaryTh = changedFields.map((f) => f.description?.th || f.fieldLabel.th).join(' · ');
  const summaryEn = changedFields.map((f) => f.description?.en || f.fieldLabel.en).join(' · ');

  return {
    hasMeaningfulChange,
    changeType,
    priority,
    changedFields,
    summary: {
      th: summaryTh || 'ไม่มีการเปลี่ยนแปลงสำคัญ',
      en: summaryEn || 'No significant changes detected',
    },
  };
}

/**
 * Evaluates an update on a procurement, determines whether changes are important,
 * and notifies all users who have saved/bookmarked this procurement.
 */
export async function notifySavedProcurementUpdate(
  oldProcurement: ProcurementComparable,
  newProcurement: ProcurementComparable,
): Promise<NotificationItem[]> {
  const diff = detectProcurementChanges(oldProcurement, newProcurement);

  // Alternative Flow A2: If no meaningful changes, do not send notifications
  if (!diff.hasMeaningfulChange) {
    return [];
  }

  const procurementId = String(
    newProcurement.externalId || newProcurement.externalProjectId || newProcurement.id || 'unknown',
  );
  const titleTh = typeof newProcurement.title === 'object' ? newProcurement.title.th : newProcurement.title;
  const titleEn = typeof newProcurement.title === 'object' ? newProcurement.title.en : newProcurement.title;

  let savedRecipients: string[] = [];

  try {
    await connectToDatabase();
    // Query all bookmarks matching this project
    const bookmarks = await Bookmark.find().lean();
    savedRecipients = bookmarks
      .filter((b) => String(b.projectId) === String(newProcurement.id) || String(b.projectId) === procurementId)
      .map((b) => b.sessionId);
  } catch {
    // DB not available
    savedRecipients = [];
  }

  const generatedNotifications: NotificationItem[] = [];
  const revision = Number(newProcurement.revision || 1);

  for (const recipientId of savedRecipients) {
    const shouldDeliver = await shouldDeliverNotification(recipientId, diff.changeType);
    if (!shouldDeliver) continue;

    const notification = await createNotification({
      recipientId,
      procurementId,
      type: diff.changeType,
      priority: diff.priority,
      title: {
        th: `อัปเดตข้อมูลสำคัญ: ${titleTh}`,
        en: `Important Update on Saved Opportunity: ${titleEn}`,
      },
      message: {
        th: diff.summary.th,
        en: diff.summary.en,
      },
      linkUrl: `/opportunities/${procurementId}`,
      metadata: {
        procurementTitle: { th: titleTh, en: titleEn },
        changedFields: diff.changedFields,
        revision,
      },
      idempotencyKey: `update_${recipientId}_${procurementId}_rev${revision}_${diff.changedFields.map((f) => f.field).join('_')}`,
    });

    if (notification) {
      generatedNotifications.push(notification);
    }
  }

  return generatedNotifications;
}
