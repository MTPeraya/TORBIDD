# Admin Page Redesign (Split-Pane Triage & Quick Edit Console) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the TORBIDD admin page with a split-pane triage and quick-edit workspace that streamlines tender review, classification, and metadata updates while retaining the brand color scheme (`#2773a5`), zero regression on existing capabilities, and 100% test compatibility.

**Architecture:** Decompose the monolithic admin page by introducing a dedicated `ProjectInspectorDrawer` component for side-by-side inspection and quick editing. Enhance the main Projects table with quick triage pills (*All*, *Needs Review*, *Software*, *Non-Software*), row-click inspection, and multi-source synchronization, while retaining existing modal flows (`ProjectFormModal`, `ConfirmNonSoftwareModal`, `ClassificationReviewPanel`) and test selectors.

**Tech Stack:** Next.js 14 (App Router, Client Components), React 18, TypeScript, CSS Custom Properties (`globals.css`), Jest & React Testing Library.

**Spec:** [docs/superpowers/specs/2026-11-24-admin-page-redesign.md](file:///Users/mintt/Documents/Uni_Project/TORBIDD/docs/superpowers/specs/2026-11-24-admin-page-redesign.md)

## Global Constraints
- Exact brand palette: `--primary-900: #164566`, `--primary-700: #21658f`, `--primary-600: #2773a5`, `--primary-50: #e7f1f7`, plus semantic accents (`#10b981`, `#ef4444`, `#f59e0b`).
- No modifications to backend API endpoints (`/api/projects`, `/api/admin/stats`, `/api/projects/[id]`, `/api/projects/[id]/classification`, `/api/admin/sync`) or database schemas.
- Preserve 100% backward compatibility with all test selectors in `torbidd-app/src/components/admin/__tests__/AdminPanel.test.tsx`.
- Dark mode compatibility using existing CSS variables.

## Review Focus
1. **Drawer opening and closing state**: Clicking a row opens the drawer with the exact project's data; pressing `Escape` or clicking the overlay closes it without losing table scroll position.
2. **Inline quick editing vs Full edit**: Saving in the drawer updates the project in state and sends a `PUT /api/projects/[id]` request; clicking "Open Full Form" opens `ProjectFormModal` with all initial values preserved.
3. **UC-4 Non-Software confirmation**: Triggering "Mark Non-Software" from the drawer opens `ConfirmNonSoftwareModal` and updates both the drawer and table rows upon confirmation.
4. **Triage filter pills**: Selecting "Needs Review" filters the table to show projects where `classificationReviewStatus === 'PENDING_REVIEW'` or `!isSoftwareRelated`, while keeping the underlying `#adminStatusFilterSelect` synced.
5. **No regression on automated tests**: All 8 existing tests in `AdminPanel.test.tsx` plus new drawer and triage tests pass cleanly.

---

### Task 1: Component - `ProjectInspectorDrawer`

**Files:**
- Create: `torbidd-app/src/components/admin/ProjectInspectorDrawer.tsx`
- Test: `torbidd-app/src/components/admin/__tests__/ProjectInspectorDrawer.test.tsx`

**Interfaces:**
- Consumes:
  - `Project` from `@/types/project`
  - `useLanguage` from `@/contexts/LanguageContext`
  - `ICONS` from `@/components/ui/Icons`
  - `formatTHB` from `@/lib/utils`
- Produces:
  ```typescript
  export interface ProjectInspectorDrawerProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
    onSaveQuickEdit: (id: string | number, updates: Partial<Project>) => Promise<void>;
    onConfirmSoftware: (project: Project) => Promise<void>;
    onRequestNonSoftwareModal: (project: Project) => void;
    onOpenFullEditModal: (project: Project) => void;
    availableDepartments?: string[];
  }
  export function ProjectInspectorDrawer(props: ProjectInspectorDrawerProps): JSX.Element | null;
  ```

- [ ] **Step 1: Write the failing unit tests for `ProjectInspectorDrawer`**

```typescript
// torbidd-app/src/components/admin/__tests__/ProjectInspectorDrawer.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectInspectorDrawer } from '../ProjectInspectorDrawer';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Project } from '@/types/project';

const mockProject: Project = {
  externalId: 'BMA-2025-001',
  title: { th: 'ระบบบริการดิจิทัล กทม.', en: 'BMA Digital Portal' },
  department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy Dept' },
  category: 'Website',
  budget: 12000000,
  deadline: '2026-12-31T23:59:59.000Z',
  procurementType: 'e-bidding',
  isSoftwareRelated: true,
  aiConfidence: 'High',
  requiredTechnologies: ['React', 'Next.js', 'PostgreSQL'],
  scope: 'พัฒนาระบบเว็บพอร์ทัลเพื่อการให้บริการประชาชน',
  fiscalYear: '2569',
};

describe('ProjectInspectorDrawer', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <LanguageProvider>
        <ProjectInspectorDrawer
          project={mockProject}
          isOpen={false}
          onClose={jest.fn()}
          onSaveQuickEdit={jest.fn()}
          onConfirmSoftware={jest.fn()}
          onRequestNonSoftwareModal={jest.fn()}
          onOpenFullEditModal={jest.fn()}
        />
      </LanguageProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders project metadata, AI tags, and inline fields when open', () => {
    render(
      <LanguageProvider>
        <ProjectInspectorDrawer
          project={mockProject}
          isOpen={true}
          onClose={jest.fn()}
          onSaveQuickEdit={jest.fn()}
          onConfirmSoftware={jest.fn()}
          onRequestNonSoftwareModal={jest.fn()}
          onOpenFullEditModal={jest.fn()}
        />
      </LanguageProvider>
    );
    expect(screen.getByText(/BMA-2025-001/)).toBeInTheDocument();
    expect(screen.getByText(/ระบบบริการดิจิทัล กทม./)).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('triggers onSaveQuickEdit with updated title and budget', async () => {
    const handleSave = jest.fn().mockResolvedValue(undefined);
    render(
      <LanguageProvider>
        <ProjectInspectorDrawer
          project={mockProject}
          isOpen={true}
          onClose={jest.fn()}
          onSaveQuickEdit={handleSave}
          onConfirmSoftware={jest.fn()}
          onRequestNonSoftwareModal={jest.fn()}
          onOpenFullEditModal={jest.fn()}
        />
      </LanguageProvider>
    );

    const titleInput = screen.getByLabelText(/ชื่อโครงการ \(ไทย\)|Project Title \(TH\)/i);
    fireEvent.change(titleInput, { target: { value: 'ระบบบริการดิจิทัล กทม. ฉบับแก้ไข' } });

    const saveBtn = screen.getByRole('button', { name: /บันทึกข้อมูลด่วน|Save Quick Edits/i });
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith('BMA-2025-001', expect.objectContaining({
      title: expect.objectContaining({ th: 'ระบบบริการดิจิทัล กทม. ฉบับแก้ไข' }),
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd torbidd-app && npm test -- --runInBand src/components/admin/__tests__/ProjectInspectorDrawer.test.tsx`  
Expected: FAIL with "Cannot find module '../ProjectInspectorDrawer'"

- [ ] **Step 3: Implement `ProjectInspectorDrawer` in `torbidd-app/src/components/admin/ProjectInspectorDrawer.tsx`**

Implement component with:
- Drawer backdrop with fade animation and close on click.
- Slide-over panel container (`admin-inspector-drawer`) with keyboard `Escape` handler.
- Header with Project External ID, Procurement Type tag, View Public Link, and close button.
- Section 1: AI Analysis & Classification Card with `aiConfidence` badge, `requiredTechnologies` pills, scope snippet, and quick action buttons ("Confirm Software", "Mark Non-Software").
- Section 2: Inline Quick Edit Form with controlled inputs for Title (TH/EN), Department, Category, Budget, and Deadline.
- Footer action buttons: "Save Quick Edits" (with loading state) and "Open Full Form Modal".

- [ ] **Step 4: Run test to verify it passes**

Run: `cd torbidd-app && npm test -- --runInBand src/components/admin/__tests__/ProjectInspectorDrawer.test.tsx`  
Expected: PASS (all 3 tests pass)

- [ ] **Step 5: Commit component**

```bash
git add torbidd-app/src/components/admin/ProjectInspectorDrawer.tsx torbidd-app/src/components/admin/__tests__/ProjectInspectorDrawer.test.tsx
git commit -m "feat(admin): add ProjectInspectorDrawer component for split-pane triage and quick edits"
```

---

### Task 2: Styles - Triage & Inspector CSS in `globals.css`

**Files:**
- Modify: `torbidd-app/src/app/globals.css:5536-5850`

**Interfaces:**
- Produces CSS classes:
  - `.admin-inspector-overlay`
  - `.admin-inspector-drawer`
  - `.admin-inspector-header`
  - `.admin-inspector-body`
  - `.admin-inspector-section`
  - `.admin-triage-pills`
  - `.admin-triage-pill`
  - `.admin-triage-pill.active`
  - `.admin-table-row-selected`
  - `.admin-tech-tag`

- [ ] **Step 1: Add drawer and triage CSS rules to `globals.css`**

Add CSS custom classes using the exact TORBIDD design tokens (`--primary-600`, `--primary-50`, `--gray-950`, `--gray-200`, `--border-radius`, etc.) including:
- Responsive drawer layout (slide in from right with `transform: translateX(0)`, width 480px on desktop, `100vw` on mobile `< 768px`).
- Dark mode overrides under `body.dark-mode`.
- Triage filter pill group with active primary accent and count badges.

- [ ] **Step 2: Verify CSS builds without errors**

Run: `cd torbidd-app && npm run build` (or `npx next lint`)  
Expected: No CSS syntax errors or bundle failures.

- [ ] **Step 3: Commit CSS styles**

```bash
git add torbidd-app/src/app/globals.css
git commit -m "style(admin): add styles for inspector drawer, triage filter pills, and tech badges"
```

---

### Task 3: Integration - Refactor `AdminPage` with Split-Pane Triage & Inspector

**Files:**
- Modify: `torbidd-app/src/app/admin/page.tsx`
- Modify: `torbidd-app/src/components/admin/__tests__/AdminPanel.test.tsx`

**Interfaces:**
- Consumes:
  - `ProjectInspectorDrawer` from `@/components/admin/ProjectInspectorDrawer`
  - Existing handlers: `handleCreateProject`, `handleEditProject`, `handleConfirmNonSoftware`, `handleTriggerSync`
- Produces:
  - Interactive triage filter pills (*All*, *Needs Review*, *Software*, *Non-Software*) connected to state.
  - Active inspecting project state: `inspectingProject: Project | null`, `inspectorOpen: boolean`.
  - Row click trigger to open the drawer while preserving row action buttons (`editProjectBtn_${id}`, `classifyNonSwBtn_${id}`, `deleteProjectBtn_${id}`).
  - Quick edit save handler `handleQuickSaveProject(id, updates)` that syncs state and updates backend via `PUT /api/projects/[id]`.

- [ ] **Step 1: Add new test cases to `AdminPanel.test.tsx` for Inspector Drawer and Triage Pills**

Add tests:
- "opens inspector drawer when a project row is clicked"
- "filters projects when clicking Needs Review triage pill"
- "updates project via inspector quick-save"

- [ ] **Step 2: Run tests to verify the new test cases fail**

Run: `cd torbidd-app && npm test -- --runInBand torbidd-app/src/components/admin/__tests__/AdminPanel.test.tsx`  
Expected: FAIL (new assertions fail before page refactoring)

- [ ] **Step 3: Update `torbidd-app/src/app/admin/page.tsx`**

1. Import `ProjectInspectorDrawer`.
2. Add states:
   ```typescript
   const [inspectingProject, setInspectingProject] = useState<Project | null>(null);
   const [inspectorOpen, setInspectorOpen] = useState(false);
   const [triageFilter, setTriageFilter] = useState<'ALL' | 'NEEDS_REVIEW' | 'SOFTWARE' | 'NON_SOFTWARE'>('ALL');
   const [sortBy, setSortBy] = useState<'deadline' | 'budget_desc' | 'budget_asc' | 'id'>('deadline');
   ```
3. Update `filteredProjects` useMemo to support `triageFilter` (syncing with `statusFilter`) and `sortBy`.
4. Render Triage Filter Pills above the table with dynamic counts:
   - All (`projects.length`)
   - Needs Review (`projects.filter(p => p.classificationReviewStatus === 'PENDING_REVIEW' || p.isSoftwareRelated === false).length`)
   - Software (`projects.filter(p => p.isSoftwareRelated !== false).length`)
   - Non-Software (`projects.filter(p => p.isSoftwareRelated === false).length`)
5. Render Sort Dropdown.
6. Make project table rows interactive with `onClick={() => { setInspectingProject(project); setInspectorOpen(true); }}` while using `e.stopPropagation()` on checkboxes and action buttons.
7. Render `<ProjectInspectorDrawer />` bound to `handleQuickSaveProject`, `handleConfirmSoftware`, `handleRequestNonSoftwareModal`, and `handleOpenFullEditModal`.
8. Ensure all existing test IDs (`adminTabOverviewBtn`, `adminTabProjectsBtn`, `adminStatusFilterSelect`, `selectAllProjectsCheckbox`, `editProjectBtn_${id}`, `classifyNonSwBtn_${id}`, etc.) remain in place.

- [ ] **Step 4: Run tests to verify all tests pass**

Run: `cd torbidd-app && npm test -- --runInBand torbidd-app/src/components/admin/__tests__/AdminPanel.test.tsx`  
Expected: PASS (all tests pass including the 8 original tests and new drawer tests)

- [ ] **Step 5: Commit integration**

```bash
git add torbidd-app/src/app/admin/page.tsx torbidd-app/src/components/admin/__tests__/AdminPanel.test.tsx
git commit -m "feat(admin): integrate split-pane triage inspector and triage pills into AdminPage"
```

---

### Task 4: End-to-End Verification and Polish

**Files:**
- Check: `torbidd-app/src/app/admin/page.tsx`
- Check: `torbidd-app/src/components/admin/ProjectInspectorDrawer.tsx`
- Check: `torbidd-app/src/app/globals.css`

- [ ] **Step 1: Run complete test suite across all admin components**

Run: `cd torbidd-app && npm test -- --runInBand src/components/admin/`  
Expected: 100% test pass across `AdminPanel.test.tsx` and `ProjectInspectorDrawer.test.tsx`.

- [ ] **Step 2: Run Next.js production build check**

Run: `cd torbidd-app && npm run build`  
Expected: Successful build with 0 TypeScript and 0 linting errors.

- [ ] **Step 3: Commit final polish and documentation**

```bash
git add docs/superpowers/plans/2026-11-24-admin-page-redesign.md
git commit -m "docs: finalize implementation plan for admin page split-pane redesign"
```
