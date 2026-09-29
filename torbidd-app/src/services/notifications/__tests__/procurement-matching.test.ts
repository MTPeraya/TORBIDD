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
});
