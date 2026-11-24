# Design Document: TORBIDD Admin Page Redesign (Split-Pane Triage & Edit Console)

**Date**: 2026-11-24  
**Author**: Antigravity  
**Topic**: Admin Page UX & Visual Redesign  
**Approach Selected**: Approach A (Split-Pane "Triage & Quick Edit" Console)  

---

## 1. Intent and the "Why"
Administrators of TORBIDD manage hundreds of government procurement tenders scraped from CKAN, BMA e-GP, and National e-GP. Their most frequent and critical daily tasks are:
1. **Reviewing & classifying imported tenders** (determining if they are software-related, reviewing AI confidence, and excluding non-software projects from public discovery per UC-4 and UC-10).
2. **Editing project metadata** (refining project titles, correcting departments, adjusting budgets, updating deadlines).

In the legacy design, administrators faced high friction:
- A rigid 10-column table that overflowed horizontally and lacked quick inspection.
- Modal fatigue: clicking "Edit" opened a blocking modal that hid the tender details; clicking "Classify" jumped between tabs or opened another modal.
- Segregated workflows: the "Classification Review" queue was isolated in a separate tab, forcing duplicate work between the general Projects table and the Review queue.

The redesigned admin page solves this with an **integrated split-pane workspace** where triage, AI rationale inspection, and direct editing happen in a cohesive, fluid flow without losing context.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Unified Triage & Edit Workflow**: Administrators can click any tender to instantly open a side-by-side inspector/editor drawer without leaving their position in the table.
- **Fast 1-Click Classification**: Direct, immediate actions to confirm software status, mark as non-software (UC-4), or change categories with clear visual feedback.
- **Strict Brand Color Adherence**: Retain the exact TORBIDD visual identity—`--primary-600` (`#2773a5`), slate backgrounds, crisp neutral typography, and semantic status accents—while elevating usability, micro-interactions, and visual hierarchy.
- **Zero Regression on Existing Features & Tests**: Maintain 100% test compatibility with all test selectors (`adminTabOverviewBtn`, `adminTabProjectsBtn`, `adminProjectSearchInput`, `adminStatusFilterSelect`, `selectAllProjectsCheckbox`, `bulkClassifyNonSoftwareBtn`, etc.).
- **Light & Dark Mode Harmony**: Fully readable, high-contrast styling in both light mode and dark mode.

### Non-Goals
- Changing backend API contracts or MongoDB schemas.
- Removing or altering the core business logic of UC-4 (dashboard exclusion) or UC-10 (review queue status).
- Introducing third-party heavy UI component libraries; rely on clean, robust React + CSS tokens.

### Anti-Goals
- No generic "AI slop" aesthetics (no excessive glowing glassmorphism, no neon gradients, no cluttered card-inside-card syndrome).
- No blocking full-screen popups for routine field edits.
- No layout shifts when triaging projects.

---

## 3. Constraints
- **Colors**: Must retain `--primary-900: #164566`, `--primary-700: #21658f`, `--primary-600: #2773a5`, `--primary-50: #e7f1f7`, plus standard semantic accents (`#10b981` success/software, `#ef4444` non-software/danger, `#f59e0b` pending/review).
- **APIs**:
  - `GET /api/projects?limit=1000&all=true`
  - `GET /api/admin/stats`
  - `POST /api/projects`
  - `PUT /api/projects/[id]`
  - `PATCH /api/projects/[id]/classification`
  - `DELETE /api/projects/[id]`
  - `POST /api/admin/sync`
- **Testing**: `npm test -- --runInBand torbidd-app/src/components/admin/__tests__/AdminPanel.test.tsx` must pass cleanly without modification to test expectations.

---

## 4. Evaluated Approaches

| Approach | Description | Verdict |
|---|---|---|
| **Approach A: Split-Pane Triage & Quick Edit** | High-density project table with slide-over inspection & quick-edit drawer. Instant inline AI rationale + metadata editing. | **Selected** (User approved; highest operational efficiency). |
| **Approach B: High-Density Table with Row Accordions** | Inline accordion drawer expanding beneath the clicked row. | Rejected (causes vertical jumpiness during rapid triage). |
| **Approach C: Two-Mode Deck & Separate Registry** | Separate "Triage Deck" swipe mode and traditional registry modal. | Rejected (forces tab/mode switching between triage and editing). |

---

## 5. Detailed Component & UI Specification

### 5.1. Admin Header & Operational Bar
- **Breadcrumb & Status Badge**: Crisp badge showing "BMA Console • Active" with pulse indicator.
- **Title & Subtitle**: "การบริหารจัดการระบบและข้อมูลจัดซื้อจัดจ้าง (Admin Console)" with bilingual subtext.
- **Top Actions**:
  - Unified **"Sync 3 Sources"** trigger with last pull timestamp and spinning feedback.
  - **"New Project"** button (`#adminCreateProjectBtn`) opening `ProjectFormModal` in 'create' mode.

### 5.2. Tab Navigation
1. **Overview** (`adminTabOverviewBtn`): KPI metrics with clickable quick-filter navigation, system vitals card, category breakdown.
2. **Projects & Triage** (`adminTabProjectsBtn`): The primary operational workbench with split-pane capability.
3. **Crawler & Sync** (`adminTabCrawlerBtn`): Multi-source sync health (CKAN, BMA e-GP, National e-GP), log terminal, manual trigger.
4. **Classification Queue** (`adminTabClassificationBtn`): UC-10 pending AI review queue (`ClassificationReviewPanel`), kept fully intact for dedicated queue triage with shared state synchronization via `fetchData`.
5. **Audit Logs** (`adminTabAuditBtn`): System access and audit activity timeline.

### 5.3. Projects & Triage Workspace (Approach A)
- **Top Control Strip**:
  - Quick Triage Filter Pills:
    - `All Projects` (total count)
    - `Needs Review` (pending UC-10 AI review)
    - `Software Only` (active on public dashboard)
    - `Non-Software (UC-4)` (excluded from dashboard)
  - Search Input (`#adminProjectSearchInput`): Instant search by title (TH/EN), external ID, department, or procurement type.
  - Category Filter (`#adminCategoryFilterSelect`).
  - Status Filter (`#adminStatusFilterSelect`): Kept in DOM with exact values (`All`, `Software`, `Non-Software`) for test compatibility.
  - Sort Selector: Sort by Deadline, Budget (High to Low), ID, or Confidence.
  - Rows per page selector (`#adminPageSizeSelect`).
- **Bulk Action Bar** (activated when 1+ checkboxes selected):
  - Selected count badge.
  - Mark Non-Software (`#bulkClassifyNonSoftwareBtn`).
  - Mark Software (`#bulkClassifySoftwareBtn`).
  - Delete Selected (`#bulkDeleteBtn`).
  - Deselect All (`#bulkDeselectBtn`).
- **Data Table Layout**:
  - Sticky table header.
  - Checkbox with indeterminate support.
  - ID & Procurement Source tag. Clicking the row or title opens the Right Inspector Drawer.
  - Title & Department (with fiscal year badge and clean typography).
  - Category badge (colored by category domain).
  - Software Status badge (clickable quick toggle or visual status).
  - Budget (formatted in THB with bold tabular numerals).
  - Deadline (with overdue / active days indicator).
  - Actions:
    - **Inspect (Drawer)**: View AI rationale & inline triage.
    - **Edit Project** (`#editProjectBtn_[id]`): Opens `ProjectFormModal` for comprehensive full-field editing (scope, qualifications, etc.), ensuring 100% test compatibility.
    - **Quick Non-Software Action** (`#classifyNonSwBtn_[id]`): Opens `ConfirmNonSoftwareModal` (UC-4 A5 retention policy), ensuring 100% test compatibility.
    - **Delete** (`#deleteProjectBtn_[id]`).
    - **External Link** to public detail page.

### 5.4. Right Slide-Over Inspector Drawer (The "Triage & Quick Edit" Drawer)
- Opens immediately when clicking any table row or the "Inspect" button.
- **Drawer Header**:
  - Project ID tag, procurement type, and external link.
  - Close button (`Esc` key or overlay click to dismiss).
- **Section 1: AI Classification & Triage Banner**:
  - Software Classification Status (`Software-Related` vs `Non-Software`).
  - AI Confidence Level (`High`, `Medium`, `Low`) with visual pill.
  - AI Extraction Rationale (Synthesized Client-Side from `Project` fields):
    - Shows `requiredTechnologies` tags.
    - Highlights detected scope keywords from `scope` or `description`.
    - Displays `classificationReviewNote` if available.
  - Quick Actions:
    - "✓ Confirm Software": sets `isSoftwareRelated: true`, reviews as `APPROVED` via `PATCH /api/projects/[id]/classification`.
    - "✗ Mark Non-Software (UC-4)": invokes `ConfirmNonSoftwareModal` with the selected project so administrator can choose retention vs permanent deletion per UC-4 A5.
- **Section 2: Inline Metadata Quick-Editor**:
  - Direct editable fields:
    - Title (Thai & English)
    - Department
    - Category
    - Budget
    - Deadline
  - Action buttons:
    - "Save Quick Edits" (saves via `PUT /api/projects/[id]`, optimistic table update, toast).
    - "Open Full Form Modal" (opens `ProjectFormModal` for deep edits like SOW items, qualifications, etc.).

---

## 6. Architectural Resolutions & Calls Made
Following the builder check review, the following implementation calls were established:
1. **Drawer vs Modal**: The slide-over drawer provides rapid inspection, AI review, and quick-editing. `ProjectFormModal` is retained both via row edit buttons (`#editProjectBtn_[id]`) and via a button inside the drawer, preserving 100% of advanced field editing and test assertions.
2. **Tab 4 (Classification Queue) Synchronization**: Kept active and accessible. Triage actions in either view trigger `fetchData()` to keep counts and statuses synchronized across both tabs without page reloads.
3. **UC-4 Modal Consistency**: Both the table action button (`#classifyNonSwBtn_[id]`) and the drawer's "Mark Non-Software" button delegate to `ConfirmNonSoftwareModal`. This prevents accidental deletions and ensures strict adherence to UC-4 A5 retention rules.
4. **AI Rationale Formatting**: Synthesized client-side using `requiredTechnologies`, `scope`, and `classificationReviewNote` from existing `Project` documents without requiring backend schema alterations.


---

## 6. What's Left to the Builder
- Detailed styling definitions in `globals.css` ensuring zero style leakage.
- Transition animations for the drawer (`transform: translateX(0)` with ease-out curve).
- Mobile responsiveness for the drawer (full-width overlay on screens `< 768px`, 480px side panel on desktop).
- Accessibility attributes (`aria-expanded`, focus management on drawer open/close).
