Issue: [#371](https://github.com/users/MTPeraya/projects/2/views/1?filterQuery=Browser-Level+End-to-End+User+Flow+Verification&pane=issue&itemId=286028824&issue=MTPeraya%7CTORBIDD%7C371)

### Use Case
**UC-TEST-03: Browser-Level End-to-End User Flow Verification**

#### Description
The system shall provide automated end-to-end (E2E) browser tests that simulate real user interactions in a headless browser (Chromium, Firefox, WebKit).  
The E2E tests shall validate complete user journeys across the TORBIDD application: exploring and filtering procurement opportunities, viewing detailed TOR qualification requirements, saving opportunities to personal bookmarks, configuring notification preferences, and performing administrative classification overrides.

#### Actors
- **Quality Assurance Engineer / Full-Stack Developer**
- **Automated Browser Automation Engine (Playwright / Cypress)**
- **Test Server Instance (Next.js Standalone Build)**

#### Preconditions
- The Next.js web application is built and running (`npm run build && npm run start`).
- Seed or fixture data is loaded into the test database instance (`npm run seed`).
- Headless browser binaries (Playwright) are installed on the test runner.

#### Main Flow
1. The test runner launches headless Chromium and navigates to the application URL (`http://localhost:3000`).
2. **Journey 1 (Search & Filter):** The test types keyword `"ระบบสารสนเทศ"` into the search input, selects filter tags (`Website`, `AI`), sets the budget slider, and verifies that the opportunity list updates dynamically.
3. **Journey 2 (Detail & TOR Inspection):** The test clicks on an opportunity card, navigates to `/opportunities/[id]`, verifies that AI-classified tags and budget metrics render, and opens the "TOR Qualification Criteria" modal.
4. **Journey 3 (Bookmark & Saved Opportunities):** The test clicks the "Save/Bookmark" button on an opportunity, navigates to `/saved`, and confirms the saved item appears in real time.
5. **Journey 4 (Notification Preferences):** The test navigates to `/notifications/preferences`, toggles email and in-app alerts, updates category subscriptions, clicks "Save", and verifies confirmation toast displays.
6. **Journey 5 (Admin Console):** The test logs in as an administrator, visits `/admin`, switches to the "Classification Review" tab, corrects a project category to `Cloud`, and verifies the review status changes to `CORRECTED`.
7. The browser closes, and Playwright generates an HTML test report and video/trace artifacts on failure.

#### Alternative / Exception Flows
**A1. Network Failure / Error State Verification**
1. The test simulates an offline or failed API response using browser network route interception (`page.route('/api/**', route => route.abort())`).
2. The test verifies that user-friendly error banners and retry buttons are presented without page crashes.

**A2. Responsive Viewport Testing**
1. The test sets the viewport to mobile resolution ($375 \times 667$).
2. The test verifies that the collapsible navigation drawer, hamburger button, and mobile card layouts function properly.

#### Postconditions
- All critical business paths from frontend UI to database storage are proven functional in real browser engines.
- Test artifacts (screenshots, video recordings, trace files) are stored for debugging failing flows.

#### Acceptance Criteria
- [ ] Playwright test suite is configured with `playwright.config.ts` supporting Desktop and Mobile viewports.
- [ ] E2E tests cover Opportunity Search and Filter interactions.
- [ ] E2E tests cover Opportunity Detail View, clause inspection, and PDF links.
- [ ] E2E tests cover Bookmarking / Saved Opportunities real-time synchronization.
- [ ] E2E tests cover Notification Preferences configuration.
- [ ] E2E tests cover Admin Classification Review and manual override flows.
- [ ] E2E tests run headlessly in CI and capture trace screenshots upon failure.

#### Subtasks & Status (End-to-End Testing)

| Subtask | Scope | Status | Est. Time |
|---|---|:---:|:---:|
| 1. Playwright Setup & Environment Configuration | Install `@playwright/test`, create `playwright.config.ts`, add test scripts | **Todo** | 2 hrs |
| 2. Opportunity Discovery & Filter E2E Tests | Tests for keyword search, multi-category pills, agency dropdown, and budget filters | **Todo** | 3 hrs |
| 3. Opportunity Detail & Qualification Modal Tests | Tests for detail page rendering, TOR clause modal, and requirement checklist | **Todo** | 2.5 hrs |
| 4. User Bookmark & Notification Preferences Tests | Tests for bookmark toggling, `/saved` page updates, and preference forms | **Todo** | 3 hrs |
| 5. Admin Console & Classification Review Tests | Tests for admin login, classification review queue, category correction modal | **Todo** | 3.5 hrs |
| 6. CI/CD Integration for Headless E2E Execution | Add Playwright CI job to `.github/workflows/ci.yml` with artifact uploads | **Todo** | 2 hrs |

**Total Estimated Time:** 16 hours

#### Technical Details & Commands (End-to-End Testing)

To implement this job, any developer can follow these step-by-step instructions:

1. **Install Playwright:**
   ```bash
   cd torbidd-app
   npm install -D @playwright/test
   npx playwright install --with-deps chromium
   ```

2. **Add Playwright Config (`torbidd-app/playwright.config.ts`):**
   ```typescript
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './e2e',
     fullyParallel: true,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: 'html',
     use: {
       baseURL: process.env.BASE_URL || 'http://localhost:3000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure',
     },
     webServer: {
       command: 'npm run start',
       url: 'http://localhost:3000',
       reuseExistingServer: !process.env.CI,
     },
     projects: [
       { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
       { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
     ],
   });
   ```

3. **Sample E2E Test (`torbidd-app/e2e/opportunity-search.spec.ts`):**
   ```typescript
   import { test, expect } from '@playwright/test';

   test.describe('Procurement Opportunity Search & Filter', () => {
     test('user can search opportunities and filter by category', async ({ page }) => {
       await page.goto('/');

       // Verify homepage loads
       await expect(page).toHaveTitle(/TORBIDD/i);

       // Search by keyword
       const searchInput = page.getByPlaceholder(/ค้นหาโอกาสจัดซื้อ|search opportunities/i);
       await searchInput.fill('คอมพิวเตอร์');
       await page.keyboard.press('Enter');

       // Click category filter pill
       const aiCategoryBtn = page.getByRole('button', { name: /^AI$/i });
       if (await aiCategoryBtn.isVisible()) {
         await aiCategoryBtn.click();
       }

       // Verify cards are filtered
       const cards = page.locator('article, [data-testid="opportunity-card"]');
       await expect(cards.first()).toBeVisible();
     });
   });
   ```

4. **Execution Command:**
   ```bash
   # Run all E2E tests headlessly
   npx playwright test

   # Run with visual UI mode for debugging
   npx playwright test --ui
   ```