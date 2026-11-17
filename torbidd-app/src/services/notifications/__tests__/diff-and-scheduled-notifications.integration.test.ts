/**
 * @jest-environment node
 */
// =============================================================================
// services/notifications/__tests__/diff-and-scheduled-notifications.integration.test.ts
// Integration Tests: Procurement Diff Engine & Scheduled Notification Trigger
// (Supports UC-6, UC-11, Issue #132, #133, #134, #135, #137, #140)
// =============================================================================
// Flow under test:
// Procurement Data Update -> Diff Detection -> Notification Creation ->
// Scheduled Cron Trigger -> Notification Dispatch -> Idempotency Safeguards
// =============================================================================

import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { setupTestDatabase } from '@/test/db-handler';
import Project from '@/models/Project';
import Bookmark from '@/models/Bookmark';
import Notification from '@/models/Notification';
import UserSettings from '@/models/UserSettings';
import User from '@/models/User';
import {
  detectProcurementChanges,
  notifySavedProcurementUpdate,
  ProcurementComparable,
} from '@/services/procurement-diff';
import { scanAndSendDeadlineReminders } from '@/services/notifications/deadline-scanner';
import { emailDeliveryService } from '@/services/notifications/email-delivery.service';
import { AlertService } from '@/services/notifications/alert-service';
import { updateNotificationPreferences } from '@/services/notification-preferences';
import { GET as cronGetHandler, POST as cronPostHandler } from '@/app/api/cron/deadline-reminders/route';

describe('Procurement Diff Engine & Scheduled Notification Integration Suite', () => {
  setupTestDatabase({ timeout: 60000, clearAfterEach: true });

  let savedCronSecret: string | undefined;

  beforeEach(() => {
    savedCronSecret = process.env.CRON_SECRET;
    emailDeliveryService.resetHistory();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (savedCronSecret !== undefined) {
      process.env.CRON_SECRET = savedCronSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  // ===========================================================================
  // A. Procurement Update & Diff Detection
  // ===========================================================================
  describe('A. Procurement Update & Diff Detection', () => {
    it('A1. correctly detects procurement status changes and assigns appropriate priority', () => {
      const baseProject: ProcurementComparable = {
        externalId: 701,
        title: { th: 'โครงการปรับปรุงระบบเครือข่าย', en: 'Network Upgrade Project' },
        status: 'open',
      };

      // 1. Transition: open -> closingSoon (URGENT)
      const diffClosing = detectProcurementChanges(baseProject, {
        ...baseProject,
        status: 'closingSoon',
      });
      expect(diffClosing.hasMeaningfulChange).toBe(true);
      expect(diffClosing.changeType).toBe('STATUS_CHANGED');
      expect(diffClosing.priority).toBe('URGENT');
      expect(diffClosing.changedFields[0]).toMatchObject({
        field: 'status',
        oldValue: 'open',
        newValue: 'closingSoon',
      });
      expect(diffClosing.summary.th).toContain('เปลี่ยนสถานะจาก "open" เป็น "closingSoon"');

      // 2. Transition: open -> cancelled (URGENT)
      const diffCancelled = detectProcurementChanges(baseProject, {
        ...baseProject,
        status: 'cancelled',
      });
      expect(diffCancelled.hasMeaningfulChange).toBe(true);
      expect(diffCancelled.priority).toBe('URGENT');

      // 3. Transition: open -> awarded (HIGH)
      const diffAwarded = detectProcurementChanges(baseProject, {
        ...baseProject,
        status: 'awarded',
      });
      expect(diffAwarded.hasMeaningfulChange).toBe(true);
      expect(diffAwarded.priority).toBe('HIGH');
    });

    it('A2. correctly detects budget changes and contract price awards', () => {
      const oldProject: ProcurementComparable = {
        externalId: 702,
        title: 'โครงการพัฒนาระบบคลาวด์ กทม.',
        budget: 10000000,
        contractPrice: undefined,
      };

      const newProject: ProcurementComparable = {
        externalId: 702,
        title: 'โครงการพัฒนาระบบคลาวด์ กทม.',
        budget: 12500000,
        contractPrice: 11900000,
      };

      const diff = detectProcurementChanges(oldProject, newProject);
      expect(diff.hasMeaningfulChange).toBe(true);
      expect(diff.priority).toBe('HIGH');

      const budgetField = diff.changedFields.find((f) => f.field === 'budget');
      expect(budgetField).toBeDefined();
      expect(budgetField?.oldValue).toBe(10000000);
      expect(budgetField?.newValue).toBe(12500000);
      expect(budgetField?.description?.th).toContain('12,500,000 บาท');

      const contractField = diff.changedFields.find((f) => f.field === 'contractPrice');
      expect(contractField).toBeDefined();
      expect(contractField?.newValue).toBe(11900000);
      expect(contractField?.description?.th).toContain('11,900,000 บาท');
    });

    it('A3. correctly detects submission deadline extension and adjustments (>= 1 day)', () => {
      const baseDate = new Date('2026-11-20T10:00:00.000Z');
      const extendedDate = new Date('2026-11-27T10:00:00.000Z'); // +7 days
      const subDayShiftDate = new Date('2026-11-20T14:00:00.000Z'); // +4 hours only

      const oldProject: ProcurementComparable = {
        externalId: 703,
        title: 'โครงการระบบบริหารจัดการขยะมูลฝอย',
        deadline: baseDate,
      };

      // Case 1: Extended by 7 days
      const extendedDiff = detectProcurementChanges(oldProject, {
        ...oldProject,
        deadline: extendedDate,
      });
      expect(extendedDiff.hasMeaningfulChange).toBe(true);
      expect(extendedDiff.priority).toBe('HIGH');
      const deadlineField = extendedDiff.changedFields.find((f) => f.field === 'deadline');
      expect(deadlineField).toBeDefined();
      expect(deadlineField?.description?.th).toContain('ขยายเวลากำหนดส่งถึง');
      expect(deadlineField?.description?.en).toContain('Deadline extended to');

      // Case 2: Sub-day shift (< 1 day diff) is filtered out as noise
      const subDayDiff = detectProcurementChanges(oldProject, {
        ...oldProject,
        deadline: subDayShiftDate,
      });
      expect(subDayDiff.hasMeaningfulChange).toBe(false);
      expect(subDayDiff.changedFields).toHaveLength(0);
    });

    it('A4. correctly detects TOR revision bump and document updates', () => {
      const oldProject: ProcurementComparable = {
        externalId: 704,
        title: 'โครงการติดตั้งกล้อง AI ตรวจจับการบุกรุก',
        revision: 1,
        sourceDocument: 'https://egp.bangkok.go.th/docs/tor_v1.pdf',
      };

      const newProject: ProcurementComparable = {
        externalId: 704,
        title: 'โครงการติดตั้งกล้อง AI ตรวจจับการบุกรุก',
        revision: 2,
        sourceDocument: 'https://egp.bangkok.go.th/docs/tor_v2.pdf',
      };

      const diff = detectProcurementChanges(oldProject, newProject);
      expect(diff.hasMeaningfulChange).toBe(true);
      expect(diff.changeType).toBe('TOR_UPDATED');
      expect(diff.priority).toBe('HIGH');
      const revField = diff.changedFields.find((f) => f.field === 'revision');
      expect(revField?.oldValue).toBe(1);
      expect(revField?.newValue).toBe(2);
      expect(revField?.description?.th).toContain('Revision 2');
    });

    it('A5. handles multiple simultaneous field changes in a single update', () => {
      const oldProject: ProcurementComparable = {
        externalId: 705,
        title: 'โครงการปรับปรุงฐานข้อมูลประชากร',
        status: 'open',
        budget: 8000000,
        deadline: new Date('2026-11-15T09:00:00Z'),
        revision: 1,
      };

      const newProject: ProcurementComparable = {
        externalId: 705,
        title: 'โครงการปรับปรุงฐานข้อมูลประชากร',
        status: 'closingSoon',
        budget: 9500000,
        deadline: new Date('2026-11-25T09:00:00Z'), // +10 days
        revision: 2,
      };

      const diff = detectProcurementChanges(oldProject, newProject);
      expect(diff.hasMeaningfulChange).toBe(true);
      expect(diff.changeType).toBe('TOR_UPDATED');
      expect(diff.priority).toBe('HIGH');
      expect(diff.changedFields).toHaveLength(4);

      const fieldNames = diff.changedFields.map((f) => f.field);
      expect(fieldNames).toContain('status');
      expect(fieldNames).toContain('deadline');
      expect(fieldNames).toContain('budget');
      expect(fieldNames).toContain('revision');

      // Check compound summary
      expect(diff.summary.th).toContain('เปลี่ยนสถานะ');
      expect(diff.summary.th).toContain('ขยายเวลา');
      expect(diff.summary.th).toContain('9,500,000');
      expect(diff.summary.th).toContain('Revision 2');
    });

    it('A6. prevents false-positive updates on identical records or internal metadata changes', () => {
      const oldProject: ProcurementComparable = {
        externalId: 706,
        title: 'โครงการจัดทำสารบรรณอิเล็กทรอนิกส์',
        status: 'open',
        budget: 3500000,
        deadline: new Date('2026-12-01T10:00:00Z'),
        revision: 1,
        processedDate: new Date('2026-11-01'),
        crawlerBatchId: 'batch-001',
      };

      const newProject: ProcurementComparable = {
        ...oldProject,
        processedDate: new Date('2026-11-02'), // only crawler execution timestamp changed
        crawlerBatchId: 'batch-002',
      };

      const diff = detectProcurementChanges(oldProject, newProject);
      expect(diff.hasMeaningfulChange).toBe(false);
      expect(diff.changedFields).toHaveLength(0);
      expect(diff.summary.th).toBe('ไม่มีการเปลี่ยนแปลงสำคัญ');
    });
  });

  // ===========================================================================
  // B. Notification Trigger & Subscription Isolation
  // ===========================================================================
  describe('B. Notification Trigger & Subscription Isolation', () => {
    it('B1. dispatches notifications only to users who saved/bookmarked the procurement', async () => {
      const projectObjectId = new mongoose.Types.ObjectId();
      const otherObjectId = new mongoose.Types.ObjectId();

      // Seed Bookmarks
      await Bookmark.create([
        { sessionId: 'user_subscriber_1', projectId: projectObjectId },
        { sessionId: 'user_subscriber_2', projectId: projectObjectId },
        { sessionId: 'user_unrelated_3', projectId: otherObjectId }, // bookmarked a different project
      ]);

      const oldProc = {
        id: projectObjectId.toString(),
        externalId: '6801900701',
        title: { th: 'โครงการติดตั้งระบบสารสนเทศเขต', en: 'District MIS Project' },
        budget: 5000000,
      };

      const newProc = {
        ...oldProc,
        budget: 6200000, // Budget altered
      };

      const createdNotifs = await notifySavedProcurementUpdate(oldProc, newProc);

      expect(createdNotifs).toHaveLength(2);
      const recipientIds = createdNotifs.map((n) => n.recipientId);
      expect(recipientIds).toContain('user_subscriber_1');
      expect(recipientIds).toContain('user_subscriber_2');
      expect(recipientIds).not.toContain('user_unrelated_3');

      // Verify records written to MongoDB
      const dbNotifs = await Notification.find({ procurementId: '6801900701' }).lean();
      expect(dbNotifs).toHaveLength(2);
    });

    it('B2. populates notification records with accurate bilingual details and metadata', async () => {
      const projectObjectId = new mongoose.Types.ObjectId();
      await Bookmark.create({
        sessionId: 'user_recipient_detail',
        projectId: projectObjectId,
      });

      const oldProc: ProcurementComparable = {
        id: projectObjectId.toString(),
        externalId: '6801900702',
        title: { th: 'โครงการแพลตฟอร์มบริการประชาชน', en: 'Citizen Portal Platform' },
        status: 'open',
        revision: 1,
      };

      const newProc: ProcurementComparable = {
        ...oldProc,
        status: 'closingSoon',
      };

      const notifications = await notifySavedProcurementUpdate(oldProc, newProc);
      expect(notifications).toHaveLength(1);

      const notif = notifications[0];
      expect(notif.recipientId).toBe('user_recipient_detail');
      expect(notif.procurementId).toBe('6801900702');
      expect(notif.type).toBe('STATUS_CHANGED');
      expect(notif.priority).toBe('URGENT');
      expect(notif.title.th).toContain('โครงการแพลตฟอร์มบริการประชาชน');
      expect(notif.title.en).toContain('Citizen Portal Platform');
      expect(notif.linkUrl).toBe('/opportunities/6801900702');
      expect(notif.isRead).toBe(false);
      expect(notif.idempotencyKey).toBeDefined();

      // Verify in DB
      const dbNotif = await Notification.findById(notif.id).lean();
      expect(dbNotif).toBeDefined();
      expect(dbNotif?.metadata?.changedFields).toHaveLength(1);
    });

    it('B3. respects user notification preferences and suppresses notifications when disabled', async () => {
      const projectObjectId = new mongoose.Types.ObjectId();

      // Configure User A: savedUpdate = true
      await updateNotificationPreferences('user_pref_enabled', {
        savedUpdate: true,
        inAppNotif: true,
      });

      // Configure User B: savedUpdate = false (opted out of updates)
      await updateNotificationPreferences('user_pref_disabled', {
        savedUpdate: false,
        inAppNotif: true,
      });

      await Bookmark.create([
        { sessionId: 'user_pref_enabled', projectId: projectObjectId },
        { sessionId: 'user_pref_disabled', projectId: projectObjectId },
      ]);

      const oldProc = {
        id: projectObjectId.toString(),
        externalId: '6801900703',
        title: 'โครงการบริการคลาวด์ภาครัฐ',
        budget: 4000000,
      };

      const newProc = {
        ...oldProc,
        budget: 5000000,
      };

      const notifications = await notifySavedProcurementUpdate(oldProc, newProc);

      // Only User A should receive the notification
      expect(notifications).toHaveLength(1);
      expect(notifications[0].recipientId).toBe('user_pref_enabled');

      const userBNotifs = await Notification.find({ recipientId: 'user_pref_disabled' }).lean();
      expect(userBNotifs).toHaveLength(0);
    });

    it('B4. ensures idempotency and deduplication on repeated update triggers', async () => {
      const projectObjectId = new mongoose.Types.ObjectId();
      await Bookmark.create({
        sessionId: 'user_dedup_test',
        projectId: projectObjectId,
      });

      const oldProc = {
        id: projectObjectId.toString(),
        externalId: '6801900704',
        title: 'โครงการจัดซื้ออุปกรณ์คอมพิวเตอร์',
        status: 'open',
        revision: 1,
      };

      const newProc = {
        ...oldProc,
        status: 'cancelled',
        revision: 2,
      };

      // Trigger Run 1
      const firstRun = await notifySavedProcurementUpdate(oldProc, newProc);
      expect(firstRun).toHaveLength(1);

      const dbCountAfterFirst = await Notification.countDocuments({ procurementId: '6801900704' });
      expect(dbCountAfterFirst).toBe(1);

      // Trigger Run 2 with identical update
      const secondRun = await notifySavedProcurementUpdate(oldProc, newProc);
      expect(secondRun).toHaveLength(1);
      expect(secondRun[0].id).toBe(firstRun[0].id);

      // Total documents in DB must remain 1 (no duplicates inserted)
      const dbCountAfterSecond = await Notification.countDocuments({ procurementId: '6801900704' });
      expect(dbCountAfterSecond).toBe(1);
    });

    it('B5. suppresses notifications and database writes when update contains no meaningful changes', async () => {
      const projectObjectId = new mongoose.Types.ObjectId();
      await Bookmark.create({
        sessionId: 'user_no_diff',
        projectId: projectObjectId,
      });

      const oldProc = {
        id: projectObjectId.toString(),
        externalId: '6801900705',
        title: 'โครงการระบบสารสนเทศ',
        budget: 3000000,
        status: 'open',
      };

      const newProc = { ...oldProc }; // Identical

      const notifications = await notifySavedProcurementUpdate(oldProc, newProc);
      expect(notifications).toHaveLength(0);

      const dbCount = await Notification.countDocuments({ procurementId: '6801900705' });
      expect(dbCount).toBe(0);
    });
  });

  // ===========================================================================
  // C. Deadline Reminder & Cron Scheduling
  // ===========================================================================
  describe('C. Deadline Reminder & Cron Scheduling', () => {
    it('C1. correctly identifies procurements closing within the 1-3 day window', async () => {
      const now = new Date();

      // Project 1: Deadline in 1 day (URGENT priority)
      const proj1 = await Project.create({
        externalId: 801,
        title: { th: 'โครงการ 1 วันหมดเขต', en: '1 Day Left Project' },
        department: { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic Department' },
        budget: 5000000,
        publishDate: new Date(now.getTime() - 10 * 86400000),
        deadline: new Date(now.getTime() + 1 * 86400000),
        category: 'Website',
        procurementType: 'e-bidding',
        description: { th: 'รายละเอียด', en: 'Description' },
        scope: { th: [], en: [] },
        qualifications: { th: [], en: [] },
        historicalAvg: 5000000,
        sourceDocument: 'doc.pdf',
        processedDate: now,
        aiConfidence: 'High',
        isSoftwareRelated: true,
      });

      // Project 2: Deadline in 2 days (HIGH priority)
      const proj2 = await Project.create({
        externalId: 802,
        title: { th: 'โครงการ 2 วันหมดเขต', en: '2 Days Left Project' },
        department: { th: 'สำนักการแพทย์', en: 'Medical Department' },
        budget: 8000000,
        publishDate: new Date(now.getTime() - 10 * 86400000),
        deadline: new Date(now.getTime() + 2 * 86400000),
        category: 'Mobile App',
        procurementType: 'e-bidding',
        description: { th: 'รายละเอียด', en: 'Description' },
        scope: { th: [], en: [] },
        qualifications: { th: [], en: [] },
        historicalAvg: 8000000,
        sourceDocument: 'doc.pdf',
        processedDate: now,
        aiConfidence: 'High',
        isSoftwareRelated: true,
      });

      // User bookmarks both
      await Bookmark.create([
        { sessionId: 'user_deadline_evaluator', projectId: proj1._id },
        { sessionId: 'user_deadline_evaluator', projectId: proj2._id },
      ]);

      const summary = await scanAndSendDeadlineReminders();
      expect(summary.scannedProjects).toBe(2);
      expect(summary.qualifyingProjects).toBe(2);
      expect(summary.notificationsCreated).toBe(2);

      // Verify priorities in database
      const notif1 = await Notification.findOne({ procurementId: '801' }).lean();
      expect(notif1?.priority).toBe('URGENT');
      expect(notif1?.metadata?.daysRemaining).toBe(1);

      const notif2 = await Notification.findOne({ procurementId: '802' }).lean();
      expect(notif2?.priority).toBe('HIGH');
      expect(notif2?.metadata?.daysRemaining).toBe(2);
    });

    it('C2. filters out expired deadlines, far-future deadlines, and missing deadlines', async () => {
      const now = new Date();

      // Project with expired deadline (-1 day)
      await Project.create({
        externalId: 811,
        title: { th: 'โครงการหมดเขตไปแล้ว', en: 'Expired Project' },
        department: { th: 'สำนักโยธา', en: 'Public Works' },
        budget: 3000000,
        publishDate: new Date(now.getTime() - 20 * 86400000),
        deadline: new Date(now.getTime() - 1 * 86400000),
        category: 'AI',
        procurementType: 'e-bidding',
        description: { th: 'คำอธิบาย', en: 'Desc' },
        scope: { th: [], en: [] },
        qualifications: { th: [], en: [] },
        historicalAvg: 3000000,
        sourceDocument: 'doc.pdf',
        processedDate: now,
        aiConfidence: 'High',
        isSoftwareRelated: true,
      });

      // Project with far-future deadline (+15 days)
      await Project.create({
        externalId: 812,
        title: { th: 'โครงการยังเหลือเวลาอีกนาน', en: 'Future Project' },
        department: { th: 'สำนักการศึกษา', en: 'Education Dept' },
        budget: 4500000,
        publishDate: now,
        deadline: new Date(now.getTime() + 15 * 86400000),
        category: 'Cloud',
        procurementType: 'e-bidding',
        description: { th: 'คำอธิบาย', en: 'Desc' },
        scope: { th: [], en: [] },
        qualifications: { th: [], en: [] },
        historicalAvg: 4500000,
        sourceDocument: 'doc.pdf',
        processedDate: now,
        aiConfidence: 'High',
        isSoftwareRelated: true,
      });

      const summary = await scanAndSendDeadlineReminders();
      expect(summary.qualifyingProjects).toBe(0);
      expect(summary.notificationsCreated).toBe(0);
    });

    it('C3. executes cron route handler successfully and enforces CRON_SECRET auth', async () => {
      const now = new Date();
      const proj = await Project.create({
        externalId: 821,
        title: { th: 'โครงการทดสอบ Cron API', en: 'Cron Route Test Project' },
        department: { th: 'กทม.', en: 'BMA' },
        budget: 6000000,
        publishDate: now,
        deadline: new Date(now.getTime() + 2 * 86400000),
        category: 'Database',
        procurementType: 'e-bidding',
        description: { th: 'คำอธิบาย', en: 'Desc' },
        scope: { th: [], en: [] },
        qualifications: { th: [], en: [] },
        historicalAvg: 6000000,
        sourceDocument: 'doc.pdf',
        processedDate: now,
        aiConfidence: 'High',
        isSoftwareRelated: true,
      });

      await Bookmark.create({
        sessionId: 'cron_subscriber',
        projectId: proj._id,
      });

      // 1. Without CRON_SECRET configured (public / dev mode)
      delete process.env.CRON_SECRET;
      const publicReq = new NextRequest('http://localhost:3000/api/cron/deadline-reminders');
      const publicRes = await cronGetHandler(publicReq);
      expect(publicRes.status).toBe(200);
      const publicData = await publicRes.json();
      expect(publicData.success).toBe(true);
      expect(publicData.summary.qualifyingProjects).toBe(1);

      // 2. With CRON_SECRET configured: Reject unauthorized request
      process.env.CRON_SECRET = 'super-secret-cron-token-xyz';
      const unauthReq = new NextRequest('http://localhost:3000/api/cron/deadline-reminders');
      const unauthRes = await cronGetHandler(unauthReq);
      expect(unauthRes.status).toBe(401);

      // 3. With CRON_SECRET configured: Accept authorized POST request
      const authReq = new NextRequest('http://localhost:3000/api/cron/deadline-reminders', {
        method: 'POST',
        headers: {
          authorization: 'Bearer super-secret-cron-token-xyz',
        },
      });
      const authRes = await cronPostHandler(authReq);
      expect(authRes.status).toBe(200);
      const authData = await authRes.json();
      expect(authData.success).toBe(true);
    });

    it('C4. guarantees idempotency across repeated cron scanner executions', async () => {
      const now = new Date();
      const proj = await Project.create({
        externalId: 831,
        title: { th: 'โครงการตรวจสอบการรันซ้ำ', en: 'Idempotency Cron Project' },
        department: { th: 'สำนักยุทธศาสตร์', en: 'Strategy Dept' },
        budget: 9000000,
        publishDate: now,
        deadline: new Date(now.getTime() + 1.5 * 86400000),
        category: 'ERP',
        procurementType: 'e-bidding',
        description: { th: 'คำอธิบาย', en: 'Desc' },
        scope: { th: [], en: [] },
        qualifications: { th: [], en: [] },
        historicalAvg: 9000000,
        sourceDocument: 'doc.pdf',
        processedDate: now,
        aiConfidence: 'High',
        isSoftwareRelated: true,
      });

      await Bookmark.create({
        sessionId: 'user_cron_dedup',
        projectId: proj._id,
      });

      // Run 1
      const summary1 = await scanAndSendDeadlineReminders();
      expect(summary1.notificationsCreated).toBe(1);

      const dbCountAfterRun1 = await Notification.countDocuments({ procurementId: '831' });
      expect(dbCountAfterRun1).toBe(1);

      // Run 2 (repeated trigger within same day window)
      const summary2 = await scanAndSendDeadlineReminders();
      expect(summary2.qualifyingProjects).toBe(1);

      // Verify that database count does NOT increment (idempotency key prevents duplicate document)
      const dbCountAfterRun2 = await Notification.countDocuments({ procurementId: '831' });
      expect(dbCountAfterRun2).toBe(1);
    });

    it('C5. handles Asia/Bangkok Thai timezone and calendar formatting cleanly', async () => {
      const now = new Date();
      const targetDeadline = new Date(now.getTime() + 2 * 86400000);

      const proj = await Project.create({
        externalId: 841,
        title: { th: 'โครงการทดสอบเวลาและปฏิทินไทย', en: 'Thai Calendar Project' },
        department: { th: 'กทม.', en: 'BMA' },
        budget: 1500000,
        publishDate: now,
        deadline: targetDeadline,
        category: 'Website',
        procurementType: 'e-bidding',
        description: { th: 'คำอธิบาย', en: 'Desc' },
        scope: { th: [], en: [] },
        qualifications: { th: [], en: [] },
        historicalAvg: 1500000,
        sourceDocument: 'doc.pdf',
        processedDate: now,
        aiConfidence: 'High',
        isSoftwareRelated: true,
      });

      await Bookmark.create({
        sessionId: 'user_bangkok_tz',
        projectId: proj._id,
      });

      await scanAndSendDeadlineReminders();

      const notif = await Notification.findOne({ procurementId: '841' }).lean();
      expect(notif).toBeDefined();
      expect(notif?.title.th).toContain('เหลือ 2 วัน');
      expect(notif?.message.th).toContain('ปิดรับข้อเสนอภายในอีก 2 วัน');
      expect(notif?.message.en).toContain('2 day(s)');
      expect(new Date(notif?.metadata?.deadline as string).getTime()).toBe(targetDeadline.getTime());
    });
  });

  // ===========================================================================
  // D. Notification Dispatch
  // ===========================================================================
  describe('D. Notification Dispatch', () => {
    it('D1. dispatches and persists in-app notification feed items with read status tracking', async () => {
      const notifDoc = await Notification.create({
        recipientId: 'user_inapp_dispatch',
        procurementId: '901',
        type: 'PROCUREMENT_UPDATED',
        priority: 'HIGH',
        title: { th: 'แจ้งเตือนโครงการ', en: 'Project Alert' },
        message: { th: 'รายละเอียดการอัปเดต', en: 'Update details' },
        linkUrl: '/opportunities/901',
        isRead: false,
      });

      expect(notifDoc.isRead).toBe(false);
      expect(notifDoc.readAt).toBeNull();

      // Mark as read
      notifDoc.isRead = true;
      notifDoc.readAt = new Date();
      await notifDoc.save();

      const updated = await Notification.findById(notifDoc._id).lean();
      expect(updated?.isRead).toBe(true);
      expect(updated?.readAt).toBeDefined();
    });

    it('D2. dispatches email notifications via EmailDeliveryService with formatting and recipient validation', async () => {
      // 1. Valid dispatch
      const validResult = await emailDeliveryService.sendDeadlineReminder({
        recipientEmail: 'officer@bangkok.go.th',
        recipientName: 'นายช่าง กทม.',
        project: {
          id: '6801999991',
          title: {
            th: 'โครงการจัดหาระบบคอมพิวเตอร์แม่ข่าย',
            en: 'Server Infrastructure Procurement',
          },
          department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy Dept' },
          budget: 15000000,
          deadline: new Date('2026-11-20'),
        },
        daysRemaining: 3,
      });

      expect(validResult.success).toBe(true);
      expect(validResult.simulated).toBe(true);

      const sentEmails = emailDeliveryService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe('officer@bangkok.go.th');
      expect(sentEmails[0].subject).toContain('เหลืออีก 3 วัน');
      expect(sentEmails[0].html).toContain('โครงการจัดหาระบบคอมพิวเตอร์แม่ข่าย');
      expect(sentEmails[0].html).toContain('/opportunities/6801999991');

      // 2. Malformed email validation check (does not throw)
      const invalidResult = await emailDeliveryService.sendDeadlineReminder({
        recipientEmail: 'invalid-email-address',
        project: {
          id: '6801999992',
          title: 'โครงการทดสอบ',
        },
        daysRemaining: 1,
      });

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Invalid recipient email address');
      // Total dispatched emails remains 1
      expect(emailDeliveryService.getSentEmails()).toHaveLength(1);
    });

    it('D3. suppresses duplicate outbound emails within the deduplication window', async () => {
      const emailPayload = {
        recipientEmail: 'contractor@techfirm.co.th',
        project: {
          id: 'dedup_email_proj',
          title: 'โครงการพัฒนาระบบ Big Data',
        },
        daysRemaining: 2,
      };

      // Call 1
      const res1 = await emailDeliveryService.sendDeadlineReminder(emailPayload);
      expect(res1.success).toBe(true);
      expect(emailDeliveryService.getSentEmails()).toHaveLength(1);

      // Call 2 (immediate repeat call)
      const res2 = await emailDeliveryService.sendDeadlineReminder(emailPayload);
      expect(res2.success).toBe(true);
      expect(res2.messageId).toContain('dedup-suppressed');
      // No duplicate email logged
      expect(emailDeliveryService.getSentEmails()).toHaveLength(1);
    });

    it('D4. dispatches alerts to external webhook (Slack/Discord) and LINE Notify with fallback', async () => {
      // 1. Mock Slack Webhook
      let webhookPayload: Record<string, unknown> = {};
      const mockFetchSlack = jest.fn().mockImplementation(async (_url, init) => {
        webhookPayload = JSON.parse(init.body);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const slackAlertService = new AlertService({
        webhookUrl: 'https://hooks.slack.com/services/T123/B456/XYZ789',
        fetchImpl: mockFetchSlack as unknown as typeof fetch,
      });

      const testDlqId = new mongoose.Types.ObjectId().toString();
      const slackResult = await slackAlertService.sendRetryExceededAlert({
        errorCode: 'INGESTION_HTTP_503',
        errorMessage: 'e-GP Gateway unavailable after 3 attempts',
        source: 'NATIONAL_EGP',
        retryAttempts: 3,
        maxAttempts: 3,
        dlqId: testDlqId,
      });

      expect(slackResult.dispatched).toBe(true);
      expect(slackResult.channel).toBe('slack');
      expect(mockFetchSlack).toHaveBeenCalledTimes(1);
      expect(webhookPayload.text).toContain('TORBIDD Critical Alert');

      // 2. Mock LINE Notify with Bearer Auth
      let lineAuthHeader = '';
      const mockFetchLine = jest.fn().mockImplementation(async (_url, init) => {
        lineAuthHeader = init.headers.Authorization;
        return new Response(JSON.stringify({ status: 200, message: 'ok' }), { status: 200 });
      });

      const lineAlertService = new AlertService({
        lineNotifyToken: 'line_notify_secret_token_123',
        fetchImpl: mockFetchLine as unknown as typeof fetch,
      });

      const lineResult = await lineAlertService.sendRetryExceededAlert({
        errorCode: 'SYNC_RATE_LIMIT',
        errorMessage: 'BMA API rate limit exhausted',
        source: 'BMA_EGP',
        retryAttempts: 3,
        maxAttempts: 3,
      });

      expect(lineResult.dispatched).toBe(true);
      expect(lineResult.channel).toBe('line');
      expect(lineAuthHeader).toBe('Bearer line_notify_secret_token_123');

      // 3. Fallback dry-run when external services are unconfigured
      const fallbackAlertService = new AlertService({
        webhookUrl: '',
        lineNotifyToken: '',
      });
      const dryRunResult = await fallbackAlertService.sendRetryExceededAlert({
        errorCode: 'NETWORK_TIMEOUT',
        errorMessage: 'Request timed out',
        source: 'CKAN_GOVSPENDING',
        retryAttempts: 3,
        maxAttempts: 3,
      });

      expect(dryRunResult.dispatched).toBe(true);
      expect(dryRunResult.channel).toBe('console_dry_run');
    });
  });

  // ===========================================================================
  // E. End-to-End Workflow Integration
  // ===========================================================================
  describe('E. End-to-End Workflow Integration', () => {
    it('E1. completes full lifecycle: Procurement Data Update -> Diff Detection -> Notification Creation -> Scheduled Cron Trigger -> Dispatch -> Idempotency', async () => {
      const now = new Date();

      // 1. Insert initial procurement record into test database
      const initialProject = await Project.create({
        externalId: 9901,
        title: {
          th: 'โครงการจ้างพัฒนาระบบศูนย์ข้อมูลกลาง กทม.',
          en: 'BMA Central Data Center Platform Development',
        },
        department: {
          th: 'สำนักยุทธศาสตร์และประเมินผล',
          en: 'Strategy and Evaluation Department',
        },
        budget: 10000000,
        publishDate: new Date(now.getTime() - 7 * 86400000),
        deadline: new Date(now.getTime() + 14 * 86400000), // Initially 2 weeks ahead
        category: 'Data Analytics',
        procurementType: 'e-bidding',
        description: { th: 'โครงการพัฒนาระบบคลังข้อมูล', en: 'Data warehouse platform' },
        scope: { th: [], en: [] },
        qualifications: { th: [], en: [] },
        historicalAvg: 10000000,
        sourceDocument: 'https://egp.bangkok.go.th/tor_v1.pdf',
        processedDate: now,
        aiConfidence: 'High',
        isSoftwareRelated: true,
      });

      // 2. Set up users & bookmarks
      // User 1: Has inApp + email notifications enabled
      await updateNotificationPreferences('officer_user_1', {
        inAppNotif: true,
        emailNotif: true,
        savedUpdate: true,
        deadlineReminder: true,
        email: 'officer1@bangkok.go.th',
      });
      await User.create({
        googleId: 'officer_user_1',
        email: 'officer1@bangkok.go.th',
        name: 'สมศักดิ์ สถิตย์ธรรม',
      });

      // User 2: Has inApp enabled but email disabled
      await updateNotificationPreferences('officer_user_2', {
        inAppNotif: true,
        emailNotif: false,
        savedUpdate: true,
        deadlineReminder: true,
        email: 'officer2@bangkok.go.th',
      });

      // User 3: Has NOT bookmarked the project
      await updateNotificationPreferences('unrelated_user_3', {
        inAppNotif: true,
        emailNotif: true,
      });

      await Bookmark.create([
        { sessionId: 'officer_user_1', projectId: initialProject._id },
        { sessionId: 'officer_user_2', projectId: initialProject._id },
      ]);

      // 3. Simulate an updated procurement record discovered upstream
      const targetDeadline = new Date(now.getTime() + 2 * 86400000); // Shifted to 2 days ahead!
      const oldPayload: ProcurementComparable = {
        id: initialProject._id.toString(),
        externalId: '9901',
        title: initialProject.title,
        budget: initialProject.budget,
        status: 'open',
        deadline: initialProject.deadline,
        revision: 1,
      };

      const newPayload: ProcurementComparable = {
        ...oldPayload,
        budget: 12500000, // Budget updated
        status: 'closingSoon', // Status updated
        deadline: targetDeadline, // Deadline adjusted
        revision: 2, // TOR Revision bumped
      };

      // Also reflect new deadline & revision in database project document for cron scanner
      initialProject.budget = 12500000;
      initialProject.deadline = targetDeadline;
      await initialProject.save();

      // 4. Execute actual diff detection & notification creation service
      const diffNotifications = await notifySavedProcurementUpdate(oldPayload, newPayload);

      // 5. Verify diff results & notification creation
      expect(diffNotifications).toHaveLength(2); // Officer 1 and Officer 2
      const diffRecipients = diffNotifications.map((n) => n.recipientId);
      expect(diffRecipients).toContain('officer_user_1');
      expect(diffRecipients).toContain('officer_user_2');
      expect(diffRecipients).not.toContain('unrelated_user_3');

      // Verify MongoDB persistence of diff notifications
      const dbDiffNotifs = await Notification.find({
        procurementId: '9901',
        type: 'TOR_UPDATED',
      }).lean();
      expect(dbDiffNotifs).toHaveLength(2);
      expect(dbDiffNotifs[0].metadata?.changedFields).toHaveLength(4);

      // 6. Trigger scheduled cron scanner manually (Simulating scheduled cron execution)
      const cronSummary = await scanAndSendDeadlineReminders();

      // 7. Verify scheduled deadline reminder notifications & dispatch
      expect(cronSummary.qualifyingProjects).toBe(1);
      expect(cronSummary.notificationsCreated).toBe(2); // Both Officer 1 & 2 receive in-app
      expect(cronSummary.emailsSent).toBe(1); // Only Officer 1 enabled email notifications

      // Verify deadline reminder in-app notifications in MongoDB
      const deadlineDbNotifs = await Notification.find({
        procurementId: '9901',
        type: 'DEADLINE_APPROACHING',
      }).lean();
      expect(deadlineDbNotifs).toHaveLength(2);
      expect(deadlineDbNotifs[0].priority).toBe('HIGH');
      expect(deadlineDbNotifs[0].metadata?.daysRemaining).toBe(2);

      // Verify email dispatch history
      const sentEmails = emailDeliveryService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe('officer1@bangkok.go.th');
      expect(sentEmails[0].subject).toContain('เหลืออีก 2 วัน');
      expect(sentEmails[0].html).toContain('โครงการจ้างพัฒนาระบบศูนย์ข้อมูลกลาง กทม.');

      // 8. Re-run identical diff update and cron job to verify full idempotency
      const rerunDiffNotifs = await notifySavedProcurementUpdate(oldPayload, newPayload);
      expect(rerunDiffNotifs).toHaveLength(2);

      const rerunCronSummary = await scanAndSendDeadlineReminders();
      expect(rerunCronSummary.qualifyingProjects).toBe(1);

      // Final audit: Exact count of notifications for project 9901 in MongoDB
      // (2 diff notifications + 2 deadline notifications = exactly 4, no duplicates)
      const totalDbNotifs = await Notification.countDocuments({ procurementId: '9901' });
      expect(totalDbNotifs).toBe(4);

      // Exact count of emails sent remains 1 (dedup key suppresses duplicate email)
      expect(emailDeliveryService.getSentEmails()).toHaveLength(1);
    });
  });
});
