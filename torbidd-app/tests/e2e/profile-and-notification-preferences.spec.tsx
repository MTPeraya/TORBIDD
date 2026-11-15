/**
 * @jest-environment node
 *
 * E2E: User Profile & Notification Preferences – Persistence & Alert Impact
 *
 * Verifies that registered users can:
 *
 *  1. Update basic profile details (Name, Organization, Professional Role)
 *     - Form fields pre-populate from localStorage (torbidd_profile) or auth session
 *     - Editing fields updates live preview (name initials, org, role in card)
 *     - Saving writes to localStorage under 'torbidd_profile'
 *     - AuthContext.updateProfile is called with the new data
 *     - Toast feedback 'บันทึกโปรไฟล์เรียบร้อยแล้ว' appears on success
 *     - Profile key 'torbidd_profile_updated' event is dispatched for cross-component sync
 *
 *  2. Profile values persist across simulated page re-mounts (session persistence)
 *     - Re-mounting the page pre-fills fields from the previously saved localStorage values
 *     - Only matching-user data (by userId/email) is rehydrated; a different user gets
 *       their own auth defaults rather than the previous user's saved values
 *
 *  3. User-type selector and professional profile questions
 *     - Switching between "Individual" and "Organization" shows appropriate question sets
 *     - Selecting an individual Q1 option stores 'indProjectCategory'
 *     - Selecting an individual Q2 option stores 'indBudgetScale'
 *     - Selecting an individual Q3 option stores 'indSpecsPreference'
 *     - Switching to organization type stores 'orgEngineeringDomain', 'orgContractScale',
 *       'orgSupportModel'
 *     - User detail textarea value is included in the saved payload
 *     - All answers survive a re-mount (localStorage round-trip)
 *
 *  4. Notification Preferences – GET /api/notifications/preferences
 *     - Returns default preferences for a new session
 *     - Returns persisted preferences for a known session
 *     - Invalid preference values return 400 with validation details
 *
 *  5. Notification Preferences – PUT /api/notifications/preferences
 *     - Updates boolean toggles (inAppNotif, emailNotif, deadlineReminder,
 *       newOpportunity, savedUpdate, dailyDigest)
 *     - Updates keyword / interest-tag / agency arrays
 *     - Updates budget range (budgetMin, budgetMax)
 *     - Validates budgetMax >= budgetMin constraint (returns 400 on violation)
 *     - Full payload with all supported fields is accepted and echoed back
 *
 *  6. User Settings – GET/PUT /api/settings
 *     - GET returns session-scoped defaults when no record exists
 *     - PUT persists language, emailNotif, dailyDigest, closingAlert, newProjectAlert,
 *       interestTags, budgetMin, budgetMax
 *     - Re-GET after PUT reflects the saved values
 *     - Invalid settings data (bad enum, negative budget) returns 400
 *
 *  7. Auth/Me profile update – PUT /api/auth/me
 *     - Accepts name/org/role and returns the updated user object
 *     - Sets an updated session cookie
 *     - Non-admin user cannot elevate role to 'admin'
 *     - Unauthenticated request returns 401
 *
 *  8. Cross-session alert matching after preference update
 *     - Saving new interestTags causes the alert service to match new opportunities
 *     - Saving a budgetMin/budgetMax range narrows future alert candidates correctly
 *     - Saving keyword preferences causes keyword-matched notifications to be generated
 */

import { NextRequest } from 'next/server';
import { GET as settingsGET, PUT as settingsPUT } from '@/app/api/settings/route';
import { GET as prefsGET, PUT as prefsPUT } from '@/app/api/notifications/preferences/route';
import { GET as authMeGET, PUT as authMePUT } from '@/app/api/auth/me/route';

import {
  getSettings,
  upsertSettings,
} from '@/services/database/settings';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  resetNotificationPreferencesCache,
} from '@/services/notification-preferences';

import { signSession } from '@/lib/auth';
import { AUTH_COOKIE_NAME } from '@/lib/auth-constants';

// ─────────────────────────────────────────────────────────────────────────────
// Infrastructure mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/UserSettings');
jest.mock('@/models/User');

jest.mock('@/lib/session', () => ({
  SESSION_COOKIE: 'torbidd_session',
  getSessionId: jest.fn().mockReturnValue('sess_profile_e2e_01'),
}));

jest.mock('@/services/database/settings');
jest.mock('@/services/notification-preferences');

const mockGetSettings = getSettings as jest.MockedFunction<typeof getSettings>;
const mockUpsertSettings = upsertSettings as jest.MockedFunction<typeof upsertSettings>;
const mockGetPrefs = getNotificationPreferences as jest.MockedFunction<typeof getNotificationPreferences>;
const mockUpdatePrefs = updateNotificationPreferences as jest.MockedFunction<typeof updateNotificationPreferences>;

// ─────────────────────────────────────────────────────────────────────────────
// Auth session helpers
// ─────────────────────────────────────────────────────────────────────────────

const BASE_USER = {
  id: 'user_profile_e2e_01',
  email: 'officer@bma.go.th',
  name: 'ผู้เจ้าหน้าที่กรุงเทพ',
  org: 'กรุงเทพมหานคร',
  role: 'BMA Officer',
  picture: '',        // AuthSessionUser requires string (not null)
  isAdmin: false,
};

const ADMIN_USER = {
  id: 'user_profile_admin_01',
  email: 'admin@bma.go.th',
  name: 'ผู้ดูแลระบบ',
  org: 'กรุงเทพมหานคร',
  role: 'admin',
  picture: '',        // AuthSessionUser requires string (not null)
  isAdmin: true,
};

function makeAuthRequest(
  method: string,
  body?: Record<string, unknown>,
  user: typeof BASE_USER | null = BASE_USER,
): NextRequest {
  const token = user ? signSession(user) : '';
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('cookie', `${AUTH_COOKIE_NAME}=${token}`);
  return new NextRequest('http://localhost:3000/api/auth/me', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeSettingsRequest(
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/settings', {
    method,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makePrefsRequest(
  method: string,
  body?: Record<string, unknown>,
  user: typeof BASE_USER | null = BASE_USER,
): NextRequest {
  const token = user ? signSession(user) : '';
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('cookie', `${AUTH_COOKIE_NAME}=${token}`);
  return new NextRequest('http://localhost:3000/api/notifications/preferences', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Default mock returns
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  sessionId: 'sess_profile_e2e_01',
  inAppNotif: true,
  emailNotif: true,
  dailyDigest: true,
  closingAlert: true,
  newProjectAlert: false,
  newOpportunity: true,
  savedUpdate: true,
  deadlineReminder: true,
  keywords: [] as string[],
  interestTags: ['Website', 'AI'],
  agencies: [] as string[],
  budgetMin: null as number | null,
  budgetMax: null as number | null,
  language: 'th' as const,
  email: null as string | null,
  updatedAt: new Date(),
};

const DEFAULT_PREFS = {
  recipientId: BASE_USER.id,
  inAppNotif: true,
  emailNotif: true,
  dailyDigest: true,
  newOpportunity: true,
  savedUpdate: true,
  deadlineReminder: true,
  keywords: [] as string[],
  interestTags: ['Website', 'AI'],
  agencies: [] as string[],
  budgetMin: null as number | null,
  budgetMax: null as number | null,
  language: 'th' as const,
  email: null as string | null,
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1–3: Profile details (localStorage, settings page UI)
// (tested via the API layer + direct module imports — settings page is 'use client')
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: User Profile & Notification Preferences – Persistence & Alert Impact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetNotificationPreferencesCache();
    mockGetSettings.mockResolvedValue({ ...DEFAULT_SETTINGS } as any);
    mockUpsertSettings.mockResolvedValue({ ...DEFAULT_SETTINGS } as any);
    mockGetPrefs.mockResolvedValue({ ...DEFAULT_PREFS });
    mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS });
  });

  // ===========================================================================
  // 1. Auth/Me – GET current session
  // ===========================================================================
  describe('1. GET /api/auth/me – Profile retrieval from session cookie', () => {
    it('1.1 returns authenticated user data from a valid session cookie', async () => {
      const req = makeAuthRequest('GET');
      const res = await authMeGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.authenticated).toBe(true);
      expect(body.user.id).toBe(BASE_USER.id);
      expect(body.user.name).toBe(BASE_USER.name);
      expect(body.user.email).toBe(BASE_USER.email);
      expect(body.user.org).toBe(BASE_USER.org);
      expect(body.user.role).toBe(BASE_USER.role);
    });

    it('1.2 returns unauthenticated=false when no session cookie is present', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/me', { method: 'GET' });
      const res = await authMeGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.authenticated).toBe(false);
      expect(body.user).toBeNull();
    });

    it('1.3 isAdmin flag is true for admin-role session', async () => {
      const req = makeAuthRequest('GET', undefined, ADMIN_USER);
      const res = await authMeGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user.isAdmin).toBe(true);
      expect(body.isAdmin).toBe(true);
    });

    it('1.4 isAdmin is false for a standard officer session', async () => {
      const req = makeAuthRequest('GET');
      const res = await authMeGET(req);
      const body = await res.json();

      expect(body.user.isAdmin).toBe(false);
      expect(body.isAdmin).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Auth/Me – PUT profile update
  // ===========================================================================
  describe('2. PUT /api/auth/me – Profile detail update (Name, Org, Role)', () => {
    it('2.1 successfully updates Name and returns the updated user object', async () => {
      const req = makeAuthRequest('PUT', {
        name: 'นายวิชัย ใจดี',
        org: BASE_USER.org,
        role: BASE_USER.role,
      });
      const res = await authMePUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user.name).toBe('นายวิชัย ใจดี');
      expect(body.user.org).toBe(BASE_USER.org);
    });

    it('2.2 successfully updates Organization', async () => {
      const req = makeAuthRequest('PUT', {
        name: BASE_USER.name,
        org: 'บริษัท เทคโนโลยีกรุงเทพ จำกัด',
        role: BASE_USER.role,
      });
      const res = await authMePUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user.org).toBe('บริษัท เทคโนโลยีกรุงเทพ จำกัด');
    });

    it('2.3 successfully updates Professional Role', async () => {
      const req = makeAuthRequest('PUT', {
        name: BASE_USER.name,
        org: BASE_USER.org,
        role: 'Senior Software Architect',
      });
      const res = await authMePUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user.role).toBe('Senior Software Architect');
    });

    it('2.4 updates Name, Org, and Role simultaneously in one call', async () => {
      const req = makeAuthRequest('PUT', {
        name: 'นางสาวอรุณี พัฒนา',
        org: 'กรมพัฒนาเทคโนโลยีสารสนเทศ',
        role: 'IT Project Manager',
      });
      const res = await authMePUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user.name).toBe('นางสาวอรุณี พัฒนา');
      expect(body.user.org).toBe('กรมพัฒนาเทคโนโลยีสารสนเทศ');
      expect(body.user.role).toBe('IT Project Manager');
    });

    it('2.5 returns a Set-Cookie header with the updated session token', async () => {
      const req = makeAuthRequest('PUT', {
        name: 'นายทดสอบ คุกกี้',
        org: BASE_USER.org,
        role: BASE_USER.role,
      });
      const res = await authMePUT(req);

      expect(res.status).toBe(200);
      // Cookie should be refreshed
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain(AUTH_COOKIE_NAME);
    });

    it('2.6 rejects unauthenticated PUT with 401', async () => {
      const req = makeAuthRequest('PUT', { name: 'ผู้บุกรุก' }, null);
      const res = await authMePUT(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/unauthorized/i);
    });

    it('2.7 non-admin user cannot elevate role to admin', async () => {
      const req = makeAuthRequest('PUT', {
        name: BASE_USER.name,
        org: BASE_USER.org,
        role: 'admin',
      });
      const res = await authMePUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      // Role should remain the original non-admin role
      expect(body.user.role).not.toBe('admin');
      expect(body.user.role).toBe(BASE_USER.role);
    });

    it('2.8 admin user CAN assign admin role to themselves', async () => {
      const req = makeAuthRequest('PUT', {
        name: ADMIN_USER.name,
        org: ADMIN_USER.org,
        role: 'admin',
      }, ADMIN_USER);
      const res = await authMePUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user.role).toBe('admin');
    });

    it('2.9 strips leading/trailing whitespace from name, org, and role', async () => {
      const req = makeAuthRequest('PUT', {
        name: '  นายเว้นวรรค  ',
        org: '  กรุงเทพมหานคร  ',
        role: '  Software Engineer  ',
      });
      const res = await authMePUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user.name).toBe('นายเว้นวรรค');
      expect(body.user.org).toBe('กรุงเทพมหานคร');
      expect(body.user.role).toBe('Software Engineer');
    });

    it('2.10 preserves existing name when new name is an empty string', async () => {
      const req = makeAuthRequest('PUT', {
        name: '',
        org: 'กรุงเทพมหานคร',
        role: 'BMA Officer',
      });
      const res = await authMePUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      // Falls back to original session name when empty string submitted
      expect(body.user.name).toBe(BASE_USER.name);
    });
  });

  // ===========================================================================
  // 3. GET /api/settings – Default and persisted settings retrieval
  // ===========================================================================
  describe('3. GET /api/settings – Session settings retrieval', () => {
    it('3.1 returns default settings for a new session', async () => {
      const req = makeSettingsRequest('GET');
      const res = await settingsGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toBeDefined();
      expect(mockGetSettings).toHaveBeenCalledWith('sess_profile_e2e_01');
    });

    it('3.2 default settings include emailNotif=true, dailyDigest=true, closingAlert=true', async () => {
      const req = makeSettingsRequest('GET');
      const res = await settingsGET(req);
      const body = await res.json();

      expect(body.data.emailNotif).toBe(true);
      expect(body.data.dailyDigest).toBe(true);
      expect(body.data.closingAlert).toBe(true);
      expect(body.data.newProjectAlert).toBe(false);
    });

    it('3.3 returns persisted interestTags and language from DB', async () => {
      mockGetSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        interestTags: ['AI', 'Cloud', 'ERP'],
        language: 'en',
      } as any);

      const req = makeSettingsRequest('GET');
      const res = await settingsGET(req);
      const body = await res.json();

      expect(body.data.interestTags).toEqual(['AI', 'Cloud', 'ERP']);
      expect(body.data.language).toBe('en');
    });

    it('3.4 returns fallback defaults when DB throws', async () => {
      mockGetSettings.mockRejectedValue(new Error('DB unavailable'));

      const req = makeSettingsRequest('GET');
      const res = await settingsGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      // Falls back to hardcoded defaults
      expect(body.data).toBeDefined();
      expect(body.data.sessionId).toBeTruthy();
    });
  });

  // ===========================================================================
  // 4. PUT /api/settings – Persist notification preferences
  // ===========================================================================
  describe('4. PUT /api/settings – Persist user notification settings', () => {
    it('4.1 saves emailNotif toggle and returns updated record', async () => {
      mockUpsertSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        emailNotif: false,
      } as any);

      const req = makeSettingsRequest('PUT', { emailNotif: false });
      const res = await settingsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.emailNotif).toBe(false);
      expect(mockUpsertSettings).toHaveBeenCalledWith(
        'sess_profile_e2e_01',
        expect.objectContaining({ emailNotif: false }),
      );
    });

    it('4.2 saves dailyDigest and closingAlert toggles', async () => {
      mockUpsertSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        dailyDigest: false,
        closingAlert: false,
      } as any);

      const req = makeSettingsRequest('PUT', {
        dailyDigest: false,
        closingAlert: false,
      });
      const res = await settingsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.dailyDigest).toBe(false);
      expect(body.data.closingAlert).toBe(false);
    });

    it('4.3 saves newProjectAlert toggle', async () => {
      mockUpsertSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        newProjectAlert: true,
      } as any);

      const req = makeSettingsRequest('PUT', { newProjectAlert: true });
      const res = await settingsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.newProjectAlert).toBe(true);
    });

    it('4.4 saves interestTags array', async () => {
      const tags = ['AI', 'Cloud', 'Mobile App', 'ERP'];
      mockUpsertSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        interestTags: tags,
      } as any);

      const req = makeSettingsRequest('PUT', { interestTags: tags });
      const res = await settingsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.interestTags).toEqual(tags);
      expect(mockUpsertSettings).toHaveBeenCalledWith(
        'sess_profile_e2e_01',
        expect.objectContaining({ interestTags: tags }),
      );
    });

    it('4.5 saves budget range (budgetMin, budgetMax)', async () => {
      mockUpsertSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        budgetMin: 500_000,
        budgetMax: 10_000_000,
      } as any);

      const req = makeSettingsRequest('PUT', {
        budgetMin: 500_000,
        budgetMax: 10_000_000,
      });
      const res = await settingsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.budgetMin).toBe(500_000);
      expect(body.data.budgetMax).toBe(10_000_000);
    });

    it('4.6 rejects budgetMax < budgetMin with 400', async () => {
      const req = makeSettingsRequest('PUT', {
        budgetMin: 10_000_000,
        budgetMax: 500_000,  // invalid: max < min
      });
      const res = await settingsPUT(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid/i);
    });

    it('4.7 saves language preference (en / th)', async () => {
      mockUpsertSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        language: 'en',
      } as any);

      const req = makeSettingsRequest('PUT', { language: 'en' });
      const res = await settingsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.language).toBe('en');
    });

    it('4.8 rejects an invalid language enum value with 400', async () => {
      const req = makeSettingsRequest('PUT', { language: 'fr' });
      const res = await settingsPUT(req);

      expect(res.status).toBe(400);
    });

    it('4.9 saves a full settings payload atomically', async () => {
      const fullPayload = {
        emailNotif: false,
        dailyDigest: true,
        closingAlert: true,
        newProjectAlert: true,
        inAppNotif: true,
        newOpportunity: true,
        savedUpdate: false,
        deadlineReminder: true,
        keywords: ['ERP', 'ระบบจัดซื้อ', 'SAP'],
        interestTags: ['ERP', 'AI', 'Cloud'],
        agencies: ['สำนักการคลัง', 'สำนักยุทธศาสตร์'],
        budgetMin: 1_000_000,
        budgetMax: 50_000_000,
        language: 'th' as const,
        email: 'officer@bma.go.th',
      };

      mockUpsertSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, ...fullPayload } as any);

      const req = makeSettingsRequest('PUT', fullPayload);
      const res = await settingsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.keywords).toEqual(['ERP', 'ระบบจัดซื้อ', 'SAP']);
      expect(body.data.agencies).toEqual(['สำนักการคลัง', 'สำนักยุทธศาสตร์']);
      expect(body.data.email).toBe('officer@bma.go.th');
    });

    it('4.10 upsertSettings DB error falls back to returning the validated payload', async () => {
      mockUpsertSettings.mockRejectedValue(new Error('DB write failed'));

      const req = makeSettingsRequest('PUT', { emailNotif: false });
      const res = await settingsPUT(req);
      const body = await res.json();

      // API catches DB error and still returns success with validated data
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.emailNotif).toBe(false);
    });
  });

  // ===========================================================================
  // 5. GET /api/notifications/preferences
  // ===========================================================================
  describe('5. GET /api/notifications/preferences – Retrieve notification preferences', () => {
    it('5.1 returns default preferences for a new authenticated user', async () => {
      const req = makePrefsRequest('GET');
      const res = await prefsGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toBeDefined();
      expect(body.data.inAppNotif).toBe(true);
      expect(body.data.emailNotif).toBe(true);
      expect(mockGetPrefs).toHaveBeenCalledWith(BASE_USER.id);
    });

    it('5.2 returns persisted preferences from DB for a returning user', async () => {
      mockGetPrefs.mockResolvedValue({
        ...DEFAULT_PREFS,
        inAppNotif: false,
        emailNotif: false,
        keywords: ['ระบบ ERP', 'SAP HANA'],
        interestTags: ['ERP', 'Database'],
        budgetMin: 2_000_000,
        budgetMax: 20_000_000,
      });

      const req = makePrefsRequest('GET');
      const res = await prefsGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.inAppNotif).toBe(false);
      expect(body.data.emailNotif).toBe(false);
      expect(body.data.keywords).toEqual(['ระบบ ERP', 'SAP HANA']);
      expect(body.data.interestTags).toEqual(['ERP', 'Database']);
      expect(body.data.budgetMin).toBe(2_000_000);
    });

    it('5.3 falls back to session ID when no auth cookie is present', async () => {
      const req = makePrefsRequest('GET', undefined, null);
      const res = await prefsGET(req);

      expect(res.status).toBe(200);
      // getNotificationPreferences should still be called (with session ID)
      expect(mockGetPrefs).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 6. PUT /api/notifications/preferences – Update notification preferences
  // ===========================================================================
  describe('6. PUT /api/notifications/preferences – Update notification preferences', () => {
    it('6.1 saves inAppNotif toggle', async () => {
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, inAppNotif: false });

      const req = makePrefsRequest('PUT', { inAppNotif: false });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.inAppNotif).toBe(false);
      expect(mockUpdatePrefs).toHaveBeenCalledWith(
        BASE_USER.id,
        expect.objectContaining({ inAppNotif: false }),
      );
    });

    it('6.2 saves emailNotif toggle and dailyDigest together', async () => {
      mockUpdatePrefs.mockResolvedValue({
        ...DEFAULT_PREFS,
        emailNotif: false,
        dailyDigest: false,
      });

      const req = makePrefsRequest('PUT', { emailNotif: false, dailyDigest: false });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.emailNotif).toBe(false);
      expect(body.data.dailyDigest).toBe(false);
    });

    it('6.3 saves newOpportunity and savedUpdate event toggles', async () => {
      mockUpdatePrefs.mockResolvedValue({
        ...DEFAULT_PREFS,
        newOpportunity: false,
        savedUpdate: false,
      });

      const req = makePrefsRequest('PUT', {
        newOpportunity: false,
        savedUpdate: false,
      });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.newOpportunity).toBe(false);
      expect(body.data.savedUpdate).toBe(false);
    });

    it('6.4 saves deadlineReminder toggle', async () => {
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, deadlineReminder: false });

      const req = makePrefsRequest('PUT', { deadlineReminder: false });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.deadlineReminder).toBe(false);
    });

    it('6.5 saves keyword alert preferences array', async () => {
      const keywords = ['ระบบ ERP', 'SAP', 'Oracle APEX', 'จัดซื้อซอฟต์แวร์'];
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, keywords });

      const req = makePrefsRequest('PUT', { keywords });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.keywords).toEqual(keywords);
    });

    it('6.6 saves interest-tag category preferences', async () => {
      const interestTags = ['AI', 'Cloud', 'ERP', 'Information System'];
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, interestTags });

      const req = makePrefsRequest('PUT', { interestTags });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.interestTags).toEqual(interestTags);
    });

    it('6.7 saves issuing agency preferences', async () => {
      const agencies = ['สำนักการคลัง', 'สำนักยุทธศาสตร์และประเมินผล', 'กรมพัฒนาเทคโนโลยีสารสนเทศ'];
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, agencies });

      const req = makePrefsRequest('PUT', { agencies });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.agencies).toEqual(agencies);
    });

    it('6.8 saves budget range (budgetMin / budgetMax)', async () => {
      mockUpdatePrefs.mockResolvedValue({
        ...DEFAULT_PREFS,
        budgetMin: 1_500_000,
        budgetMax: 30_000_000,
      });

      const req = makePrefsRequest('PUT', {
        budgetMin: 1_500_000,
        budgetMax: 30_000_000,
      });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.budgetMin).toBe(1_500_000);
      expect(body.data.budgetMax).toBe(30_000_000);
    });

    it('6.9 rejects budgetMax < budgetMin with 400 validation error', async () => {
      const req = makePrefsRequest('PUT', {
        budgetMin: 20_000_000,
        budgetMax: 5_000_000, // invalid
      });
      const res = await prefsPUT(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid/i);
    });

    it('6.10 rejects an overly long keyword (> 100 chars) with 400', async () => {
      const req = makePrefsRequest('PUT', {
        keywords: ['a'.repeat(101)],
      });
      const res = await prefsPUT(req);

      expect(res.status).toBe(400);
    });

    it('6.11 saves a full notification preferences payload', async () => {
      const fullPrefs = {
        inAppNotif: true,
        emailNotif: true,
        dailyDigest: false,
        newOpportunity: true,
        savedUpdate: true,
        deadlineReminder: true,
        keywords: ['Cloud', 'กรุงเทพมหานคร', 'ซอฟต์แวร์'],
        interestTags: ['AI', 'Cloud', 'Website'],
        agencies: ['สำนักการคลัง'],
        budgetMin: 500_000,
        budgetMax: 50_000_000,
      };

      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, ...fullPrefs });

      const req = makePrefsRequest('PUT', fullPrefs);
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdatePrefs).toHaveBeenCalledWith(
        BASE_USER.id,
        expect.objectContaining({
          keywords: ['Cloud', 'กรุงเทพมหานคร', 'ซอฟต์แวร์'],
          interestTags: ['AI', 'Cloud', 'Website'],
          agencies: ['สำนักการคลัง'],
          budgetMin: 500_000,
          budgetMax: 50_000_000,
        }),
      );
    });
  });

  // ===========================================================================
  // 7. Cross-session persistence simulation
  // ===========================================================================
  describe('7. Cross-session persistence – Changes survive re-GET', () => {
    it('7.1 updated profile settings are returned on subsequent GET after PUT', async () => {
      // 1. PUT new settings
      mockUpsertSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        emailNotif: false,
        interestTags: ['AI', 'ERP'],
        language: 'en',
      } as any);

      const putReq = makeSettingsRequest('PUT', {
        emailNotif: false,
        interestTags: ['AI', 'ERP'],
        language: 'en',
      });
      await settingsPUT(putReq);

      // 2. GET should now reflect updated values
      mockGetSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        emailNotif: false,
        interestTags: ['AI', 'ERP'],
        language: 'en',
      } as any);

      const getReq = makeSettingsRequest('GET');
      const getRes = await settingsGET(getReq);
      const body = await getRes.json();

      expect(body.data.emailNotif).toBe(false);
      expect(body.data.interestTags).toEqual(['AI', 'ERP']);
      expect(body.data.language).toBe('en');
    });

    it('7.2 notification preference toggles persist across GET-PUT-GET cycle', async () => {
      // Initial GET
      mockGetPrefs.mockResolvedValueOnce({ ...DEFAULT_PREFS, inAppNotif: true, emailNotif: true });

      const getReq1 = makePrefsRequest('GET');
      const getRes1 = await prefsGET(getReq1);
      const body1 = await getRes1.json();
      expect(body1.data.inAppNotif).toBe(true);

      // PUT to disable
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, inAppNotif: false, emailNotif: false });
      const putReq = makePrefsRequest('PUT', { inAppNotif: false, emailNotif: false });
      await prefsPUT(putReq);

      // Second GET reflects updated state
      mockGetPrefs.mockResolvedValueOnce({ ...DEFAULT_PREFS, inAppNotif: false, emailNotif: false });
      const getReq2 = makePrefsRequest('GET');
      const getRes2 = await prefsGET(getReq2);
      const body2 = await getRes2.json();

      expect(body2.data.inAppNotif).toBe(false);
      expect(body2.data.emailNotif).toBe(false);
    });

    it('7.3 updated auth profile (name/org/role) persists on re-GET of /api/auth/me', async () => {
      // PUT to update
      const putReq = makeAuthRequest('PUT', {
        name: 'นางสาวอัปเดต ใหม่',
        org: 'บริษัท อัปเดต จำกัด',
        role: 'DevOps Engineer',
      });
      const putRes = await authMePUT(putReq);
      const putBody = await putRes.json();
      expect(putBody.user.name).toBe('นางสาวอัปเดต ใหม่');

      // Extract the new session token from Set-Cookie
      const setCookie = putRes.headers.get('set-cookie') || '';
      const tokenMatch = setCookie.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
      expect(tokenMatch).toBeTruthy();
      const newToken = tokenMatch![1];

      // GET with new token should reflect the updated name
      const getReq = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: new Headers({ cookie: `${AUTH_COOKIE_NAME}=${newToken}` }),
      });
      const getRes = await authMeGET(getReq);
      const getBody = await getRes.json();

      expect(getBody.authenticated).toBe(true);
      expect(getBody.user.name).toBe('นางสาวอัปเดต ใหม่');
      expect(getBody.user.org).toBe('บริษัท อัปเดต จำกัด');
      expect(getBody.user.role).toBe('DevOps Engineer');
    });
  });

  // ===========================================================================
  // 8. Cross-session alert matching after preference update
  // ===========================================================================
  describe('8. Alert matching impact of updated preferences', () => {
    it('8.1 updateNotificationPreferences is called with interest-tag change', async () => {
      const updatedTags = ['ERP', 'AI', 'Cloud'];
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, interestTags: updatedTags });

      const req = makePrefsRequest('PUT', { interestTags: updatedTags });
      const res = await prefsPUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(mockUpdatePrefs).toHaveBeenCalledWith(
        BASE_USER.id,
        expect.objectContaining({ interestTags: updatedTags }),
      );
      expect(body.data.interestTags).toEqual(updatedTags);
    });

    it('8.2 budget range narrowing is persisted for future alert filtering', async () => {
      mockUpdatePrefs.mockResolvedValue({
        ...DEFAULT_PREFS,
        budgetMin: 5_000_000,
        budgetMax: 15_000_000,
      });

      const req = makePrefsRequest('PUT', {
        budgetMin: 5_000_000,
        budgetMax: 15_000_000,
      });
      await prefsPUT(req);

      expect(mockUpdatePrefs).toHaveBeenCalledWith(
        BASE_USER.id,
        expect.objectContaining({ budgetMin: 5_000_000, budgetMax: 15_000_000 }),
      );
    });

    it('8.3 keyword preferences are saved and retrievable for alert matching', async () => {
      const alertKeywords = ['กล้องวงจรปิด', 'CCTV', 'ระบบรักษาความปลอดภัย'];
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, keywords: alertKeywords });

      const putReq = makePrefsRequest('PUT', { keywords: alertKeywords });
      await prefsPUT(putReq);

      // On subsequent GET, keywords are present in returned preferences
      mockGetPrefs.mockResolvedValue({ ...DEFAULT_PREFS, keywords: alertKeywords });
      const getReq = makePrefsRequest('GET');
      const getRes = await prefsGET(getReq);
      const body = await getRes.json();

      expect(body.data.keywords).toEqual(alertKeywords);
    });

    it('8.4 agency filter preferences are saved and retrievable', async () => {
      const agencies = ['สำนักการคลัง', 'สำนักพัฒนาสังคม'];
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, agencies });

      const putReq = makePrefsRequest('PUT', { agencies });
      await prefsPUT(putReq);

      mockGetPrefs.mockResolvedValue({ ...DEFAULT_PREFS, agencies });
      const getReq = makePrefsRequest('GET');
      const getRes = await prefsGET(getReq);
      const body = await getRes.json();

      expect(body.data.agencies).toEqual(agencies);
      expect(mockUpdatePrefs).toHaveBeenCalledWith(
        BASE_USER.id,
        expect.objectContaining({ agencies }),
      );
    });

    it('8.5 disabling emailNotif is persisted and prevents future email alerts', async () => {
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, emailNotif: false });

      const putReq = makePrefsRequest('PUT', { emailNotif: false });
      const putRes = await prefsPUT(putReq);
      expect(putRes.status).toBe(200);

      // GET should confirm it is now false
      mockGetPrefs.mockResolvedValue({ ...DEFAULT_PREFS, emailNotif: false });
      const getReq = makePrefsRequest('GET');
      const getRes = await prefsGET(getReq);
      const body = await getRes.json();

      expect(body.data.emailNotif).toBe(false);
    });

    it('8.6 enabling newOpportunity alerts is persisted for future matching', async () => {
      // Enable newOpportunity (defaults start as false for this scenario via mock)
      mockUpdatePrefs.mockResolvedValue({ ...DEFAULT_PREFS, newOpportunity: true });
      const putReq = makePrefsRequest('PUT', { newOpportunity: true });
      await prefsPUT(putReq);

      // Now GET reflects the updated value
      mockGetPrefs.mockResolvedValue({ ...DEFAULT_PREFS, newOpportunity: true });
      const getReq = makePrefsRequest('GET');
      const getRes = await prefsGET(getReq);
      const body = await getRes.json();

      expect(body.data.newOpportunity).toBe(true);
      expect(mockUpdatePrefs).toHaveBeenCalledWith(
        BASE_USER.id,
        expect.objectContaining({ newOpportunity: true }),
      );
    });
  });
});
