# UI/UX Design & Prototype

## 1. Design Philosophy & System Principles

TORBIDD's user interface is engineered for procurement officers, enterprise software vendors, and bidding analysts. The UI prioritizes **information density, accessibility, and high contrast** across light and dark modes.

- **Design System**: Fully responsive layout built with clean CSS Modules and modern design variables.
- **Theme Support**: Seamless Dark/Light mode toggle persisted in `localStorage` and synchronized with CSS variables (`--bg-primary`, `--text-primary`, `--border-color`, `--accent-blue`).
- **Bilingual Interface**: Seamless switching between Thai (ภาษาไทย) and English (EN).
- **Date Localization**: Native support for the Thai Buddhist Era (e.g. `2568 ว/ด/ป`) alongside the Gregorian calendar (`2025-MM-DD`).

---

## 2. Key Interface Views

### 2.1 Topbar & Navigation Shell (`AppShell`, `Topbar`, `Sidebar`)
- **Collapsible Sidebar**: Direct access to *Explore Opportunities*, *Saved Opportunities*, *Historical Analytics*, *Notification Center*, *Admin Review Console*, and *Settings*.
- **Topbar**: Real-time Search input shortcut, Sync status pill, Notification bell with unread badge counter, Language switch toggle (`TH / EN`), and Theme toggle.

### 2.2 Opportunities Explorer (`/opportunities`)
- **Active Filter Panel**:
  - **Category Filter**: Multi-select pills (`Website`, `Mobile App`, `AI`, `Database`, `Cloud/Infra`).
  - **Budget Range Slider**: Visual min/max sliders with instant formatted Thai Baht (฿) thresholds.
  - **Deadline Filter**: Radio options for `All`, `Within 7 Days`, `Within 30 Days`, and `Closing Soon`.
  - **Agency Dropdown**: Searchable list of BMA departments and national ministries.
  - **Hide Closed Toggle**: Eliminates closed/awarded projects from active view.
- **Project Cards**: Displays procurement title, issuing agency, budget badge, remaining days pill, category tag, and one-click bookmark button.

### 2.3 Project Detail View (`/opportunities/[id]`)
- **Hero Header**: Official procurement name, external ID, status badge, publish date, and countdown timer to submission deadline.
- **Procurement Timeline**: Visual step progress showing *Announcement Published* → *Inquiry Window* → *Bid Submission Deadline* → *Evaluation* → *Contract Award*.
- **Go/No-Go Qualification Checklist**: Interactive compliance checker listing mandatory clauses (Legal, Financial, Technical, Past Experience) extracted by Vertex AI.
- **Budget Breakdown & Reasonableness Bar**: Visualizes the current budget against historical category benchmarks (Median, Q1, Q3).
- **TOR Document Viewer**: Embedded viewer for official announcement and TOR specification documents.

### 2.4 Historical Analytics (`/historical`)
- **Statistical Metric Cards**: Category Median, Average Budget, Interquartile Range (IQR), and Project Count.
- **Interactive Visualizers**:
  - *Budget Distribution by Category* (Bar / Box-plot visualization).
  - *Agency Spending Leaderboard* (Aggregated procurement volume per department).
  - *Similar Procurement Cost Estimator*: Real-time calculator estimating expected pricing ranges based on scope tags.

### 2.5 Admin Console (`/admin`)
- **Live Sync Bar**: Triggers real-time crawler sync across BMA and e-GP.
- **Classification Review Panel**: Displays items classified with low AI confidence or flagged as non-software for manual approval or re-categorization.
- **Audit Logs**: Visual tabular view of recent crawler runs and error traces.

## References
- [Demo Website](https://torbidd-demo.vercel.app)