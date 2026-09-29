/**
 * @jest-environment node
 */
import { scanAndSendDeadlineReminders } from '@/services/notifications/deadline-scanner';
import { emailDeliveryService } from '@/services/notifications/email-delivery.service';

describe('Deadline Reminder Scanner (UC-6 & Issue #132)', () => {
  beforeEach(() => {
    emailDeliveryService.resetHistory();
  });

  it('scans approaching deadlines and safely executes scanner without error', async () => {
    const summary = await scanAndSendDeadlineReminders();
    expect(summary).toBeDefined();
    expect(typeof summary.scannedProjects).toBe('number');
    expect(typeof summary.qualifyingProjects).toBe('number');
    expect(typeof summary.notificationsCreated).toBe('number');
    expect(typeof summary.emailsSent).toBe('number');
  });
});
