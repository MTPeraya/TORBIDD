# Design Document: TORBIDD Price Analysis Page Redesign & Home Page Bottom Section Improvement

**Date**: 2026-11-24  
**Author**: Antigravity  
**Topic**: Price Analysis (`/historical`) and Home Page (`/`) Section Below Core Capability  
**Approach Selected**: Approach 1 (Executive Analytics Studio & Narrative Workflow)  
**Status**: Approved & Architecturally Verified  

---

## 1. Intent and the "Why"
TORBIDD provides software contractors and municipal decision-makers with intelligence into Bangkok Metropolitan Administration (BMA) IT and software tenders. Two crucial areas require enhanced user experience and visual polish:

1. **Price Analysis Page (`/historical`)**:
   - Users need to rapidly assess whether an announced project's budget is reasonable compared to historical contracts, find similar previous tenders with scope benchmarks, compare agency spending habits, and explore historical records.
   - Currently, the page feels somewhat disjointed, with basic KPI cards and plain tab interfaces that do not convey the analytical authority of the system.
   - **Solution**: Redesign the page into an **Executive Analytics Studio**, featuring refined KPI metric cards with variance/distribution indicators, an elevated segmented tab bar, polished interactive calculator cards with intuitive visual range bars, enhanced charts, and a high-density Historical Data Explorer with responsive detail accordions.

2. **Home Page (`/`) Below Core Capability**:
   - After users view the hero and the three core capabilities ("สืบค้นโครงการ", "วิเคราะห์เงื่อนไข", "เปรียบเทียบราคากลาง"), the page abruptly transitions to a plain, dark-background carousel of 8 recent tenders with minimal context, followed immediately by a basic footer.
   - **Solution**: Upgrade this section into a seamless narrative:
     - A **Curated Live Tender Showcase** with filter tabs (*All Active*, *Closing Soon*, *High Value > ฿10M*, *AI & Data Analytics*), dynamic counters, carousel navigation, and a direct CTA link to `/opportunities`.
     - A **"How TORBIDD Works" 3-Step Journey Banner** illustrating the end-to-end intelligence cycle (1. *Scrape & Normalize BMA Tenders* → 2. *AI TOR Analysis & Qualification Check* → 3. *Benchmark Fair Price & Bid with Confidence*).
     - An **Affiliation & Trust Footer** with university credits (Kasetsart University Dept of Computer Engineering), quick links, and bilingual analysis disclaimer.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Unified Visual Identity**: Strictly adhere to TORBIDD's design tokens: `--primary-900: #164566`, `--primary-700: #21658f`, `--primary-600: #2773a5`, `--primary-50: #e7f1f7`, plus standard semantic accents (`#10b981` success, `#f59e0b` warning, `#ef4444` outlier alert).
- **Executive Analytics Studio**:
  - Deliver clean, responsive KPI cards for Total Spend, Average Award Size, Top Historical Tender (with click-to-view modal), and Outlier Rate.
  - Upgrade tab controls (`Benchmark & Reasonableness`, `Scope Estimator`, `Agency Comparison`, `Data Explorer`) with icons and count badges.
  - Ensure the Reasonableness Checker and Scope Estimator have clear visual indicator bars (green/amber/red corridors) and crisp input states.
  - Enhance the Explorer data table with bilingual search, category/department filters, CSV download, and expandable project scope details.
- **Home Page Narrative**:
  - Transform the section below core capabilities into an engaging live showcase with filter tabs and clear links to the full search.
  - Introduce the 3-step workflow banner connecting capability discovery to bidding action.
- **Bilingual & Responsive Excellence**: Complete Thai/English language support and seamless mobile/tablet/desktop responsiveness.
- **Zero Regression**: Pass all existing unit and component tests (`HistoricalComponents.test.tsx`, `historicalAnalytics.test.ts`, `ProjectCarousel.test.tsx`, `historical-filtering-charts-stats.spec.tsx`).

### Non-Goals
- Modifying backend MongoDB schemas, aggregation pipelines, or API route signatures (`/api/historical`, `/api/projects`).
- Replacing Chart.js / custom SVG charts with a new heavy charting library.
- Removing any existing data fields or CSV export columns.

### Anti-Goals
- No distracting neon gradients, unnecessary 3D elements, or generic low-contrast "AI slop".
- No disruptive layout jumps when switching filters or expanding table rows.

---

## 3. Constraints & Architectural Decisions (Builder Check Resolved)

1. **Outlier Threshold Consistency**:
   - **Decision**: Adhere strictly to canonical analytics in `utils.ts` and `historicalAnalytics.ts`: ±30% threshold (`ratio > 1.3` and `ratio < 0.7`) and Tukey 1.5 × IQR. This preserves exact KPI values (such as the standard 33% test fixture) and ensures 100% test compatibility.
2. **Home Page Filter Tabs & Routing Contract**:
   - Filter pills on Home page:
     - `All Active` (`all`): All open tenders → CTA: `/opportunities`
     - `Closing Soon` (`closingSoon`): Deadline ≤ 7 days → CTA: `/opportunities?deadline=within7&sortBy=deadline_asc`
     - `High Value` (`highValue`): Budget ≥ ฿10,000,000 → CTA: `/opportunities?minBudget=10000000&sortBy=budget_desc`
     - `AI & Data` (`aiData`): Categories `AI` and `Data Analytics` → CTA: `/opportunities?categories=AI,Data%20Analytics`
3. **Reasonableness Checker Status Badges**:
   - Retain exact test-matching status badges: `statusReasonable`, `statusHighOutlier` ("High Outlier"), and `statusLowOutlier` ("Low Outlier") to guarantee test passes in `HistoricalComponents.test.tsx`.
   - Add rich contextual guidance chips below the badge (e.g. "ราคาอยู่ในเกณฑ์มาตรฐาน / Normal Corridor", "อาจมีความเสี่ยงงบประมาณสูงกว่าค่าเฉลี่ย / Premium Margin", "งบประมาณต่ำกว่าเกณฑ์ / Delivery Risk").
4. **Home Carousel Capping**:
   - When any filter tab is selected on the Home page, the carousel receives `filteredProjects.slice(0, 8)` (capped at top 8 items) to keep slide pagination crisp and avoid layout blowups, while the prominent CTA button dynamically displays "ดูทั้งหมด {filteredCount} โครงการ (฿{totalBudget}M) →" linking directly to the full results page.

---

## 4. Evaluated Approaches

| Approach | Description | Verdict |
|---|---|---|
| **Approach 1: Executive Analytics Studio & Narrative Workflow** | Full-width analytical studio with upgraded KPI monitors, segmented tabs, polished calculator widgets, interactive Home filter tabs, and 3-step workflow banner. | **Selected** (User approved; optimal balance of analytical clarity and landing page conversion). |
| **Approach 2: Split-Pane Inspector & Minimalist Carousel** | Move Historical Explorer into a split-pane drawer inspector, keep Home carousel minimal with static filter pills. | Rejected (Split-pane reduces chart readability and comparison ergonomics on analytical screens). |

---

## 5. Detailed Component & UI Specification

### 5.1. Home Page Section (`torbidd-app/src/app/page.tsx` & `globals.css`)
1. **Live Tender Showcase Header**:
   - Header with section title ("โอกาสจัดซื้อจัดจ้างล่าสุด" / "Live Procurement Opportunities") and descriptive subtitle.
   - Filter Tabs / Pills:
     - `All Active` (default)
     - `Closing Soon` (projects closing within 7 days)
     - `High Value` (budget >= ฿10,000,000)
     - `AI & Data` (categories: AI, Data Analytics)
   - Dynamic counter badge for each tab.
   - Direct Action Button: "ดูทั้งหมด {X} โครงการ (฿{Y} M) →" navigating to `/opportunities` with the corresponding active filter query params.
2. **Project Carousel**:
   - Embedded cleanly within the filtered selection (`slice(0, 8)`).
   - Retains touch-swipe, autoplay pause on hover, keyboard navigation, and responsive item count (2 cards on desktop, 1 on mobile).
3. **"How TORBIDD Works" 3-Step Journey Banner (`home-workflow-section`)**:
   - 3 structured step cards:
     - **Step 01: สืบค้นและกรองโครงการ (Smart Ingestion & Filter)**: Scraped in real time from BMA e-GP, CKAN, and National e-GP, automatically isolating IT & software projects.
     - **Step 02: วิเคราะห์เงื่อนไข TOR ด้วย AI (AI Qualification Analysis)**: Vertex AI extracts mandatory qualifications, submission deadlines, and key tech stack requirements.
     - **Step 03: เปรียบเทียบราคากลางย้อนหลัง (Fair Price Benchmarking)**: Compare proposed pricing against historical awards to bid with confidence.
4. **Enhanced Footer**:
   - Consistent layout with Kasetsart University logo/name, quick navigation links (Home, Opportunities, Price Analysis, Saved), and bilingual disclaimer.

### 5.2. Price Analysis Page (`torbidd-app/src/app/historical/page.tsx` & `globals.css`)
1. **Page Header & Studio Meta Bar**:
   - Page title and subtitle with last data refresh badge ("ข้อมูลอัปเดตล่าสุด" / "Real-time BMA Historical Data").
   - Quick export button or summary badge.
2. **KPI Metrics Grid**:
   - 4 distinct metric cards with refined elevation, soft borders, and contextual badges:
     - **Total Historical Spend**: Formatted in millions/billions (THB) with completed project count tag.
     - **Average Award Size**: Mean contract value with category benchmark note.
     - **Highest Tender Recorded**: Clickable card with preview badge opening the inspection modal.
     - **Outlier Rate**: Percentage of tenders sitting outside standard ±30% / Tukey IQR corridors with color-coded alert badge.
3. **Segmented Tab Control**:
   - Modern pill/segmented container:
     - `Benchmark & Reasonableness` (Icon: Chart / Target)
     - `Scope & Cost Estimator` (Icon: Calculator / Sparkles)
     - `Agency Comparison` (Icon: Building / BarChart)
     - `Data Explorer` (Icon: Table / Search) with count badge.
4. **Interactive Calculators & Charts**:
   - **Budget Reasonableness Checker**: Polished input selector for active projects, visual corridor gauge, canonical status badge, and clear guidance chips.
   - **Charts**: Sleek card frame with interactive filters (Category, Department, Year) for `BudgetBarChart` and `ComparisonChart`.
   - **Similar Procurement Estimator**: Streamlined project picker, category matching, and comparative historical project matches.
   - **Agency Comparison**: Clean spending breakdown by BMA department.
5. **Historical Data Explorer Table**:
   - Search bar and instant category/department filter dropdowns.
   - High-contrast table with status badges (`Normal`, `High Outlier`, `Low Outlier`).
   - Smooth expand/collapse accordion revealing Project Description, Awarded Vendor, and Scope of Work bullets.
   - One-click CSV export with UTF-8 BOM encoding.
