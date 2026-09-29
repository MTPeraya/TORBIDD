/**
 * @jest-environment node
 */
import { EmailDeliveryService } from '@/services/notifications/email-delivery.service';

describe('Email Delivery Service (UC-6 Flow 10)', () => {
  let emailService: EmailDeliveryService;

  beforeEach(() => {
    emailService = EmailDeliveryService.getInstance();
    emailService.resetHistory();
  });

  it('validates email formats accurately', () => {
    expect(emailService.isValidEmail('officer@bma.go.th')).toBe(true);
    expect(emailService.isValidEmail('user.name+tag@sub.domain.org')).toBe(true);
    expect(emailService.isValidEmail('not-an-email')).toBe(false);
    expect(emailService.isValidEmail('')).toBe(false);
    expect(emailService.isValidEmail(null)).toBe(false);
    expect(emailService.isValidEmail(undefined)).toBe(false);
  });

  it('successfully dispatches simulated opportunity alert email in test mode', async () => {
    const result = await emailService.sendOpportunityAlert({
      recipientEmail: 'officer@bma.go.th',
      recipientName: 'สมศักดิ์ ข้าราชการ กทม.',
      project: {
        id: '67119538991',
        title: {
          th: 'โครงการจัดซื้อและติดตั้งระบบกล้องโทรทัศน์วงจรปิด (CCTV) เพื่อความปลอดภัย',
          en: 'BMA Smart City CCTV Security System Project',
        },
        department: {
          th: 'สำนักการจราจรและขนส่ง',
          en: 'Traffic and Transport Department',
        },
        budget: 12500000,
        deadline: new Date('2026-10-15'),
        category: 'AI',
      },
      matchReasons: ['Matches keyword "CCTV"', 'Matches category "AI"', 'Matches issuing agency "สำนักการจราจรและขนส่ง"'],
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.messageId).toBeDefined();

    const sent = emailService.getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('officer@bma.go.th');
    expect(sent[0].subject).toContain('CCTV');
    expect(sent[0].html).toContain('12,500,000 THB');
    expect(sent[0].html).toContain('สำนักการจราจรและขนส่ง');
    expect(sent[0].html).toContain('/opportunities/67119538991');
  });

  it('prevents duplicate emails within the deduplication window', async () => {
    const payload = {
      recipientEmail: 'officer@bma.go.th',
      project: {
        id: 'dup_test_123',
        title: 'โครงการทดสอบการส่งซ้ำ',
        budget: 5000000,
      },
      matchReasons: ['Category matched'],
    };

    const first = await emailService.sendOpportunityAlert(payload);
    expect(first.success).toBe(true);
    expect(emailService.getSentEmails().length).toBe(1);

    // Second immediate call with identical recipient and project
    const second = await emailService.sendOpportunityAlert(payload);
    expect(second.success).toBe(true);
    // Should be suppressed by deduplication
    expect(emailService.getSentEmails().length).toBe(1);
  });

  it('safely rejects delivery for invalid recipient emails without throwing', async () => {
    const result = await emailService.sendOpportunityAlert({
      recipientEmail: 'not-a-valid-email',
      project: {
        id: 'invalid_email_test',
        title: 'Test Project',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid recipient email address');
    expect(emailService.getSentEmails().length).toBe(0);
  });

  it('successfully delivers deadline reminder email', async () => {
    const result = await emailService.sendDeadlineReminder({
      recipientEmail: 'bidder@techcorp.com',
      recipientName: 'บริษัท เทคคอร์ป จำกัด',
      project: {
        id: '67119538992',
        title: {
          th: 'โครงการจ้างพัฒนาระบบคลังข้อมูลขนาดใหญ่',
          en: 'Big Data Platform Development',
        },
        deadline: new Date('2026-10-03'),
      },
      daysRemaining: 2,
    });

    expect(result.success).toBe(true);
    const sent = emailService.getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('bidder@techcorp.com');
    expect(sent[0].subject).toContain('เหลืออีก 2 วัน');
  });
});
