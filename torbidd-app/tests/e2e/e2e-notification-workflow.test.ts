/**
 * @jest-environment node
 */
// =============================================================================
// tests/e2e/e2e-notification-workflow.test.ts
// Comprehensive End-to-End Tests for Procurement Ingestion & Notification Workflow:
//
// Pipeline Flow Tested:
// 1. Ingestion of New Software Procurement Opportunity:
//    - Ingests new opportunity via upsertDiscoveredProjects / Ingestion pipeline.
//    - Validates deduplication check identifies project as new.
//
// 2. Background Preference Matching Engine (evaluateProcurementMatch):
//    - Matches keywords (case-insensitive substring in title/description).
//    - Matches software categories and required technologies.
//    - Validates budget boundary constraints (budgetMin / budgetMax).
//    - Validates issuing agency filtering (department matching).
//    - Tests negative matching (budget out of bounds, agency mismatch, category mismatch).
//    - Tests graceful matching when procurement budget is unspecified / inside TOR.
//
// 3. In-App Alert Generation & Lifecycle:
//    - Validates creation of in-app notification with type PROCUREMENT_MATCHED.
//    - Verifies direct navigation link (/opportunities/[id]).
//    - Verifies bilingual title and Thai currency budget formatting.
//    - Validates unread state and read-lifecycle transitions (markAsRead).
//
// 4. Outbound Delivery via EmailDeliveryService:
//    - Dispatches opportunity alert to user's registered email address.
//    - Verifies email subject, issuing agency, formatted THB budget, and direct URL.
//    - Tests HTML and plaintext template rendering.
//
// 5. Channel Toggle Matrix:
//    - In-App Only: creates in-app notification, suppresses email.
//    - Email Only: dispatches email, suppresses in-app alert.
//    - Both Channels: dispatches both in-app and email alerts.
//    - All Channels Disabled: suppresses both channels.
//
// 6. Deduplication & Idempotency Safeguards:
//    - Prevents duplicate email dispatch within 1-hour window.
//    - Prevents duplicate in-app alerts via idempotency key.
//
// 7. Multi-User Targeted Notification Distribution:
//    - Multiple concurrent users receive only notifications matching their criteria.
//
// 8. Pipeline Resilience & Error Isolation:
//    - Outbound email failure does not abort in-app notification or pipeline.
// =============================================================================

import {
  evaluateProcurementMatch,
  notifyMatchingUsers,
  ProcurementMatchTarget,
} from '@/services/procurement-matching';
import {
  emailDeliveryService,
} from '@/services/notifications/email-delivery.service';
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearInMemoryNotifications,
} from '@/services/database/notifications';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  resetNotificationPreferencesCache,
} from '@/services/notification-preferences';
import {
  upsertDiscoveredProjects,
  checkProjectDeduplication,
} from '@/services/database/procurement';
import { DiscoveredProject } from '@/types/procurement';
import { NotificationPreferences } from '@/types/notification';
import ProcurementProject from '@/models/ProcurementProject';
import UserSettings from '@/models/UserSettings';
import Notification from '@/models/Notification';

// Mock mongodb and mongoose models
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/ProcurementProject');
jest.mock('@/models/UserSettings');
jest.mock('@/models/Notification');

describe('E2E: Ingestion & Notification Delivery Workflow', () => {
  let mockProcurementStore: Map<string, any>;
  let mockUserSettingsStore: Map<string, any>;

  beforeEach(() => {
    // Reset services and in-memory caches
    emailDeliveryService.resetHistory();
    clearInMemoryNotifications();
    resetNotificationPreferencesCache();

    mockProcurementStore = new Map();
    mockUserSettingsStore = new Map();

    // Setup Notification model mock to route through inMemoryNotifications fallback
    (Notification.create as jest.Mock).mockRejectedValue(new Error('Use in-memory'));
    (Notification.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(new Error('Use in-memory')),
    });
    (Notification.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('Use in-memory')),
    });
    (Notification.countDocuments as jest.Mock).mockRejectedValue(new Error('Use in-memory'));
    (Notification.updateOne as jest.Mock).mockRejectedValue(new Error('Use in-memory'));
    (Notification.updateMany as jest.Mock).mockRejectedValue(new Error('Use in-memory'));
    (Notification.deleteOne as jest.Mock).mockRejectedValue(new Error('Use in-memory'));

    // Setup ProcurementProject model mocks
    (ProcurementProject.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockImplementation(async () => {
        return Array.from(mockProcurementStore.values());
      }),
    });

    (ProcurementProject.findOne as jest.Mock).mockImplementation(async (query: any) => {
      if (query.externalProjectId) {
        return mockProcurementStore.get(query.externalProjectId) || null;
      }
      return null;
    });

    (ProcurementProject.bulkWrite as jest.Mock).mockImplementation(async (ops: any[]) => {
      let upserted = 0;
      let modified = 0;
      for (const op of ops) {
        if (op.updateOne) {
          const extId = op.updateOne.filter.externalProjectId;
          const existing = mockProcurementStore.get(extId);
          if (existing) {
            Object.assign(existing, op.updateOne.update.$set);
            modified++;
          } else {
            const newObj = {
              _id: `proj_${extId}`,
              externalProjectId: extId,
              ...op.updateOne.update.$setOnInsert,
              ...op.updateOne.update.$set,
            };
            mockProcurementStore.set(extId, newObj);
            upserted++;
          }
        }
      }
      return { upsertedCount: upserted, modifiedCount: modified, matchedCount: modified };
    });

    // Setup UserSettings model mocks
    (UserSettings.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockImplementation(async () => {
        return Array.from(mockUserSettingsStore.values());
      }),
    });

    (UserSettings.findOne as jest.Mock).mockImplementation((query: any) => ({
      lean: jest.fn().mockImplementation(async () => {
        return mockUserSettingsStore.get(query.sessionId) || null;
      }),
    }));

    (UserSettings.findOneAndUpdate as jest.Mock).mockImplementation(async (query: any, update: any) => {
      const sessionId = query.sessionId;
      const existing = mockUserSettingsStore.get(sessionId) || {};
      const merged = { ...existing, ...update.$set };
      mockUserSettingsStore.set(sessionId, merged);
      return merged;
    });
  });

  // ===========================================================================
  // 1. Ingestion Pipeline & Discovery
  // ===========================================================================
  describe('Phase 1: Ingesting New Matching Procurement Opportunities', () => {
    it('accurately identifies new software procurement and triggers background matching', async () => {
      // 1. Configure user preferences
      const officerRecipient = 'officer_bma_01';
      await updateNotificationPreferences(officerRecipient, {
        recipientId: officerRecipient,
        inAppNotif: true,
        emailNotif: true,
        newOpportunity: true,
        email: 'officer@bangkok.go.th',
        interestTags: ['Cloud', 'AI'],
        keywords: ['Big Data', 'Platform'],
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        budgetMin: 10_000_000,
        budgetMax: 50_000_000,
      });

      // 2. Discover and ingest a matching project
      const discoveredProject: DiscoveredProject = {
        externalProjectId: '6711900101',
        projectName: 'โครงการพัฒนาระบบคลาวด์กลางและ Big Data Platform กทม.',
        agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
        procurementType: 'Cloud',
        budget: 35_000_000,
        fiscalYear: 2568,
        source: 'BMA_EGP',
        sourceUrl: 'https://egp2.bangkok.go.th/project/6711900101',
        is_software: true,
        requiredTechnologies: ['Cloud', 'Kubernetes', 'Big Data'],
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // 3. Run deduplication check
      const dedupCheck = await checkProjectDeduplication([discoveredProject]);
      expect(dedupCheck.newProjects).toHaveLength(1);
      expect(dedupCheck.duplicateProjects).toHaveLength(0);
      expect(dedupCheck.newProjects[0].externalProjectId).toBe('6711900101');

      // 4. Upsert project into database
      const upsertResult = await upsertDiscoveredProjects([discoveredProject]);
      expect(upsertResult.upsertedCount).toBe(1);

      // 5. Trigger notification evaluation for the new opportunity
      const notifs = await notifyMatchingUsers({
        id: discoveredProject.externalProjectId,
        externalId: discoveredProject.externalProjectId,
        title: { th: discoveredProject.projectName, en: 'BMA Central Cloud & Big Data Platform' },
        department: { th: discoveredProject.agencyName, en: 'Strategy and Evaluation Dept.' },
        agencyName: discoveredProject.agencyName,
        budget: discoveredProject.budget,
        category: discoveredProject.procurementType,
        requiredTechnologies: discoveredProject.requiredTechnologies,
        deadline: discoveredProject.deadline,
      });

      expect(notifs.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 2. Background Preference Matching Engine
  // ===========================================================================
  describe('Phase 2: Preference Matching Engine Evaluation (evaluateProcurementMatch)', () => {
    const defaultUserPrefs: NotificationPreferences = {
      recipientId: 'user_analyst_1',
      newOpportunity: true,
      savedUpdate: true,
      deadlineReminder: true,
      inAppNotif: true,
      emailNotif: true,
      dailyDigest: true,
      email: 'analyst@bangkok.go.th',
      interestTags: ['AI', 'Cloud'],
      keywords: ['ระบบตรวจจับ', 'computer vision'],
      agencies: ['สำนักการจราจรและขนส่ง'],
      budgetMin: 2_000_000,
      budgetMax: 15_000_000,
      language: 'th',
    };

    it('successfully matches procurement meeting category, keywords, budget, and agency criteria', () => {
      const opportunity: ProcurementMatchTarget = {
        externalId: '6711900201',
        title: {
          th: 'โครงการจัดหาระบบตรวจจับยานพาหนะอัจฉริยะด้วย Computer Vision',
          en: 'Intelligent Vehicle Detection System using Computer Vision',
        },
        department: { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic and Transport Department' },
        category: 'AI',
        requiredTechnologies: ['AI', 'Python', 'Computer Vision', 'PyTorch'],
        budget: 8_500_000,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      };

      const result = evaluateProcurementMatch(opportunity, defaultUserPrefs);
      expect(result.isMatch).toBe(true);
      expect(result.matchedTags).toContain('ai');
      expect(result.matchedTags).toContain('computer vision');
      expect(result.matchedTags).toContain('ระบบตรวจจับ');
      expect(result.reasons.some((r) => r.includes('สำนักการจราจรและขนส่ง'))).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('rejects procurement when budget is below user minimum threshold', () => {
      const lowBudgetOpportunity: ProcurementMatchTarget = {
        externalId: '6711900202',
        title: { th: 'ระบบตรวจจับป้ายทะเบียนขนาดเล็ก', en: 'Small License Plate Detection' },
        department: 'สำนักการจราจรและขนส่ง',
        category: 'AI',
        budget: 900_000, // < 2,000,000 min
      };

      const result = evaluateProcurementMatch(lowBudgetOpportunity, defaultUserPrefs);
      expect(result.isMatch).toBe(false);
      expect(result.reasons[0]).toContain('lower than user minimum');
    });

    it('rejects procurement when budget exceeds user maximum threshold', () => {
      const highBudgetOpportunity: ProcurementMatchTarget = {
        externalId: '6711900203',
        title: { th: 'ระบบ AI จราจรอัจฉริยะทั่วกรุงเทพฯ ระยะที่ 3', en: 'BMA Mega Traffic AI Phase 3' },
        department: 'สำนักการจราจรและขนส่ง',
        category: 'AI',
        budget: 50_000_000, // > 15,000,000 max
      };

      const result = evaluateProcurementMatch(highBudgetOpportunity, defaultUserPrefs);
      expect(result.isMatch).toBe(false);
      expect(result.reasons[0]).toContain('exceeds user maximum');
    });

    it('rejects procurement when issuing agency does not match configured agencies', () => {
      const wrongAgencyOpportunity: ProcurementMatchTarget = {
        externalId: '6711900204',
        title: { th: 'ระบบตรวจจับภาพถ่ายรังสีทางการแพทย์ด้วย AI', en: 'Medical X-Ray AI Detection' },
        department: 'สำนักการแพทย์', // Not in user's agencies
        category: 'AI',
        budget: 5_000_000,
      };

      const result = evaluateProcurementMatch(wrongAgencyOpportunity, defaultUserPrefs);
      expect(result.isMatch).toBe(false);
      expect(result.reasons[0]).toContain('agency does not match');
    });

    it('rejects procurement when neither interest category nor custom keywords match', () => {
      const unrelatedOpportunity: ProcurementMatchTarget = {
        externalId: '6711900205',
        title: { th: 'โครงการจัดหาโปรแกรมบัญชีและพัสดุทั่วไป', en: 'General Accounting Software' },
        department: 'สำนักการจราจรและขนส่ง',
        category: 'ERP',
        budget: 4_000_000,
      };

      const result = evaluateProcurementMatch(unrelatedOpportunity, defaultUserPrefs);
      expect(result.isMatch).toBe(false);
      expect(result.reasons[0]).toContain('No matching category or keywords');
    });

    it('rejects procurement when user disabled new opportunity master toggle', () => {
      const disabledPrefs: NotificationPreferences = {
        ...defaultUserPrefs,
        newOpportunity: false,
      };

      const matchingOpportunity: ProcurementMatchTarget = {
        externalId: '6711900206',
        title: { th: 'ระบบตรวจจับการจราจร AI', en: 'AI Traffic Detection' },
        department: 'สำนักการจราจรและขนส่ง',
        category: 'AI',
        budget: 5_000_000,
      };

      const result = evaluateProcurementMatch(matchingOpportunity, disabledPrefs);
      expect(result.isMatch).toBe(false);
      expect(result.reasons[0]).toContain('disabled new opportunity');
    });

    it('gracefully permits match when procurement budget is unspecified / null in structured fields', () => {
      const torOnlyBudgetOpportunity: ProcurementMatchTarget = {
        externalId: '6711900207',
        title: { th: 'ระบบคลาวด์สำหรับจัดเก็บข้อมูลจราจร', en: 'Cloud Storage for Traffic Data' },
        department: 'สำนักการจราจรและขนส่ง',
        category: 'Cloud',
        budget: undefined, // Budget specified inside attached TOR PDF
      };

      const result = evaluateProcurementMatch(torOnlyBudgetOpportunity, defaultUserPrefs);
      expect(result.isMatch).toBe(true);
      expect(result.matchedTags).toContain('cloud');
    });
  });

  // ===========================================================================
  // 3. In-App Notification Generation & Validation
  // ===========================================================================
  describe('Phase 3: Generation & Lifecycle of In-App Alerts', () => {
    it('creates in-app alert with direct link, formatted budget, unread state, and match metadata', async () => {
      const recipientId = 'usr_engineer_301';
      await updateNotificationPreferences(recipientId, {
        recipientId,
        inAppNotif: true,
        emailNotif: false,
        newOpportunity: true,
        interestTags: ['Mobile App'],
        keywords: ['Traffy Fondue', 'บริการประชาชน'],
        budgetMin: 1_000_000,
        budgetMax: 20_000_000,
      });

      const procurement: ProcurementMatchTarget = {
        externalId: '6711900301',
        title: {
          th: 'โครงการพัฒนา Mobile Application เชื่อมต่อ Traffy Fondue บริการประชาชน',
          en: 'Mobile Application Development Connected to Traffy Fondue',
        },
        category: 'Mobile App',
        department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy and Evaluation Dept.' },
        budget: 12_500_000,
      };

      const notifs = await notifyMatchingUsers(procurement);
      expect(notifs).toHaveLength(1);

      const alert = notifs[0];
      expect(alert.recipientId).toBe(recipientId);
      expect(alert.type).toBe('PROCUREMENT_MATCHED');
      expect(alert.priority).toBe('MEDIUM');
      expect(alert.isRead).toBe(false);
      expect(alert.linkUrl).toBe('/opportunities/6711900301');
      expect(alert.title.th).toContain('โครงการพัฒนา Mobile Application');
      expect(alert.message.th).toContain('12,500,000 บาท');
      expect(alert.metadata?.matchReasons).toBeDefined();
      expect(alert.metadata?.procurementCategory).toBe('Mobile App');
      expect(alert.metadata?.procurementBudget).toBe(12_500_000);

      // Verify unread count
      const unreadCount = await getUnreadCount(recipientId);
      expect(unreadCount).toBe(1);

      // Verify feed retrieval
      const feed = await getNotifications(recipientId, { unreadOnly: true });
      expect(feed.total).toBe(1);
      expect(feed.data[0].id).toBe(alert.id);

      // Test mark as read lifecycle transition
      const markSuccess = await markAsRead(recipientId, alert.id);
      expect(markSuccess).toBe(true);

      const remainingUnread = await getUnreadCount(recipientId);
      expect(remainingUnread).toBe(0);
    });

    it('enforces in-app notification idempotency preventing duplicate alert generation', async () => {
      const recipientId = 'usr_idempotent_test';
      await updateNotificationPreferences(recipientId, {
        recipientId,
        inAppNotif: true,
        emailNotif: false,
        newOpportunity: true,
        interestTags: ['Website'],
      });

      const procurement: ProcurementMatchTarget = {
        externalId: '6711900302',
        title: { th: 'ระบบเว็บไซต์เผยแพร่ข้อมูลเปิด กทม.', en: 'BMA Open Data Portal Website' },
        category: 'Website',
        budget: 3_000_000,
      };

      // First run generates notification
      const firstRun = await notifyMatchingUsers(procurement);
      expect(firstRun).toHaveLength(1);
      const firstId = firstRun[0].id;

      // Second run with identical procurement returns deduplicated notification without adding new one
      const secondRun = await notifyMatchingUsers(procurement);
      expect(secondRun).toHaveLength(1);
      expect(secondRun[0].id).toBe(firstId);

      const totalFeed = await getNotifications(recipientId);
      expect(totalFeed.total).toBe(1);
    });
  });

  // ===========================================================================
  // 4. Email Delivery Service Outbound Validation
  // ===========================================================================
  describe('Phase 4: Outbound Opportunity Alert Delivery via EmailDeliveryService', () => {
    it('dispatches email alert with formatted budget, department, match reasons, and direct opportunity URL', async () => {
      const recipientId = 'usr_email_recipient';
      const targetEmail = 'procurement.director@bma-digital.go.th';

      await updateNotificationPreferences(recipientId, {
        recipientId,
        inAppNotif: false,
        emailNotif: true,
        newOpportunity: true,
        email: targetEmail,
        interestTags: ['Cybersecurity'],
        keywords: ['SOC', 'Security'],
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        budgetMin: 5_000_000,
        budgetMax: 40_000_000,
      });

      const procurement: ProcurementMatchTarget = {
        externalId: '6711900401',
        title: {
          th: 'โครงการจ้างพัฒนาระบบเฝ้าระวังความมั่นคงปลอดภัยไซเบอร์ (BMA SOC)',
          en: 'BMA Security Operations Center (SOC) Development Project',
        },
        department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy and Evaluation Department' },
        category: 'Cybersecurity',
        budget: 28_000_000,
        deadline: new Date('2026-12-15T16:30:00Z'),
      };

      await notifyMatchingUsers(procurement);

      const sentEmails = emailDeliveryService.getSentEmails();
      expect(sentEmails).toHaveLength(1);

      const sent = sentEmails[0];
      // 1. Recipient check
      expect(sent.to).toBe(targetEmail);

      // 2. Subject check
      expect(sent.subject).toContain('[TORBIDD แจ้งเตือน] พบโอกาสจัดซื้อใหม่ตรงตามความสนใจ:');
      expect(sent.subject).toContain('BMA SOC');

      // 3. Plaintext body validation
      expect(sent.text).toContain('โครงการจ้างพัฒนาระบบเฝ้าระวังความมั่นคงปลอดภัยไซเบอร์ (BMA SOC)');
      expect(sent.text).toContain('สำนักยุทธศาสตร์และประเมินผล');
      expect(sent.text).toContain('28,000,000 THB');
      expect(sent.text).toContain('/opportunities/6711900401');

      // 4. HTML body validation
      expect(sent.html).toContain('TORBIDD Opportunity Alert');
      expect(sent.html).toContain('สำนักยุทธศาสตร์และประเมินผล');
      expect(sent.html).toContain('28,000,000 THB');
      expect(sent.html).toContain('/opportunities/6711900401');
      expect(sent.html).toContain('ดูรายละเอียดโครงการและข้อกำหนด TOR');
    });

    it('suppresses duplicate outbound emails within the 1-hour deduplication window', async () => {
      const recipientEmail = 'analyst.team@bangkok.go.th';
      const projectPayload = {
        id: '6711900402',
        title: { th: 'โครงการติดตั้งระบบกล้อง AI อัจฉริยะ', en: 'Smart AI Camera System' },
        department: 'สำนักการจราจรและขนส่ง',
        budget: 15_000_000,
      };

      // 1. First dispatch succeeds
      const firstResult = await emailDeliveryService.sendOpportunityAlert({
        recipientEmail,
        recipientName: 'เจ้าหน้าที่ กทม.',
        project: projectPayload,
        matchReasons: ['หมวดหมู่ AI', 'งบประมาณ 15,000,000 THB'],
      });

      expect(firstResult.success).toBe(true);
      expect(emailDeliveryService.getSentEmails()).toHaveLength(1);

      // 2. Immediate second dispatch for identical project and recipient is suppressed by deduplication window
      const secondResult = await emailDeliveryService.sendOpportunityAlert({
        recipientEmail,
        recipientName: 'เจ้าหน้าที่ กทม.',
        project: projectPayload,
        matchReasons: ['หมวดหมู่ AI', 'งบประมาณ 15,000,000 THB'],
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.messageId).toContain('dedup-suppressed-6711900402');
      // No extra email recorded
      expect(emailDeliveryService.getSentEmails()).toHaveLength(1);
    });

    it('validates email address format and rejects malformed addresses safely without throwing', async () => {
      const invalidEmail = 'not-an-email-address';
      const result = await emailDeliveryService.sendOpportunityAlert({
        recipientEmail: invalidEmail,
        project: {
          id: '6711900403',
          title: 'โครงการทดสอบ',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid recipient email address');
      expect(emailDeliveryService.getSentEmails()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 5. Channel Toggle Matrix (In-App Only, Email Only, Both, None)
  // ===========================================================================
  describe('Phase 5: Notification Channel Delivery Matrix', () => {
    const testOpportunity: ProcurementMatchTarget = {
      externalId: '6711900501',
      title: { th: 'ระบบศูนย์ปฏิบัติการอัจฉริยะ (IOC)', en: 'Intelligent Operations Center' },
      category: 'Cloud',
      budget: 18_000_000,
    };

    it('Scenario A (In-App Only): generates in-app alert and sends 0 emails', async () => {
      const recipient = 'usr_channel_inapp_only';
      await updateNotificationPreferences(recipient, {
        recipientId: recipient,
        inAppNotif: true,
        emailNotif: false,
        newOpportunity: true,
        interestTags: ['Cloud'],
      });

      const notifs = await notifyMatchingUsers(testOpportunity);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].recipientId).toBe(recipient);
      expect(emailDeliveryService.getSentEmails()).toHaveLength(0);
    });

    it('Scenario B (Email Only): dispatches outbound email and generates 0 in-app alerts', async () => {
      const recipient = 'usr_channel_email_only';
      await updateNotificationPreferences(recipient, {
        recipientId: recipient,
        inAppNotif: false,
        emailNotif: true,
        newOpportunity: true,
        email: 'email.only@bma.go.th',
        interestTags: ['Cloud'],
      });

      const notifs = await notifyMatchingUsers(testOpportunity);
      // In-app notifications generated = 0
      expect(notifs).toHaveLength(0);

      // Email sent = 1
      const sentEmails = emailDeliveryService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe('email.only@bma.go.th');
    });

    it('Scenario C (Both Channels): delivers both in-app alert and outbound email', async () => {
      const recipient = 'usr_channel_both';
      await updateNotificationPreferences(recipient, {
        recipientId: recipient,
        inAppNotif: true,
        emailNotif: true,
        newOpportunity: true,
        email: 'both.channels@bma.go.th',
        interestTags: ['Cloud'],
      });

      const notifs = await notifyMatchingUsers(testOpportunity);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].recipientId).toBe(recipient);

      const sentEmails = emailDeliveryService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe('both.channels@bma.go.th');
    });

    it('Scenario D (All Channels Disabled): generates 0 in-app alerts and 0 emails', async () => {
      const recipient = 'usr_channel_none';
      await updateNotificationPreferences(recipient, {
        recipientId: recipient,
        inAppNotif: false,
        emailNotif: false,
        newOpportunity: true,
        email: 'disabled@bma.go.th',
        interestTags: ['Cloud'],
      });

      const notifs = await notifyMatchingUsers(testOpportunity);
      expect(notifs).toHaveLength(0);
      expect(emailDeliveryService.getSentEmails()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 6. Multi-User Notification Routing & Targeted Delivery
  // ===========================================================================
  describe('Phase 6: Multi-User Targeted Notification Routing', () => {
    it('accurately routes opportunities only to matching recipients without cross-contamination', async () => {
      // User 1: AI Specialist
      const userAI = 'user_ai_specialist';
      await updateNotificationPreferences(userAI, {
        recipientId: userAI,
        inAppNotif: true,
        emailNotif: true,
        newOpportunity: true,
        email: 'ai.specialist@bma.go.th',
        interestTags: ['AI'],
        budgetMin: 1_000_000,
        budgetMax: 20_000_000,
      });

      // User 2: Cloud Architect
      const userCloud = 'user_cloud_architect';
      await updateNotificationPreferences(userCloud, {
        recipientId: userCloud,
        inAppNotif: true,
        emailNotif: true,
        newOpportunity: true,
        email: 'cloud.architect@bma.go.th',
        interestTags: ['Cloud'],
        budgetMin: 5_000_000,
        budgetMax: 50_000_000,
      });

      // User 3: Healthcare Officer (Only interested in สำนักการแพทย์)
      const userHealth = 'user_health_officer';
      await updateNotificationPreferences(userHealth, {
        recipientId: userHealth,
        inAppNotif: true,
        emailNotif: true,
        newOpportunity: true,
        email: 'health.officer@bma.go.th',
        agencies: ['สำนักการแพทย์'],
        interestTags: ['Website', 'Mobile App'],
      });

      // Published Opportunity: AI-Specific project under Traffic Department
      const aiProcurement: ProcurementMatchTarget = {
        externalId: '6711900601',
        title: { th: 'ระบบ AI ตรวจจับฝ่าไฟแดง', en: 'AI Red Light Violation Detection' },
        department: 'สำนักการจราจรและขนส่ง',
        category: 'AI',
        budget: 8_000_000,
      };

      const matchedNotifs = await notifyMatchingUsers(aiProcurement);

      // Only User AI should receive in-app alert
      expect(matchedNotifs).toHaveLength(1);
      expect(matchedNotifs[0].recipientId).toBe(userAI);

      // Only User AI should receive email
      const sentEmails = emailDeliveryService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe('ai.specialist@bma.go.th');

      // Verify User Cloud & User Health have 0 notifications
      const cloudFeed = await getNotifications(userCloud);
      const healthFeed = await getNotifications(userHealth);
      expect(cloudFeed.total).toBe(0);
      expect(healthFeed.total).toBe(0);
    });
  });

  // ===========================================================================
  // 7. Fault Tolerance & Non-Blocking Pipeline Execution
  // ===========================================================================
  describe('Phase 7: Pipeline Resilience & Fault Isolation', () => {
    it('preserves in-app alert creation even when email delivery service throws an unexpected error', async () => {
      const recipient = 'usr_resilience_test';
      await updateNotificationPreferences(recipient, {
        recipientId: recipient,
        inAppNotif: true,
        emailNotif: true,
        newOpportunity: true,
        email: 'resilient@bangkok.go.th',
        interestTags: ['AI'],
      });

      // Force sendOpportunityAlert to throw an unexpected exception
      const spySendEmail = jest
        .spyOn(emailDeliveryService, 'sendOpportunityAlert')
        .mockRejectedValueOnce(new Error('SMTP Socket Timeout connection error'));

      const procurement: ProcurementMatchTarget = {
        externalId: '6711900701',
        title: { th: 'โครงการ AI วิเคราะห์ผังเมือง', en: 'City Planning AI Analysis' },
        category: 'AI',
        budget: 6_000_000,
      };

      // Pipeline execution should NOT throw uncaught exception
      let notifs: any[] = [];
      await expect(
        (async () => {
          notifs = await notifyMatchingUsers(procurement);
        })(),
      ).resolves.not.toThrow();

      // In-app alert was successfully generated despite the email failure
      expect(notifs).toHaveLength(1);
      expect(notifs[0].recipientId).toBe(recipient);
      expect(notifs[0].procurementId).toBe('6711900701');

      spySendEmail.mockRestore();
    });
  });
});
