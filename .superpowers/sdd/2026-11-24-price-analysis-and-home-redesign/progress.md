# SDD ledger — plan: /Users/pasintongtip/Third_year/CSP/TORBIDD/docs/superpowers/plans/2026-11-24-price-analysis-and-home-redesign.md

Pre-flight: no shared interface conflicts between tasks.

Task 1: complete (labels-redesign.test.ts PASS)
Task 2: complete (Home page live filter, ProjectCarousel, HomeWorkflowSection tests PASS)
Task 3: complete (Price Analysis page redesigned into Executive Studio, all historical tests PASS)

## Task 4: Complete — All Review Findings Fixed (2026-11-24)

### Review fixes applied
- **Fix 1 — KPI badge pill localization**: Replaced 4 hardcoded English strings (`Total Spend`, `Mean Benchmark`, `Max Award 👁️`, `±30% Corridor`) in `historical/page.tsx` with `L('kpiPillTotalSpend')`, `L('kpiPillMeanBenchmark')`, `L('kpiPillMaxAward')`, `L('kpiPillCorridor')` calls
- **Fix 2 — KPI modal Escape key + ARIA**: Added `useEffect` Escape key listener; added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="kpi-modal-title"` to modal container; added `id="kpi-modal-title"` to modal `<h3>`; added `aria-label="Close modal"` to close button
- **Fix 3 — Explorer table row keyboard accessibility**: Added `onKeyDown` handler (Enter/Space), `tabIndex={0}`, `role="button"`, `aria-expanded={isExpanded}` to `<tr>` elements in explorer table
- **Fix 4 — `--gray-800` CSS token + dark mode contrast**:
  - Declared `--gray-800: #334155` in `:root` block of `globals.css`
  - Declared `--gray-800: #e2e8f0` in `body.dark-mode` block of `globals.css`
  - Appended dark mode overrides for `.btn-close-modal` and `.modal-close-btn` with sky-400 (#38bdf8) on dark glass background

### Verification results
- **27/27 tests pass** across 5 suites (labels-redesign, HomeFilterLogic, ProjectCarousel, HistoricalComponents, historicalAnalytics)
- **`tsc --noEmit`**: 0 errors
- Build failure (pre-existing `bmaBaseUrl` HTTPS env-var Zod error) is unrelated to this feature

### Status: READY TO MERGE
