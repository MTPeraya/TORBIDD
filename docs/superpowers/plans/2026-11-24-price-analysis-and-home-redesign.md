# Price Analysis Page Redesign & Home Page Bottom Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Price Analysis page (`/historical`) into an executive-grade analytics studio and upgrade the Home page (`/`) section below core capabilities with interactive live tender filtering, a 3-step workflow journey, and a refined affiliation footer.

**Architecture:** 
- Modular React 19 / Next.js 15 client components integrated into TORBIDD's existing page routes (`/app/page.tsx` and `/app/historical/page.tsx`).
- Bilingual dictionary entries registered in `torbidd-app/src/lib/labels.ts`.
- High-contrast, token-based design styling added to `torbidd-app/src/app/globals.css` adhering strictly to `--primary-900: #164566`, `--primary-600: #2773a5`, `--primary-50: #e7f1f7`, and semantic accents.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Jest, React Testing Library, CSS custom properties.

**Spec:** [docs/superpowers/specs/2026-11-24-price-analysis-and-home-redesign.md](file:///Users/pasintongtip/Third_year/CSP/TORBIDD/docs/superpowers/specs/2026-11-24-price-analysis-and-home-redesign.md)

## Global Constraints

- Must retain primary brand color palette: `--primary-900: #164566`, `--primary-700: #21658f`, `--primary-600: #2773a5`, `--primary-50: #e7f1f7`.
- Outlier analytics must strictly use ±30% and Tukey 1.5 × IQR (`utils.ts` and `historicalAnalytics.ts`) to avoid KPI regressions.
- Must preserve all test IDs and selectors used by `HistoricalComponents.test.tsx`, `ProjectCarousel.test.tsx`, and E2E specs.
- Full bilingual support (Thai and English) with zero hardcoded plain-text English/Thai strings in JSX.

## Review Focus

1. **Empty / Sparse Project States in Carousel**: When a filter tab (e.g., `aiData` or `highValue`) matches 0 or fewer than 2 projects, the Home carousel and CTA button must handle this gracefully without dividing by zero or throwing runtime bounds errors.
2. **Carousel Pagination Cap**: Filtered project arrays passed to `ProjectCarousel` must be capped at `slice(0, 8)` to prevent ballooning pagination dots while the CTA button carries the full count.
3. **URL Search Parameter Encoding**: CTA navigation links from the Home page must encode parameters that match `/opportunities` validation (`categories=AI,Data%20Analytics`, `deadline=within7&sortBy=deadline_asc`, `minBudget=10000000&sortBy=budget_desc`).
4. **Historical KPI Modal Accessibility**: The highest tender KPI card click modal must remain fully navigable via keyboard (`Enter`, `Space`, `Escape`).
5. **Theme Switching (Light & Dark Mode)**: All new backgrounds, borders, pills, badges, and workflow cards must have high-contrast styling in both `body` default and `body.dark-mode`.

---

### Task 1: Bilingual Labels Registration for Home & Price Analysis

**Files:**
- Modify: `torbidd-app/src/lib/labels.ts`
- Test: `torbidd-app/src/lib/__tests__/labels.test.ts` (or direct verification in test suite)

**Interfaces:**
- Produces: Dictionary keys in `LABEL_DICTIONARY.th` and `LABEL_DICTIONARY.en`:
  - `liveShowcaseTitle`, `liveShowcaseSubtitle`
  - `tabFilterAll`, `tabFilterClosingSoon`, `tabFilterHighValue`, `tabFilterAiData`
  - `viewAllOpportunitiesBtn`
  - `workflowTitle`, `workflowSubtitle`
  - `workflowStep1Num`, `workflowStep1Title`, `workflowStep1Desc`
  - `workflowStep2Num`, `workflowStep2Title`, `workflowStep2Desc`
  - `workflowStep3Num`, `workflowStep3Title`, `workflowStep3Desc`
  - `histLastUpdatedBadge`, `histGuidanceReasonable`, `histGuidanceHigh`, `histGuidanceLow`

- [ ] **Step 1: Write test verifying dictionary keys exist in both Thai and English**
```typescript
// torbidd-app/src/lib/__tests__/labels-redesign.test.ts
import { LABEL_DICTIONARY } from '../labels';

describe('Redesign Labels Dictionary', () => {
  const requiredKeys = [
    'liveShowcaseTitle',
    'liveShowcaseSubtitle',
    'tabFilterAll',
    'tabFilterClosingSoon',
    'tabFilterHighValue',
    'tabFilterAiData',
    'viewAllOpportunitiesBtn',
    'workflowTitle',
    'workflowSubtitle',
    'workflowStep1Title',
    'workflowStep2Title',
    'workflowStep3Title',
    'histLastUpdatedBadge',
  ];

  it('contains all required keys in both TH and EN', () => {
    requiredKeys.forEach((key) => {
      expect((LABEL_DICTIONARY.th as any)[key]).toBeDefined();
      expect((LABEL_DICTIONARY.en as any)[key]).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `npm --prefix torbidd-app test -- --runInBand torbidd-app/src/lib/__tests__/labels-redesign.test.ts`
Expected: FAIL (missing dictionary keys).

- [ ] **Step 3: Add new labels to `torbidd-app/src/lib/labels.ts`**
Add the bilingual translations to both `th` and `en` blocks in `LABEL_DICTIONARY`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix torbidd-app test -- --runInBand torbidd-app/src/lib/__tests__/labels-redesign.test.ts`
Expected: PASS.

---

### Task 2: Home Page Section Redesign (Live Showcase, Workflow Journey & Footer)

**Files:**
- Create: `torbidd-app/src/components/home/HomeWorkflowSection.tsx`
- Modify: `torbidd-app/src/app/page.tsx`
- Modify: `torbidd-app/src/app/globals.css`
- Test: `torbidd-app/src/components/ui/__tests__/ProjectCarousel.test.tsx`

**Interfaces:**
- Consumes: `Project` from `@/types/project`, `useLanguage`, `ICONS` from `@/components/ui/Icons`.
- Produces: Upgraded `home-bottom-section` containing:
  - Interactive filter tab bar (`all`, `closingSoon`, `highValue`, `aiData`) with dynamic counts.
  - Dynamic CTA button with query params and formatted budget total.
  - `ProjectCarousel` displaying `filteredProjects.slice(0, 8)`.
  - `<HomeWorkflowSection />` with 3 sequential process cards.
  - Polished responsive footer.

- [ ] **Step 1: Create unit test for Home Page tender filtering logic**
```typescript
// torbidd-app/src/components/home/__tests__/HomeFilterLogic.test.ts
import { Project } from '@/types/project';

// Test filter helper functions: closingSoon, highValue, aiData
```

- [ ] **Step 2: Run test to verify failure**
Run: `npm --prefix torbidd-app test -- --runInBand torbidd-app/src/components/home/__tests__/HomeFilterLogic.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `HomeWorkflowSection.tsx` and update `torbidd-app/src/app/page.tsx`**
- Implement `HomeWorkflowSection.tsx` featuring the 3-step workflow (Smart Ingestion, AI TOR Analysis, Fair Price Benchmarking).
- In `torbidd-app/src/app/page.tsx`, implement filter state (`all`, `closingSoon`, `highValue`, `aiData`), count calculations, slice(0, 8), and dynamic CTA button.
- Add matching responsive styling in `torbidd-app/src/app/globals.css`.

- [ ] **Step 4: Run component & carousel tests to verify they pass**
Run: `npm --prefix torbidd-app test -- --runInBand torbidd-app/src/components/ui/__tests__/ProjectCarousel.test.tsx torbidd-app/src/components/home/__tests__/HomeFilterLogic.test.ts`
Expected: PASS.

---

### Task 3: Price Analysis Page Redesign (`/historical`)

**Files:**
- Modify: `torbidd-app/src/app/historical/page.tsx`
- Modify: `torbidd-app/src/components/historical/BudgetReasonablenessChecker.tsx`
- Modify: `torbidd-app/src/components/historical/SimilarProcurementEstimator.tsx`
- Modify: `torbidd-app/src/components/charts/HistoricalCharts.tsx`
- Modify: `torbidd-app/src/app/globals.css`
- Test: `torbidd-app/src/components/historical/__tests__/HistoricalComponents.test.tsx`

**Interfaces:**
- Consumes: `HistoricalProject`, `Project`, `useLanguage`, `useAuth`, `ICONS`.
- Produces:
  - Executive KPI Strip with 4 elevated monitors (Total Spend, Avg Size, Highest Tender with modal, Outlier Rate with corridor indicators).
  - High-clarity Segmented Tab Bar with icons and count badges.
  - Polished Reasonableness Checker with visual indicator corridors, canonical status badges (`statusReasonable`, `statusHighOutlier`, `statusLowOutlier`), and guidance chips.
  - Enhanced Data Explorer with responsive search toolbar, CSV export, and rich expandable row drawers.

- [ ] **Step 1: Check existing test assertions in `HistoricalComponents.test.tsx`**
Ensure tests targeting ReasonablenessChecker and SimilarEstimator are preserved:
`npm --prefix torbidd-app test -- --runInBand torbidd-app/src/components/historical/__tests__/HistoricalComponents.test.tsx`

- [ ] **Step 2: Update `torbidd-app/src/app/historical/page.tsx` with Executive Studio Layout**
- Refine KPI cards with trend/count badges and last updated indicator.
- Implement segmented tab control with icons and badges.
- Elevate table explorer with clear status badges, search input, and expandable detail drawer.

- [ ] **Step 3: Update `BudgetReasonablenessChecker.tsx` & `SimilarProcurementEstimator.tsx`**
- Maintain exact test-matching status badges (`High Outlier`, `Low Outlier`, `Reasonable`).
- Add rich guidance chips and modern corridor visual meters.

- [ ] **Step 4: Add CSS tokens & styles in `torbidd-app/src/app/globals.css`**
- Add light & dark mode styles for `.historical-kpi-grid`, `.historical-segmented-tabs`, `.hist-studio-card`, `.hist-guidance-chip`, etc.

- [ ] **Step 5: Run historical component tests to verify pass**
Run: `npm --prefix torbidd-app test -- --runInBand torbidd-app/src/components/historical/__tests__/HistoricalComponents.test.tsx`
Expected: PASS with 100% tests passing.

---

### Task 4: End-to-End Regression & Visual Verification

**Files:**
- All modified files
- Verification: Run Jest test suite across touched components and build verification

- [ ] **Step 1: Run comprehensive test suite**
Run: `npm --prefix torbidd-app test -- --runInBand torbidd-app/src/components/historical/__tests__/HistoricalComponents.test.tsx torbidd-app/src/components/ui/__tests__/ProjectCarousel.test.tsx torbidd-app/src/lib/__tests__/historicalAnalytics.test.ts`
Expected: All suites PASS.

- [ ] **Step 2: Build verification**
Run: `npm --prefix torbidd-app run build`
Expected: Successful Next.js production build with no TypeScript or linting errors.
