/**
 * @jest-environment node
 */
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  shouldDeliverNotification,
} from '@/services/notification-preferences';

describe('Notification Preferences Service (Issue #137)', () => {
  const recipientId = `test_pref_user_${Date.now()}`;

  it('retrieves default notification preferences for a new recipient', async () => {
    const prefs = await getNotificationPreferences(recipientId);
    expect(prefs.newOpportunity).toBe(true);
    expect(prefs.savedUpdate).toBe(true);
    expect(prefs.deadlineReminder).toBe(true);
    expect(prefs.interestTags).toContain('Website');
  });

  it('persists and updates category preferences', async () => {
    const updated = await updateNotificationPreferences(recipientId, {
      newOpportunity: false,
      budgetMin: 1000000,
      budgetMax: 10000000,
      interestTags: ['AI', 'Database'],
    });

    expect(updated.newOpportunity).toBe(false);
    expect(updated.budgetMin).toBe(1000000);
    expect(updated.interestTags).toEqual(['AI', 'Database']);

    const fetched = await getNotificationPreferences(recipientId);
    expect(fetched.newOpportunity).toBe(false);
    expect(fetched.budgetMin).toBe(1000000);
  });

  it('strictly respects category toggles in shouldDeliverNotification', async () => {
    // newOpportunity is false for recipientId
    const canSendMatch = await shouldDeliverNotification(recipientId, 'PROCUREMENT_MATCHED');
    expect(canSendMatch).toBe(false);

    // savedUpdate is still true
    const canSendUpdate = await shouldDeliverNotification(recipientId, 'PROCUREMENT_UPDATED');
    expect(canSendUpdate).toBe(true);

    // deadlineReminder is still true
    const canSendDeadline = await shouldDeliverNotification(recipientId, 'DEADLINE_APPROACHING');
    expect(canSendDeadline).toBe(true);
  });

  it('respects budget limits during delivery evaluation', async () => {
    const freshUser = `budget_eval_user_${Date.now()}`;
    await updateNotificationPreferences(freshUser, {
      newOpportunity: true,
      budgetMin: 2000000,
      budgetMax: 5000000,
    });

    const withinBudget = await shouldDeliverNotification(freshUser, 'PROCUREMENT_MATCHED', {
      budget: 3000000,
    });
    expect(withinBudget).toBe(true);

    const underBudget = await shouldDeliverNotification(freshUser, 'PROCUREMENT_MATCHED', {
      budget: 1000000,
    });
    expect(underBudget).toBe(false);

    const overBudget = await shouldDeliverNotification(freshUser, 'PROCUREMENT_MATCHED', {
      budget: 8000000,
    });
    expect(overBudget).toBe(false);
  });
});
