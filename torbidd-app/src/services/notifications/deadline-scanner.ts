// =============================================================================
// services/notifications/deadline-scanner.ts - Deadline Reminder Scanner Service
// Scans approaching procurement deadlines and dispatches reminders (UC-6)
// =============================================================================

import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Project from '@/models/Project';
import Bookmark from '@/models/Bookmark';
import User from '@/models/User';
import { createNotification } from '@/services/database/notifications';
import { getNotificationPreferences, shouldDeliverNotification } from '@/services/notification-preferences';
import { emailDeliveryService } from '@/services/notifications/email-delivery.service';

export interface DeadlineScanSummary {
  scannedProjects: number;
  qualifyingProjects: number;
  notificationsCreated: number;
  emailsSent: number;
}

/**
 * Scans active procurements approaching their deadline (within 1 to 3 days),
 * identifies users who saved the project, and delivers in-app and/or email reminders.
 */
export async function scanAndSendDeadlineReminders(): Promise<DeadlineScanSummary> {
  const summary: DeadlineScanSummary = {
    scannedProjects: 0,
    qualifyingProjects: 0,
    notificationsCreated: 0,
    emailsSent: 0,
  };

  try {
    await connectToDatabase();

    const now = new Date();
    // Look ahead 3.5 days
    const horizon = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000);

    // Find active projects with deadlines between now and horizon
    const projects = await Project.find({
      deadline: { $gte: now, $lte: horizon },
    }).lean();

    summary.scannedProjects = projects.length;

    for (const project of projects) {
      if (!project.deadline) continue;

      const diffMs = new Date(project.deadline).getTime() - now.getTime();
      const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      if (daysRemaining > 3) continue;

      summary.qualifyingProjects++;

      const projectIdStr = String(project.externalId || project._id);
      const titleTh = project.title?.th || String(project.title || '');
      const titleEn = project.title?.en || titleTh;

      // Find users who saved/bookmarked this project
      const bookmarks = await Bookmark.find({ projectId: project._id }).lean();
      const userSessions = bookmarks.map((b) => b.sessionId);

      for (const recipientId of userSessions) {
        const isEligible = await shouldDeliverNotification(recipientId, 'DEADLINE_APPROACHING');
        if (!isEligible) continue;

        const prefs = await getNotificationPreferences(recipientId);
        const deliverInApp = prefs.inAppNotif !== false && prefs.deadlineReminder !== false;
        const deliverEmail = prefs.emailNotif === true && prefs.deadlineReminder !== false;

        if (!deliverInApp && !deliverEmail) continue;

        const idempotencyKey = `deadline_${recipientId}_${projectIdStr}_${daysRemaining}d`;

        // In-app notification
        if (deliverInApp) {
          const notif = await createNotification({
            recipientId,
            procurementId: projectIdStr,
            type: 'DEADLINE_APPROACHING',
            priority: daysRemaining <= 1 ? 'URGENT' : 'HIGH',
            title: {
              th: `ใกล้ถึงกำหนดสิ้นสุด: เหลือ ${daysRemaining} วัน`,
              en: `Deadline Approaching: ${daysRemaining} day(s) left`,
            },
            message: {
              th: `โครงการ "${titleTh}" กำลังจะปิดรับข้อเสนอภายในอีก ${daysRemaining} วัน`,
              en: `Project "${titleEn}" submission deadline is closing in ${daysRemaining} day(s)`,
            },
            linkUrl: `/opportunities/${projectIdStr}`,
            metadata: {
              procurementTitle: { th: titleTh, en: titleEn },
              daysRemaining,
              deadline: project.deadline,
            },
            idempotencyKey,
          });

          if (notif) summary.notificationsCreated++;
        }

        // Email notification
        if (deliverEmail) {
          try {
            let recipientEmail = prefs.email || null;
            let recipientName = 'ผู้ใช้งาน TORBIDD';

            if (!recipientEmail) {
              if (emailDeliveryService.isValidEmail(recipientId)) {
                recipientEmail = recipientId;
              } else if (mongoose.connection.readyState === 1) {
                const user = await User.findOne({
                  $or: [{ googleId: recipientId }, { email: recipientId }],
                }).lean();
                if (user?.email) {
                  recipientEmail = user.email;
                  if (user.name) recipientName = user.name;
                }
              }
            }

            if (recipientEmail && emailDeliveryService.isValidEmail(recipientEmail)) {
              const res = await emailDeliveryService.sendDeadlineReminder({
                recipientEmail,
                recipientName,
                project: {
                  id: projectIdStr,
                  title: project.title,
                  department: project.department,
                  budget: project.budget,
                  deadline: project.deadline,
                },
                daysRemaining,
              });

              if (res.success) summary.emailsSent++;
            }
          } catch (err) {
            console.error(`[scanAndSendDeadlineReminders] Email reminder failed for ${recipientId}:`, (err as Error).message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[scanAndSendDeadlineReminders] Scanner encountered error:', (err as Error).message);
  }

  return summary;
}
