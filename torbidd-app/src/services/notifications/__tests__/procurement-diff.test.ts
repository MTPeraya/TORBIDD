/**
 * @jest-environment node
 */
import {
  detectProcurementChanges,
  notifySavedProcurementUpdate,
} from '@/services/procurement-diff';

describe('Saved Procurement Update Rules & Change Detection (Issue #135, #140)', () => {
  it('detects procurement status changes with high/urgent priority', () => {
    const oldProj = {
      externalId: 301,
      title: 'โครงการระบบสารสนเทศ',
      status: 'open',
    };
    const newProj = {
      externalId: 301,
      title: 'โครงการระบบสารสนเทศ',
      status: 'closingSoon',
    };

    const diff = detectProcurementChanges(oldProj, newProj);
    expect(diff.hasMeaningfulChange).toBe(true);
    expect(diff.changeType).toBe('STATUS_CHANGED');
    expect(diff.priority).toBe('URGENT');
    expect(diff.changedFields[0].field).toBe('status');
  });

  it('detects submission deadline extension by >= 1 day', () => {
    const oldProj = {
      externalId: 302,
      title: 'โครงการพัฒนาแพลตฟอร์ม',
      deadline: '2026-10-15T09:00:00Z',
    };
    const newProj = {
      externalId: 302,
      title: 'โครงการพัฒนาแพลตฟอร์ม',
      deadline: '2026-10-25T09:00:00Z', // 10 days extension
    };

    const diff = detectProcurementChanges(oldProj, newProj);
    expect(diff.hasMeaningfulChange).toBe(true);
    expect(diff.priority).toBe('HIGH');
    expect(diff.changedFields[0].field).toBe('deadline');
    expect(diff.summary.th).toContain('ขยายเวลา');
  });

  it('detects budget alteration', () => {
    const oldProj = {
      externalId: 303,
      title: 'โครงการปรับปรุงฐานข้อมูล',
      budget: 5000000,
    };
    const newProj = {
      externalId: 303,
      title: 'โครงการปรับปรุงฐานข้อมูล',
      budget: 6500000,
    };

    const diff = detectProcurementChanges(oldProj, newProj);
    expect(diff.hasMeaningfulChange).toBe(true);
    expect(diff.changedFields[0].field).toBe('budget');
  });

  it('detects TOR revision bump', () => {
    const oldProj = {
      externalId: 304,
      title: 'โครงการพัฒนาระบบ AI',
      revision: 1,
    };
    const newProj = {
      externalId: 304,
      title: 'โครงการพัฒนาระบบ AI',
      revision: 2,
    };

    const diff = detectProcurementChanges(oldProj, newProj);
    expect(diff.hasMeaningfulChange).toBe(true);
    expect(diff.changeType).toBe('TOR_UPDATED');
    expect(diff.changedFields[0].field).toBe('revision');
  });

  it('suppresses notifications when changes are minor/non-meaningful (Alternative Flow A2)', () => {
    const oldProj = {
      externalId: 305,
      title: 'โครงการระบบสารสนเทศ',
      budget: 4000000,
      status: 'open',
      deadline: '2026-10-15T09:00:00Z',
      revision: 1,
      processedDate: new Date('2026-09-01'),
    };
    const newProj = {
      externalId: 305,
      title: 'โครงการระบบสารสนเทศ',
      budget: 4000000,
      status: 'open',
      deadline: '2026-10-15T09:00:00Z',
      revision: 1,
      processedDate: new Date('2026-09-02'), // internal crawler timestamp only
    };

    const diff = detectProcurementChanges(oldProj, newProj);
    expect(diff.hasMeaningfulChange).toBe(false);
    expect(diff.changedFields).toHaveLength(0);
  });

  it('returns empty array when notifySavedProcurementUpdate receives non-meaningful update', async () => {
    const oldProj = { externalId: 306, title: 'Test Project', budget: 1000000 };
    const newProj = { externalId: 306, title: 'Test Project', budget: 1000000 };

    const result = await notifySavedProcurementUpdate(oldProj, newProj);
    expect(result).toEqual([]);
  });
});
