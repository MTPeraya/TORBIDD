# UI/UX Design & Prototype

[← Back to Wiki Home](Home) · [Feature Overview](Feature-Overview) · [Requirement Traceability](Requirement-Traceability)

## 1. Design Philosophy & System Principles

TORBIDD's user interface is engineered for procurement officers, enterprise software vendors, and bidding analysts. The UI prioritizes **clarity, high information density, and data accessibility**.

- **Clean Light Theme**: Standardized globally on a clean, high-contrast light theme using CSS custom properties (`--bg-primary`, `--text-primary`, `--border-color`, `--accent-blue`). Dark mode was intentionally removed across all views to guarantee optimal tabular legibility, consistent badge contrast, and reliable printing/exporting.
- **Bilingual Interface**: Instant switching between Thai (ภาษาไทย) and English (EN) powered by `LanguageContext`.
- **Date Localization**: Native support for the Thai Buddhist Era (e.g. `2569 ว/ด/ป`) alongside the Gregorian calendar (`2026-MM-DD`).
- **Responsive Layout**: Designed for seamless operation across desktop workstations, split-pane monitors, and mobile tablets.

---

## 2. Key Interface Views

### 2.1 Topbar & Navigation Shell (`AppShell`, `Topbar`, `Sidebar`)
- **Collapsible Sidebar**: Direct access to *Explore Opportunities*, *Saved Opportunities*, *Historical Analytics*, *Notification Center*, *Admin Review Console*, and *Settings*.
- **Topbar**: Real-time search shortcut (`⌘K` / `Ctrl+K`), crawler sync status pill, notification bell with unread badge counter, and language switch toggle (`TH / EN`).

### 2.2 Opportunities Explorer (`/opportunities`)
- **Active Filter Panel**:
  - **Category Filter**: Multi-select pills (`Website`, `Mobile App`, `AI`, `Database`, `Cloud/Infra`, `SaaS/License`).
  - **Budget Range Slider**: Visual min/max sliders with instant formatted Thai Baht (฿) thresholds.
  - **Deadline Filter**: Fast selection for `All`, `Within 7 Days`, `Within 30 Days`, and `Closing Soon`.
  - **Agency Dropdown**: Searchable list of BMA departments and national ministries.
  - **Hide Closed Toggle**: Eliminates closed/awarded projects from the active feed.
- **Project Cards**: Displays procurement title, issuing agency, allocated budget badge, remaining days countdown pill, category tags, and one-click bookmark button.

### 2.3 Project Detail View (`/opportunities/[id]`)
- **Hero Header**: Official tender title, external procurement ID, status badge, publication date, and dynamic countdown timer to submission deadline.
- **Procurement Timeline**: Visual step progress showing *Announcement Published* → *Inquiry Window* → *Bid Submission Deadline* → *Evaluation* → *Contract Award*.
- **Go/No-Go Qualification Checklist**: Interactive compliance checker listing mandatory clauses (Legal, Financial, Technical, Past Experience) extracted by Vertex AI.
- **Budget Breakdown & Reasonableness Bar**: Visualizes the current budget against historical category benchmarks (Median, Q1, Q3).
- **TOR Document Viewer**: Embedded viewer for official announcement and TOR specification documents with direct download actions.

### 2.4 Historical Analytics (`/historical` - Redesigned)
- **Executive Metric Cards**:
  - **Category Median**: Central tendency benchmark for selected category.
  - **Average Budget (Mean)**: Overall spending scale.
  - **Interquartile Range (IQR)**: Statistical middle-50% spread.
  - **Total Projects**: Sample size of analyzed awarded contracts.
- **Interactive Visualizers**:
  - **Price Distribution & Quartiles**: Box plot and percentile bars showing Minimum, Q1, Median, Q3, Maximum, and Tukey outlier boundaries.
  - **Contract Price vs. Allocated Budget Spread**: Compares reference prices against final winning bids.
  - **Agency Spending Breakdown**: Departmental procurement distribution across municipal offices.

### 2.5 Admin Console (`/admin` - Redesigned)
- **Top Header Stats Strip**: Replaced the separate classification tab with an always-visible stats strip displaying total projects, pending triage items, classified counts, and crawler health.
- **Top-Right KPI Cards**: Compact KPI metric boxes highlighting pipeline throughput and review queue backlogs.
- **Triage Filter Pills**: One-click filtering between `All`, `Pending Triage`, `Flagged`, and `Needs Review`.
- **Split-Pane Project Inspector Drawer (`ProjectInspectorDrawer`)**:
  - Opens side-by-side upon clicking any project row without losing list context or scrolling position.
  - **Quick Inline Edits**: Instant editing of English titles (with integrated AI auto-translation via `/api/admin/translate`), category assignments, budget amounts, and lifecycle status.
  - **AI Metadata Review**: Displays extraction confidence scores, detected technologies, and source links.
- **Crawler Controls & Audit Logs**: Manual poller triggers (`/api/ingestion/sync`) and detailed error inspection (`SyncError`).

---

## 3. Design Tokens & CSS Variables

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-color: #e2e8f0;
  --border-focus: #3b82f6;
  --accent-blue: #2563eb;
  --accent-hover: #1d4ed8;
  --badge-green: #10b981;
  --badge-amber: #f59e0b;
  --badge-red: #ef4444;
  --card-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}
```

---

## References
- [Demo Website](https://torbidd-demo.vercel.app)
- [Requirement Traceability](Requirement-Traceability)
- [Notification Requirements](Notification-Requirements)
