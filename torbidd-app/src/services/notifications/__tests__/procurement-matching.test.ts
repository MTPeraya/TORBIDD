/**
 * @jest-environment node
 */
import {
  evaluateProcurementMatch,
  notifyMatchingUsers,
} from '@/services/procurement-matching';
import { NotificationPreferences } from '@/types/notification';

describe('Procurement Matching Engine (Issue #134 & UC-11 Main Flow)', () => {
  const basePreferences: NotificationPreferences = {
    recipientId: 'test_user_1',
    newOpportunity: true,
    savedUpdate: true,
    deadlineReminder: true,
    emailNotif: true,
    dailyDigest: true,
    interestTags: ['Website', 'AI'],
    budgetMin: 500000,
    budgetMax: 5000000,
    language: 'th',
  };

  it('matches a procurement matching category and within budget range', () => {
    const procurement = {
      externalId: 101,
      title: { th: 'ระบบเว็บไซต์สารสนเทศ กทม.', en: 'BMA Information Portal Website' },
      budget: 2000000,
      category: 'Website',
      requiredTechnologies: ['Next.js', 'PostgreSQL'],
    };

    const result = evaluateProcurementMatch(procurement, basePreferences);
    expect(result.isMatch).toBe(true);
    expect(result.matchedTags).toContain('website');
    expect(result.score).toBeGreaterThan(0);
  });

  it('matches a procurement through required technologies', () => {
    const procurement = {
      externalId: 102,
      title: { th: 'ระบบกล้องตรวจจับการจราจร', en: 'Traffic Detection System' },
      budget: 3500000,
      category: 'Database',
      requiredTechnologies: ['AI', 'Python', 'Computer Vision'],
    };

    const result = evaluateProcurementMatch(procurement, basePreferences);
    expect(result.isMatch).toBe(true);
    expect(result.matchedTags).toContain('ai');
  });

  it('rejects a procurement when category/tags do not match (Alternative Flow A1)', () => {
    const procurement = {
      externalId: 103,
      title: { th: 'ระบบจัดการขยะและสิ่งแวดล้อม', en: 'Waste Management System' },
      budget: 1500000,
      category: 'Mobile App',
      requiredTechnologies: ['Flutter', 'iOS', 'Android'],
    };

    const prefsWithoutMobile: NotificationPreferences = {
      ...basePreferences,
      interestTags: ['Cloud', 'Blockchain'],
    };

    const result = evaluateProcurementMatch(procurement, prefsWithoutMobile);
    expect(result.isMatch).toBe(false);
    expect(result.matchedTags).toHaveLength(0);
  });

  it('rejects a procurement when budget is below user minimum budget', () => {
    const procurement = {
      externalId: 104,
      title: { th: 'ระบบเว็บไซต์ประชาสัมพันธ์', en: 'PR Website' },
      budget: 300000, // < 500,000 min
      category: 'Website',
    };

    const result = evaluateProcurementMatch(procurement, basePreferences);
    expect(result.isMatch).toBe(false);
    expect(result.reasons[0]).toContain('lower than user minimum');
  });

  it('rejects a procurement when budget exceeds user maximum budget', () => {
    const procurement = {
      externalId: 105,
      title: { th: 'ระบบคลาวด์และ AI ขนาดใหญ่', en: 'Large Scale AI Cloud' },
      budget: 12000000, // > 5,000,000 max
      category: 'AI',
    };

    const result = evaluateProcurementMatch(procurement, basePreferences);
    expect(result.isMatch).toBe(false);
    expect(result.reasons[0]).toContain('exceeds user maximum');
  });

  it('does not send notification when user disabled new opportunity alerts', () => {
    const disabledPrefs: NotificationPreferences = {
      ...basePreferences,
      newOpportunity: false,
    };

    const procurement = {
      externalId: 106,
      title: { th: 'ระบบเว็บไซต์สารสนเทศ', en: 'Info Website' },
      budget: 2000000,
      category: 'Website',
    };

    const result = evaluateProcurementMatch(procurement, disabledPrefs);
    expect(result.isMatch).toBe(false);
    expect(result.reasons[0]).toContain('disabled');
  });

  it('generates notification with direct link and prevents duplicates on notifyMatchingUsers', async () => {
    const procurement = {
      id: 'proj_201',
      externalId: 201,
      title: { th: 'ระบบปัญญาประดิษฐ์ตรวจวัดคุณภาพน้ำ', en: 'AI Water Quality System' },
      budget: 3000000,
      category: 'AI',
      requiredTechnologies: ['AI', 'IoT'],
    };

    const firstRun = await notifyMatchingUsers(procurement);
    expect(firstRun.length).toBeGreaterThan(0);
    expect(firstRun[0].linkUrl).toBe('/opportunities/201');
    expect(firstRun[0].type).toBe('PROCUREMENT_MATCHED');

    // Second run with same procurement must deduplicate via idempotency key
    const secondRun = await notifyMatchingUsers(procurement);
    expect(secondRun[0].id).toBe(firstRun[0].id);
  });

  describe('UC-6 Criteria & Channel Matching Extensions', () => {
    it('matches custom keywords in project title, description, or text', () => {
      const kwPrefs: NotificationPreferences = {
        ...basePreferences,
        interestTags: [],
        keywords: ['gis', 'traffy fondue'],
      };

      const matchingProcurement = {
        externalId: 301,
        title: { th: 'โครงการพัฒนาระบบแผนที่ GIS กรุงเทพฯ', en: 'BMA GIS Map System' },
        description: { th: 'เชื่อมโยงข้อมูลผังเมือง', en: 'City planning' },
        budget: 4000000,
      };

      const result = evaluateProcurementMatch(matchingProcurement, kwPrefs);
      expect(result.isMatch).toBe(true);
      expect(result.matchedTags).toContain('gis');
    });

    it('rejects procurement when custom keywords are configured but do not match', () => {
      const kwPrefs: NotificationPreferences = {
        ...basePreferences,
        interestTags: [],
        keywords: ['cybersecurity', 'penetration testing'],
      };

      const nonMatchingProcurement = {
        externalId: 302,
        title: { th: 'โครงการจัดซื้อโปรแกรมงานเอกสารสำนักงาน', en: 'Office Document Software' },
        budget: 1000000,
      };

      const result = evaluateProcurementMatch(nonMatchingProcurement, kwPrefs);
      expect(result.isMatch).toBe(false);
    });

    it('matches issuing agency criteria when agency matches', () => {
      const agencyPrefs: NotificationPreferences = {
        ...basePreferences,
        agencies: ['สำนักการจราจรและขนส่ง'],
      };

      const matchingAgency = {
        externalId: 303,
        title: { th: 'ระบบควบคุมสัญญาณไฟจราจรอัจฉริยะ', en: 'Smart Traffic Light System' },
        department: { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic and Transport Dept.' },
        category: 'AI',
        budget: 3000000,
      };

      const result = evaluateProcurementMatch(matchingAgency, agencyPrefs);
      expect(result.isMatch).toBe(true);
      expect(result.reasons.some((r) => r.includes('agency'))).toBe(true);
    });

    it('rejects procurement when issuing agency does not match selected agencies', () => {
      const agencyPrefs: NotificationPreferences = {
        ...basePreferences,
        agencies: ['สำนักการแพทย์'],
      };

      const otherAgency = {
        externalId: 304,
        title: { th: 'ระบบติดตามการเรียนการสอน', en: 'Education Learning System' },
        department: { th: 'สำนักการศึกษา', en: 'Education Department' },
        category: 'Website',
        budget: 2000000,
      };

      const result = evaluateProcurementMatch(otherAgency, agencyPrefs);
      expect(result.isMatch).toBe(false);
      expect(result.reasons[0]).toContain('agency does not match');
    });

    it('permits match when procurement budget is missing/unknown and categories match', () => {
      const procurementWithNoBudget = {
        externalId: 305,
        title: { th: 'ระบบปัญญาประดิษฐ์วิเคราะห์ภาพกล้อง', en: 'AI Camera Analytics' },
        category: 'AI',
        budget: undefined, // Unknown/unspecified budget
      };

      const result = evaluateProcurementMatch(procurementWithNoBudget, basePreferences);
      expect(result.isMatch).toBe(true);
    });

    it('correctly handles all four channel selection combinations', async () => {
      const { emailDeliveryService } = await import('@/services/notifications/email-delivery.service');
      const { updateNotificationPreferences } = await import('@/services/notification-preferences');

      const testProcurement = {
        id: 'channel_test_401',
        externalId: 401,
        title: { th: 'โครงการทดสอบช่องทางการแจ้งเตือน', en: 'Channel Test Project' },
        category: 'AI',
        budget: 2500000,
      };

      // 1. In-app ON, Email OFF
      const user1 = `channel_user_inapp_${Date.now()}`;
      await updateNotificationPreferences(user1, {
        inAppNotif: true,
        emailNotif: false,
        newOpportunity: true,
        interestTags: ['AI'],
        email: 'user1@bma.go.th',
      });
      emailDeliveryService.resetHistory();
      await notifyMatchingUsers(testProcurement);
      // In-app should be created, 0 emails sent to user1
      expect(emailDeliveryService.getSentEmails().filter((e) => e.to === 'user1@bma.go.th')).toHaveLength(0);

      // 2. In-app OFF, Email ON
      const user2 = `channel_user_email_${Date.now()}`;
      await updateNotificationPreferences(user2, {
        inAppNotif: false,
        emailNotif: true,
        newOpportunity: true,
        interestTags: ['AI'],
        email: 'user2@bma.go.th',
      });
      emailDeliveryService.resetHistory();
      const notifs = await notifyMatchingUsers(testProcurement);
      const user2InApp = notifs.filter((n) => n.recipientId === user2);
      expect(user2InApp).toHaveLength(0); // In-app blocked
      const user2Emails = emailDeliveryService.getSentEmails().filter((e) => e.to === 'user2@bma.go.th');
      expect(user2Emails.length).toBeGreaterThanOrEqual(1); // Email sent

      // 3. Both ON
      const user3 = `channel_user_both_${Date.now()}`;
      await updateNotificationPreferences(user3, {
        inAppNotif: true,
        emailNotif: true,
        newOpportunity: true,
        interestTags: ['AI'],
        email: 'user3@bma.go.th',
      });
      emailDeliveryService.resetHistory();
      const bothNotifs = await notifyMatchingUsers(testProcurement);
      const user3InApp = bothNotifs.filter((n) => n.recipientId === user3);
      expect(user3InApp.length).toBeGreaterThanOrEqual(1); // In-app created
      const user3Emails = emailDeliveryService.getSentEmails().filter((e) => e.to === 'user3@bma.go.th');
      expect(user3Emails.length).toBeGreaterThanOrEqual(1); // Email sent

      // 4. Both OFF
      const user4 = `channel_user_none_${Date.now()}`;
      await updateNotificationPreferences(user4, {
        inAppNotif: false,
        emailNotif: false,
        newOpportunity: true,
        interestTags: ['AI'],
        email: 'user4@bma.go.th',
      });
      emailDeliveryService.resetHistory();
      const noneNotifs = await notifyMatchingUsers(testProcurement);
      expect(noneNotifs.filter((n) => n.recipientId === user4)).toHaveLength(0);
      expect(emailDeliveryService.getSentEmails().filter((e) => e.to === 'user4@bma.go.th')).toHaveLength(0);
    });
  });
});
