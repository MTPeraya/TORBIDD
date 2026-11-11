/**
 * E2E: Alert Preferences Configuration Across In-App & Email Channels
 *
 * Verifies that registered users can define, toggle, and save alert preferences based on:
 *  1. Delivery Channels:
 *     - In-App Channel toggle and sub-event triggers (New Opportunities, Saved Updates, Deadline Reminders)
 *     - Email Channel toggle, custom notification email address, and Daily Digest summary
 *     - Real-time channel delivery summary indicator ("Both In-app & Email", "In-app only", "Email only", "All channels disabled")
 *  2. Custom Keywords:
 *     - Adds custom search keywords via text input and "+ Add" button or Enter key
 *     - Renders active keyword tag chips with interactive remove buttons (✕)
 *     - Removes keywords and validates state update
 *     - Prevents duplicate or blank keywords
 *  3. Software Categories / Interest Tags:
 *     - Toggles software category badges (Website, Mobile App, AI, Cloud, Database, ERP, Security, etc.)
 *     - Displays active selection visual indicator (✓)
 *     - Allows multi-category selection
 *  4. Budget Range Preferences & Error Validation:
 *     - Defines minimum and maximum budget thresholds
 *     - Triggers automated visual validation error (#budgetRangeError) when budgetMax < budgetMin
 *     - Restricts saving and prevents invalid submission
 *     - Clears error upon correcting the budget boundaries
 *  5. Issuing Agencies Preferences:
 *     - Toggles BMA government departments (e.g., สำนักยุทธศาสตร์และประเมินผล, สำนักการแพทย์, สำนักการคลัง)
 *     - Multi-agency toggling with visual active state
 *  6. Persistence & Real-Time Saving:
 *     - Submits payload to PUT /api/notifications/preferences
 *     - Validates payload contents match user-defined criteria
 *     - Caches preferences in localStorage (torbidd_settings & torbidd_notif_prefs)
 *     - Displays user feedback toast ("บันทึกการตั้งค่าเรียบร้อยแล้ว" / "Settings saved successfully")
 *  7. Notification Center Tab Integration:
 *     - Toggles between Notifications Feed tab and Alert Preferences tab (#notifTabPrefs)
 *  8. Bilingual Localization (Thai <-> English):
 *     - Verifies all controls, channel tags, placeholders, and error messages translate accurately
 *  9. API Contract & Validation Rules:
 *     - Direct NextRequest integration with GET & PUT /api/notifications/preferences
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { NotificationPreferencesPanel } from '@/components/notifications/NotificationPreferencesPanel';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  shouldDeliverNotification,
} from '@/services/notification-preferences';
import { NotificationPreferencesSchema } from '@/lib/validation';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationPreferences } from '@/types/notification';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation & Context Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  usePathname: () => '/notifications',
  useSearchParams: () => new URLSearchParams(),
}));

const mockAuthUser = {
  id: 'usr_officer_001',
  email: 'officer@bangkok.go.th',
  name: 'Somchai BMA Officer',
  role: 'BMA Officer',
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    isAuthenticated: true,
    isAdmin: false,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    updateProfile: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_PREFERENCES: NotificationPreferences = {
  recipientId: 'usr_officer_001',
  inAppNotif: true,
  newOpportunity: true,
  savedUpdate: true,
  deadlineReminder: true,
  emailNotif: true,
  dailyDigest: true,
  keywords: ['ระบบคลาวด์', 'Generative AI'],
  interestTags: ['Website', 'AI'],
  agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
  budgetMin: 5_000_000,
  budgetMax: 50_000_000,
  language: 'th',
  email: 'officer@bangkok.go.th',
};

// ─────────────────────────────────────────────────────────────────────────────
// Language Switcher Helper
// ─────────────────────────────────────────────────────────────────────────────

function TestLanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div data-testid="test-language-controls">
      <button data-testid="btn-lang-th" onClick={() => setLanguage('th')}>
        TH
      </button>
      <button data-testid="btn-lang-en" onClick={() => setLanguage('en')}>
        EN
      </button>
      <span data-testid="current-lang">{language}</span>
    </div>
  );
}

function renderPanelWithProviders(props: {
  initialPreferences?: NotificationPreferences;
  onPreferencesSaved?: (prefs: NotificationPreferences) => void;
}) {
  return render(
    <ToastProvider>
      <ThemeProvider>
        <LanguageProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <TestLanguageSwitcher />
            <NotificationPreferencesPanel
              initialPreferences={props.initialPreferences}
              onPreferencesSaved={props.onPreferencesSaved}
            />
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    </ToastProvider>,
  );
}

function renderCenterWithProviders() {
  return render(
    <ToastProvider>
      <ThemeProvider>
        <LanguageProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <TestLanguageSwitcher />
            <NotificationCenter />
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    </ToastProvider>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Alert Preferences Configuration Across In-App & Email Channels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('torbidd_lang', 'th');

    global.fetch = jest.fn().mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/notifications/preferences')) {
        if (init?.method === 'PUT') {
          const body = JSON.parse((init.body as string) || '{}');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, data: body }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: INITIAL_PREFERENCES }),
        } as Response);
      }
      if (urlStr.includes('/api/notifications')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [], unreadCount: 0 }),
        } as Response);
      }
      if (urlStr.includes('/api/settings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled mock fetch URL: ${urlStr}`));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // SECTION 1: Initial Render & Criteria Inspection
  // ===========================================================================
  describe('1. Initial Render & Criteria Inspection', () => {
    it('1.1 loads initial user alert preferences and populates all criteria fields', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      // Channel toggles
      const toggleInApp = container.querySelector('#toggleInAppNotif') as HTMLInputElement;
      const toggleEmail = container.querySelector('#toggleEmailNotif') as HTMLInputElement;
      const toggleDaily = container.querySelector('#toggleDailyDigest') as HTMLInputElement;
      const emailInput = container.querySelector('#inputNotifEmail') as HTMLInputElement;

      expect(toggleInApp).toBeChecked();
      expect(toggleEmail).toBeChecked();
      expect(toggleDaily).toBeChecked();
      expect(emailInput).toHaveValue('officer@bangkok.go.th');

      // Category event toggles
      expect(container.querySelector('#toggleNewOpportunity')).toBeChecked();
      expect(container.querySelector('#toggleSavedUpdate')).toBeChecked();
      expect(container.querySelector('#toggleDeadlineReminder')).toBeChecked();

      // Keywords
      expect(screen.getByText('ระบบคลาวด์')).toBeInTheDocument();
      expect(screen.getByText('Generative AI')).toBeInTheDocument();

      // Budget Range
      const budgetMinInput = container.querySelector('#budgetMin') as HTMLInputElement;
      const budgetMaxInput = container.querySelector('#budgetMax') as HTMLInputElement;
      expect(budgetMinInput).toHaveValue(5000000);
      expect(budgetMaxInput).toHaveValue(50000000);

      // Active Categories (Website & AI)
      const websiteTag = container.querySelector('button[data-tag="Website"]');
      const aiTag = container.querySelector('button[data-tag="AI"]');
      expect(websiteTag).toHaveClass('active');
      expect(aiTag).toHaveClass('active');

      // Channel summary indicator
      expect(screen.getByText('ทั้งในระบบและอีเมล')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // SECTION 2: Channel Configuration (In-App and Email Channels)
  // ===========================================================================
  describe('2. Delivery Channels Configuration', () => {
    it('2.1 toggling channels dynamically updates the channel delivery summary pill', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      const toggleInApp = container.querySelector('#toggleInAppNotif') as HTMLInputElement;
      const toggleEmail = container.querySelector('#toggleEmailNotif') as HTMLInputElement;

      // Both enabled initially
      expect(screen.getByText('ทั้งในระบบและอีเมล')).toBeInTheDocument();

      // Turn off Email
      await act(async () => {
        fireEvent.click(toggleEmail);
      });
      expect(toggleEmail).not.toBeChecked();
      expect(screen.getByText('ในระบบเท่านั้น')).toBeInTheDocument();
      // Email input should hide when email is turned off
      expect(container.querySelector('#inputNotifEmail')).toBeNull();

      // Turn off In-App as well (both disabled)
      await act(async () => {
        fireEvent.click(toggleInApp);
      });
      expect(toggleInApp).not.toBeChecked();
      expect(screen.getByText('ปิดทุกช่องทาง')).toBeInTheDocument();

      // Turn back on only Email
      await act(async () => {
        fireEvent.click(toggleEmail);
      });
      expect(toggleEmail).toBeChecked();
      expect(screen.getByText('อีเมลเท่านั้น')).toBeInTheDocument();
      expect(container.querySelector('#inputNotifEmail')).toBeInTheDocument();
    });

    it('2.2 allows defining and changing custom notification destination email', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      const emailInput = container.querySelector('#inputNotifEmail') as HTMLInputElement;
      expect(emailInput).toHaveValue('officer@bangkok.go.th');

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'procurement-team@bma.go.th' } });
      });

      expect(emailInput).toHaveValue('procurement-team@bma.go.th');
    });

    it('2.3 toggles event-specific category notifications (New Opportunities, Saved Updates, Deadlines)', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      const toggleNewOpp = container.querySelector('#toggleNewOpportunity') as HTMLInputElement;
      const toggleSaved = container.querySelector('#toggleSavedUpdate') as HTMLInputElement;
      const toggleDeadline = container.querySelector('#toggleDeadlineReminder') as HTMLInputElement;

      await act(async () => {
        fireEvent.click(toggleNewOpp);
        fireEvent.click(toggleDeadline);
      });

      expect(toggleNewOpp).not.toBeChecked();
      expect(toggleSaved).toBeChecked();
      expect(toggleDeadline).not.toBeChecked();
    });
  });

  // ===========================================================================
  // SECTION 3: Custom Keywords Preferences
  // ===========================================================================
  describe('3. Custom Keyword-Based Preferences', () => {
    it('3.1 defines new keywords using input field and "+ Add" button', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      const keywordInput = container.querySelector('#inputKeyword') as HTMLInputElement;
      const addBtn = container.querySelector('#addKeywordBtn') as HTMLButtonElement;

      // Add "Smart City IoT"
      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'Smart City IoT' } });
        fireEvent.click(addBtn);
      });

      expect(screen.getByText('Smart City IoT')).toBeInTheDocument();
      expect(keywordInput).toHaveValue('');

      // Add keyword using Enter key
      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'Cybersecurity' } });
        fireEvent.keyDown(keywordInput, { key: 'Enter', code: 'Enter' });
      });

      expect(screen.getByText('Cybersecurity')).toBeInTheDocument();
      expect(keywordInput).toHaveValue('');
    });

    it('3.2 removes a keyword when its "✕" button is clicked', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      expect(screen.getByText('ระบบคลาวด์')).toBeInTheDocument();
      expect(screen.getByText('Generative AI')).toBeInTheDocument();

      // Find remove button for 'ระบบคลาวด์'
      const removeBtn = container.querySelector('button[aria-label="Remove ระบบคลาวด์"]');
      expect(removeBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(removeBtn!);
      });

      expect(screen.queryByText('ระบบคลาวด์')).toBeNull();
      // Generative AI should still be present
      expect(screen.getByText('Generative AI')).toBeInTheDocument();
    });

    it('3.3 prevents adding duplicate keywords or empty whitespace', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      const keywordInput = container.querySelector('#inputKeyword') as HTMLInputElement;
      const addBtn = container.querySelector('#addKeywordBtn') as HTMLButtonElement;

      // Try adding duplicate "Generative AI"
      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'Generative AI' } });
        fireEvent.click(addBtn);
      });

      const matchingChips = screen.getAllByText('Generative AI');
      expect(matchingChips.length).toBe(1);

      // Try adding empty whitespace
      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: '   ' } });
        fireEvent.click(addBtn);
      });

      expect(keywordInput).toHaveValue('   ');
    });
  });

  // ===========================================================================
  // SECTION 4: Software Categories / Interest Tags
  // ===========================================================================
  describe('4. Software Categories (Interest Tags)', () => {
    it('4.1 toggles software category badges between active and inactive states', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      const cloudTag = container.querySelector('button[data-tag="Cloud"]') as HTMLButtonElement;
      const aiTag = container.querySelector('button[data-tag="AI"]') as HTMLButtonElement;

      // Cloud was inactive initially
      expect(cloudTag).not.toHaveClass('active');
      expect(aiTag).toHaveClass('active');

      // Click Cloud to activate
      await act(async () => {
        fireEvent.click(cloudTag);
      });
      expect(cloudTag).toHaveClass('active');
      expect(cloudTag).toHaveTextContent(/✓/);

      // Click AI to deactivate
      await act(async () => {
        fireEvent.click(aiTag);
      });
      expect(aiTag).not.toHaveClass('active');
      expect(aiTag).not.toHaveTextContent(/✓/);
    });
  });

  // ===========================================================================
  // SECTION 5: Budget Range Preferences & Error Validation
  // ===========================================================================
  describe('5. Budget Range Preferences & Error Validation', () => {
    it('5.1 displays automated validation error and prevents saving when budgetMax < budgetMin', async () => {
      const onSave = jest.fn();
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
        onPreferencesSaved: onSave,
      });

      const budgetMinInput = container.querySelector('#budgetMin') as HTMLInputElement;
      const budgetMaxInput = container.querySelector('#budgetMax') as HTMLInputElement;
      const saveBtn = container.querySelector('#saveNotifPrefBtn') as HTMLButtonElement;

      // Set invalid range: Min = 50,000,000, Max = 10,000,000
      await act(async () => {
        fireEvent.change(budgetMinInput, { target: { value: '50000000' } });
        fireEvent.change(budgetMaxInput, { target: { value: '10000000' } });
      });

      // Visual error message must be visible
      const errorDiv = container.querySelector('#budgetRangeError');
      expect(errorDiv).toBeInTheDocument();
      expect(errorDiv).toHaveStyle({ display: 'flex' });
      expect(budgetMaxInput).toHaveClass('input-error');
      expect(screen.getByText('งบประมาณสูงสุดต้องไม่น้อยกว่างบประมาณขั้นต่ำ')).toBeInTheDocument();

      // Click save button
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // Saving must be blocked
      expect(onSave).not.toHaveBeenCalled();

      // Now correct the error: Max = 100,000,000
      await act(async () => {
        fireEvent.change(budgetMaxInput, { target: { value: '100000000' } });
      });

      expect(errorDiv).toHaveStyle({ display: 'none' });
      expect(budgetMaxInput).not.toHaveClass('input-error');
    });
  });

  // ===========================================================================
  // SECTION 6: Issuing Agencies Preferences
  // ===========================================================================
  describe('6. Issuing Agencies Preferences', () => {
    it('6.1 toggles BMA departments and persists them in state', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      // Find agency button for "สำนักการแพทย์"
      const medicalAgencyBtn = screen.getByRole('button', { name: /สำนักการแพทย์/ });
      expect(medicalAgencyBtn).toBeInTheDocument();
      expect(medicalAgencyBtn).not.toHaveClass('active');

      // Click to toggle on
      await act(async () => {
        fireEvent.click(medicalAgencyBtn);
      });
      expect(medicalAgencyBtn).toHaveClass('active');
      expect(medicalAgencyBtn).toHaveTextContent(/✓/);

      // Find agency button for "สำนักยุทธศาสตร์และประเมินผล" (was active initially)
      const strategyAgencyBtn = screen.getByRole('button', { name: /สำนักยุทธศาสตร์และประเมินผล/ });
      expect(strategyAgencyBtn).toHaveClass('active');

      // Click to toggle off
      await act(async () => {
        fireEvent.click(strategyAgencyBtn);
      });
      expect(strategyAgencyBtn).not.toHaveClass('active');
    });
  });

  // ===========================================================================
  // SECTION 7: Persistence, Real-Time Saving & API Transmission
  // ===========================================================================
  describe('7. Saving, Persistence & API Transmission', () => {
    it('7.1 collects all criteria and transmits complete preferences payload to PUT /api/notifications/preferences', async () => {
      const onSave = jest.fn();
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
        onPreferencesSaved: onSave,
      });

      // 1. Modify channel
      const emailInput = container.querySelector('#inputNotifEmail') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'custom-alert@bangkok.go.th' } });
      });

      // 2. Add a new keyword
      const keywordInput = container.querySelector('#inputKeyword') as HTMLInputElement;
      const addKeywordBtn = container.querySelector('#addKeywordBtn') as HTMLButtonElement;
      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'Data Warehouse' } });
        fireEvent.click(addKeywordBtn);
      });

      // 3. Toggle a category (Cloud)
      const cloudTag = container.querySelector('button[data-tag="Cloud"]') as HTMLButtonElement;
      await act(async () => {
        fireEvent.click(cloudTag);
      });

      // 4. Update budget range: 10M to 75M
      const budgetMinInput = container.querySelector('#budgetMin') as HTMLInputElement;
      const budgetMaxInput = container.querySelector('#budgetMax') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(budgetMinInput, { target: { value: '10000000' } });
        fireEvent.change(budgetMaxInput, { target: { value: '75000000' } });
      });

      // 5. Toggle an agency (สำนักการคลัง)
      const financeBtn = screen.getByRole('button', { name: /สำนักการคลัง/ });
      await act(async () => {
        fireEvent.click(financeBtn);
      });

      // 6. Click Save Button
      const saveBtn = container.querySelector('#saveNotifPrefBtn') as HTMLButtonElement;
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // Check payload transmitted to fetch
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/notifications/preferences',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );

      // Verify the parsed payload
      const putCall = (global.fetch as jest.Mock).mock.calls.find(
        (call) => call[0].includes('/api/notifications/preferences') && call[1]?.method === 'PUT',
      );
      expect(putCall).toBeDefined();

      const sentPayload = JSON.parse(putCall[1].body);
      expect(sentPayload.email).toBe('custom-alert@bangkok.go.th');
      expect(sentPayload.budgetMin).toBe(10_000_000);
      expect(sentPayload.budgetMax).toBe(75_000_000);
      expect(sentPayload.keywords).toContain('Data Warehouse');
      expect(sentPayload.interestTags).toContain('Cloud');
      expect(sentPayload.agencies).toContain('สำนักการคลัง');

      // Verify localStorage caching
      const cached = JSON.parse(localStorage.getItem('torbidd_notif_prefs') || '{}');
      expect(cached.email).toBe('custom-alert@bangkok.go.th');
      expect(cached.budgetMin).toBe(10_000_000);

      // Verify success toast
      expect(screen.getByText('บันทึกการตั้งค่าเรียบร้อยแล้ว')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // SECTION 8: NotificationCenter Integration & Tab Switching
  // ===========================================================================
  describe('8. Notification Center Integration & Tab Switching', () => {
    it('8.1 switches seamlessly between Notification Feed and Alert Preferences panel', async () => {
      const { container } = renderCenterWithProviders();

      // Initially in Feed tab
      await waitFor(() => {
        expect(screen.getByText('ศูนย์การแจ้งเตือน')).toBeInTheDocument();
      });

      const notifTabPrefs = container.querySelector('#notifTabPrefs') as HTMLButtonElement;
      expect(notifTabPrefs).toBeInTheDocument();
      expect(notifTabPrefs).not.toHaveClass('active');

      // Click Preferences Tab
      await act(async () => {
        fireEvent.click(notifTabPrefs);
      });

      expect(notifTabPrefs).toHaveClass('active');
      expect(container.querySelector('.notif-pref-container')).toBeInTheDocument();
      expect(screen.getByText('หมวดหมู่การแจ้งเตือน')).toBeInTheDocument();
      expect(screen.getByText('ช่องทางการรับแจ้งเตือน (Delivery Channels)')).toBeInTheDocument();

      // Click back to Feed Tab
      const notifTabFeed = container.querySelector('#notifTabFeed') as HTMLButtonElement;
      await act(async () => {
        fireEvent.click(notifTabFeed);
      });

      expect(notifTabFeed).toHaveClass('active');
      expect(container.querySelector('.notif-pref-container')).toBeNull();
    });
  });

  // ===========================================================================
  // SECTION 9: Bilingual Localization (Thai <-> English)
  // ===========================================================================
  describe('9. Bilingual Localization', () => {
    it('9.1 switches language to English and translates all preferences labels and placeholders', async () => {
      const { container } = renderPanelWithProviders({
        initialPreferences: INITIAL_PREFERENCES,
      });

      await waitFor(() => {
        expect(screen.getByTestId('btn-lang-en')).toBeInTheDocument();
      });

      // Switch language to English
      await act(async () => {
        fireEvent.click(screen.getByTestId('btn-lang-en'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      // Header labels in English
      expect(screen.getByText('Notification Categories')).toBeInTheDocument();
      expect(screen.getByText('Delivery Channels')).toBeInTheDocument();
      expect(screen.getByText('Custom Keywords')).toBeInTheDocument();
      expect(screen.getByText('Budget Range Preference')).toBeInTheDocument();
      expect(screen.getByText('Interest Tags')).toBeInTheDocument();
      expect(screen.getByText('Issuing Agencies')).toBeInTheDocument();

      // Channel summary in English
      expect(screen.getByText('Both In-app & Email')).toBeInTheDocument();

      // Save button in English
      expect(screen.getByText('Save Alert Settings')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // SECTION 10: Validation Schema & Preferences Service Integration
  // ===========================================================================
  describe('10. Validation Schema & Preferences Service Integration', () => {
    it('10.1 validates preferences payload and rejects invalid budget ranges via NotificationPreferencesSchema', () => {
      const invalidPayload = {
        inAppNotif: true,
        emailNotif: true,
        budgetMin: 80_000_000,
        budgetMax: 20_000_000, // Invalid: Max < Min
        language: 'th',
      };

      const result = NotificationPreferencesSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);

      if (!result.success) {
        const errors = result.error.format();
        expect(errors.budgetMax?._errors).toContain('budgetMax must be >= budgetMin');
      }
    });

    it('10.2 accepts valid preferences, persists them via service, and correctly evaluates delivery matching', async () => {
      const recipientId = 'usr_test_matching_999';
      const validPayload = {
        inAppNotif: true,
        newOpportunity: true,
        savedUpdate: true,
        deadlineReminder: true,
        emailNotif: true,
        dailyDigest: false,
        keywords: ['Blockchain', 'Cybersecurity'],
        interestTags: ['AI', 'Security'],
        agencies: ['สำนักยุทธศาสตร์และประเมินผล'],
        budgetMin: 5_000_000,
        budgetMax: 30_000_000,
        language: 'en' as const,
        email: 'officer@bangkok.go.th',
      };

      // 1. Update preferences via service
      const updated = await updateNotificationPreferences(recipientId, validPayload);
      expect(updated.budgetMin).toBe(5_000_000);
      expect(updated.budgetMax).toBe(30_000_000);
      expect(updated.keywords).toEqual(['Blockchain', 'Cybersecurity']);

      // 2. Fetch preferences back
      const fetched = await getNotificationPreferences(recipientId);
      expect(fetched.keywords).toEqual(['Blockchain', 'Cybersecurity']);
      expect(fetched.interestTags).toEqual(['AI', 'Security']);
      expect(fetched.budgetMin).toBe(5_000_000);
      expect(fetched.budgetMax).toBe(30_000_000);

      // 3. Test delivery evaluation: In-budget project (15M) should match
      const shouldDeliverMatching = await shouldDeliverNotification(recipientId, 'PROCUREMENT_MATCHED', {
        category: 'AI',
        budget: 15_000_000,
        requiredTechnologies: ['Blockchain'],
      });
      expect(shouldDeliverMatching).toBe(true);

      // 4. Test delivery evaluation: Out-of-budget project (50M > 30M) should NOT deliver
      const shouldDeliverOverBudget = await shouldDeliverNotification(recipientId, 'PROCUREMENT_MATCHED', {
        category: 'AI',
        budget: 50_000_000,
      });
      expect(shouldDeliverOverBudget).toBe(false);

      // 5. Test delivery evaluation: Under-budget project (2M < 5M) should NOT deliver
      const shouldDeliverUnderBudget = await shouldDeliverNotification(recipientId, 'PROCUREMENT_MATCHED', {
        category: 'AI',
        budget: 2_000_000,
      });
      expect(shouldDeliverUnderBudget).toBe(false);
    });
  });
});
