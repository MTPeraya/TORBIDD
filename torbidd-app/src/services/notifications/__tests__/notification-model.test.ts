/**
 * @jest-environment node
 */
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '@/services/database/notifications';

describe('Notification Data Model & Repository (Issue #133)', () => {
  const recipientId = `test_recipient_${Date.now()}`;

  it('creates and retrieves a notification with read/unread status', async () => {
    const created = await createNotification({
      recipientId,
      procurementId: 'proj_501',
      type: 'PROCUREMENT_MATCHED',
      priority: 'MEDIUM',
      title: { th: 'โครงการใหม่', en: 'New Project' },
      message: { th: 'รายละเอียดข้อเสนอ', en: 'Proposal Details' },
      linkUrl: '/opportunities/proj_501',
    });

    expect(created).not.toBeNull();
    expect(created?.recipientId).toBe(recipientId);
    expect(created?.isRead).toBe(false);

    const feed = await getNotifications(recipientId);
    expect(feed.total).toBeGreaterThanOrEqual(1);
    expect(feed.unreadCount).toBeGreaterThanOrEqual(1);
    expect(feed.data.some((n) => n.procurementId === 'proj_501')).toBe(true);
  });

  it('marks an individual notification as read', async () => {
    const created = await createNotification({
      recipientId,
      procurementId: 'proj_502',
      type: 'PROCUREMENT_UPDATED',
      title: { th: 'อัปเดตโครงการ', en: 'Project Updated' },
      message: { th: 'ขยายเวลา', en: 'Extended' },
      linkUrl: '/opportunities/proj_502',
    });

    expect(created?.isRead).toBe(false);

    const markSuccess = await markAsRead(recipientId, created!.id);
    expect(markSuccess).toBe(true);

    const feed = await getNotifications(recipientId);
    const updated = feed.data.find((n) => n.id === created!.id);
    expect(updated?.isRead).toBe(true);
  });

  it('marks all notifications as read in bulk', async () => {
    await createNotification({
      recipientId,
      procurementId: 'proj_503',
      type: 'DEADLINE_APPROACHING',
      title: { th: 'ใกล้กำหนดส่ง', en: 'Deadline Soon' },
      message: { th: 'เหลือ 3 วัน', en: '3 days left' },
      linkUrl: '/opportunities/proj_503',
    });

    const modified = await markAllAsRead(recipientId);
    expect(modified).toBeGreaterThanOrEqual(1);

    const unread = await getUnreadCount(recipientId);
    expect(unread).toBe(0);
  });

  it('enforces idempotency and prevents duplicate notifications', async () => {
    const idempotencyKey = `unique_key_${recipientId}_proj_dup`;

    const first = await createNotification({
      recipientId,
      procurementId: 'proj_dup',
      type: 'PROCUREMENT_MATCHED',
      title: { th: 'ประกาศใหม่', en: 'New Tender' },
      message: { th: 'คำอธิบาย', en: 'Desc' },
      linkUrl: '/opportunities/proj_dup',
      idempotencyKey,
    });

    const second = await createNotification({
      recipientId,
      procurementId: 'proj_dup',
      type: 'PROCUREMENT_MATCHED',
      title: { th: 'ประกาศใหม่ (ซ้ำ)', en: 'New Tender (dup)' },
      message: { th: 'คำอธิบาย', en: 'Desc' },
      linkUrl: '/opportunities/proj_dup',
      idempotencyKey,
    });

    expect(second?.id).toBe(first?.id);
  });

  it('deletes a notification by id', async () => {
    const created = await createNotification({
      recipientId,
      procurementId: 'proj_to_delete',
      type: 'STATUS_CHANGED',
      title: { th: 'จะถูกลบ', en: 'To be deleted' },
      message: { th: 'ข้อความ', en: 'Message' },
      linkUrl: '/opportunities/proj_to_delete',
    });

    const deleted = await deleteNotification(recipientId, created!.id);
    expect(deleted).toBe(true);

    const feed = await getNotifications(recipientId);
    expect(feed.data.some((n) => n.id === created!.id)).toBe(false);
  });
});
