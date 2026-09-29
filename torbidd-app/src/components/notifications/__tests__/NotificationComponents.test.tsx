// =============================================================================
// components/notifications/__tests__/NotificationComponents.test.tsx
// UI Component Tests for Issue #136 (Notification Center) & Issue #137 (Preferences)
// =============================================================================

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { NotificationCard } from '../NotificationCard';
import { NotificationFeed } from '../NotificationFeed';
import { NotificationPreferencesPanel } from '../NotificationPreferencesPanel';
import { NotificationItem, NotificationPreferences } from '@/types/notification';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/notifications',
}));

const mockUnreadNotification: NotificationItem = {
  id: 'notif_1',
  recipientId: 'user_1',
  procurementId: '67119538991',
  type: 'PROCUREMENT_MATCHED',
  priority: 'MEDIUM',
  title: {
    th: 'โอกาสจัดซื้อใหม่ตรงกับความสนใจ: ระบบคลาวด์',
    en: 'New Matching Procurement: Cloud System',
  },
  message: {
    th: 'พบโครงการใหม่ในหมวดหมู่ Website วงเงิน 5,000,000 บาท',
    en: 'New project in Website category with budget 5,000,000 THB',
  },
  linkUrl: '/opportunities/67119538991',
  isRead: false,
  createdAt: new Date().toISOString(),
};

const mockReadNotification: NotificationItem = {
  id: 'notif_2',
  recipientId: 'user_1',
  procurementId: '67119538992',
  type: 'PROCUREMENT_UPDATED',
  priority: 'HIGH',
  title: {
    th: 'อัปเดตข้อมูลสำคัญ: ระบบฐานข้อมูล',
    en: 'Important Update on Saved Opportunity: DB System',
  },
  message: {
    th: 'ขยายเวลากำหนดส่งถึง 25 ต.ค. 2568',
    en: 'Deadline extended to Oct 25, 2026',
  },
  linkUrl: '/opportunities/67119538992',
  isRead: true,
  createdAt: new Date(Date.now() - 3600000).toISOString(),
  metadata: {
    changedFields: [
      {
        field: 'deadline',
        fieldLabel: { th: 'กำหนดการยื่นข้อเสนอ', en: 'Submission Deadline' },
        oldValue: '2026-10-15',
        newValue: '2026-10-25',
      },
    ],
  },
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <LanguageProvider>
      <ToastProvider>{ui}</ToastProvider>
    </LanguageProvider>,
  );
}

describe('NotificationCard Component', () => {
  it('renders unread notification with unread indicator and correct link', () => {
    const onMarkAsRead = jest.fn();
    renderWithProviders(
      <NotificationCard
        notification={mockUnreadNotification}
        onMarkAsRead={onMarkAsRead}
      />,
    );

    expect(screen.getByText(/โอกาสจัดซื้อใหม่ตรงกับความสนใจ/i)).toBeInTheDocument();
    expect(screen.getByText(/5,000,000/i)).toBeInTheDocument();

    const link = screen.getAllByRole('link')[0];
    expect(link).toHaveAttribute('href', '/opportunities/67119538991');

    const markBtn = screen.getByLabelText(/ทำเครื่องหมายอ่านแล้ว|Mark as read/i);
    fireEvent.click(markBtn);
    expect(onMarkAsRead).toHaveBeenCalledWith('notif_1');
  });

  it('renders read notification without unread indicator and displays changed field chips', () => {
    renderWithProviders(
      <NotificationCard
        notification={mockReadNotification}
        onMarkAsRead={jest.fn()}
      />,
    );

    expect(screen.getByText(/อัปเดตข้อมูลสำคัญ/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-25/i)).toBeInTheDocument();
  });
});

describe('NotificationFeed Component', () => {
  it('renders notification list and allows filtering between all and unread', async () => {
    const onMarkAllAsRead = jest.fn();
    renderWithProviders(
      <NotificationFeed
        notifications={[mockUnreadNotification, mockReadNotification]}
        unreadCount={1}
        isLoading={false}
        error={null}
        onMarkAsRead={jest.fn()}
        onMarkAllAsRead={onMarkAllAsRead}
        onRetry={jest.fn()}
      />,
    );

    // Initial render shows both items
    expect(screen.getByText(/โอกาสจัดซื้อใหม่ตรงกับความสนใจ/i)).toBeInTheDocument();
    expect(screen.getByText(/อัปเดตข้อมูลสำคัญ/i)).toBeInTheDocument();

    // Click Unread filter pill
    const unreadPill = screen.getByText(/ยังไม่อ่าน|Unread/i);
    fireEvent.click(unreadPill);

    // Only unread item should remain visible
    expect(screen.getByText(/โอกาสจัดซื้อใหม่ตรงกับความสนใจ/i)).toBeInTheDocument();
    expect(screen.queryByText(/อัปเดตข้อมูลสำคัญ/i)).not.toBeInTheDocument();

    // Click Mark All As Read
    const markAllBtn = screen.getByText(/อ่านทั้งหมดแล้ว|Mark All as Read/i);
    await act(async () => {
      fireEvent.click(markAllBtn);
    });
    expect(onMarkAllAsRead).toHaveBeenCalled();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = renderWithProviders(
      <NotificationFeed
        notifications={[]}
        unreadCount={0}
        isLoading={true}
        error={null}
        onMarkAsRead={jest.fn()}
        onMarkAllAsRead={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(container.querySelector('.notif-skeleton-list')).toBeInTheDocument();
  });

  it('renders empty state when there are no notifications', () => {
    renderWithProviders(
      <NotificationFeed
        notifications={[]}
        unreadCount={0}
        isLoading={false}
        error={null}
        onMarkAsRead={jest.fn()}
        onMarkAllAsRead={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText(/ยังไม่มีการแจ้งเตือน|No Notifications Yet/i)).toBeInTheDocument();
  });

  it('renders error state with retry button when error occurs', () => {
    const onRetry = jest.fn();
    renderWithProviders(
      <NotificationFeed
        notifications={[]}
        unreadCount={0}
        isLoading={false}
        error="Network connection failure"
        onMarkAsRead={jest.fn()}
        onMarkAllAsRead={jest.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/Network connection failure/i)).toBeInTheDocument();
    const retryBtn = screen.getByText(/ลองใหม่อีกครั้ง|Retry/i);
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('NotificationPreferencesPanel Component', () => {
  const mockPreferences: NotificationPreferences = {
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

  it('renders category toggles and allows modifying notification preferences', async () => {
    const onSave = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockPreferences }),
    });

    const { container } = renderWithProviders(
      <NotificationPreferencesPanel
        initialPreferences={mockPreferences}
        onPreferencesSaved={onSave}
      />,
    );

    const toggleNewOpp = container.querySelector('#toggleNewOpportunity') as HTMLInputElement;
    expect(toggleNewOpp).toBeChecked();

    fireEvent.click(toggleNewOpp);
    expect(toggleNewOpp).not.toBeChecked();

    const saveBtn = screen.getByRole('button', { name: /บันทึกการตั้งค่าการแจ้งเตือน|Save Alert Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('shows validation error when budgetMax is lower than budgetMin', () => {
    renderWithProviders(
      <NotificationPreferencesPanel initialPreferences={mockPreferences} />,
    );

    const minInput = screen.getByPlaceholderText(/งบประมาณขั้นต่ำ|Minimum/i);
    const maxInput = screen.getByPlaceholderText(/งบประมาณสูงสุด|Maximum/i);

    fireEvent.change(minInput, { target: { value: '5000000' } });
    fireEvent.change(maxInput, { target: { value: '1000000' } });

    expect(screen.getAllByText(/งบประมาณสูงสุดต้องไม่น้อยกว่างบประมาณขั้นต่ำ|Maximum budget cannot be less than minimum budget/i)[0]).toBeInTheDocument();
  });
});
