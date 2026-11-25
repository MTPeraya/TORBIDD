## FEAT-06: Administration Panel & Ingestion Audit Monitoring
[← Back to Feature Details](Feature-Details) · [API Specification](8.-ingestion-and-administration-API)

### 1. Overview & Purpose
Provides system administrators with unified operational tools to monitor automated scraping pipelines, audit AI extraction confidence, triage and quick-edit opportunities in a split-pane drawer, trigger AI translations, and manage system users.

### 2. Architecture & Components
- **UI View**: `src/app/admin/page.tsx`, `src/components/admin/ProjectInspectorDrawer.tsx`
- **Primary Models**: `SyncLog.ts`, `SyncError.ts`, `User.ts`, `ProcurementProject.ts`
- **Security Middleware & Guards**: `src/middleware.ts` (enforces `role === 'admin'`) and `src/lib/auth.ts` (`requireAdmin`)
- **Key Route Handlers**:
  - `GET/PUT /api/admin/projects/[id]`: Project metadata and quick inline update.
  - `POST /api/admin/translate`: Thai-to-English AI translation powered by Vertex AI / Gemini.
  - `GET /api/admin/stats`: Top-level telemetry and KPI metrics.
  - `GET /api/admin/sync-health`: Crawler telemetry and error rates.
  - `POST /api/ingestion/sync`: Manual multi-source scraper trigger.
  - `GET/PUT /api/admin/users`: User role assignment and account controls.

### 3. Redesigned Split-Pane Triage & Operational Features

The administration console has been redesigned for high-efficiency triage workflows:
1. **Header Stats Strip (`StatsStrip`)**: Replaced the separate classification tab with a compact, always-visible header stats strip summarizing total projects, pending triage items, classified counts, and sync status.
2. **Top-Right KPI Card Boxes**: Surfaces key pipeline health indicators (error rates, scraper throughput, triage backlog).
3. **Triage Filter Pills**: Fast filtering of projects between `All`, `Pending Triage`, `Flagged`, and `Needs Review`.
4. **Project Inspector Drawer (`ProjectInspectorDrawer`)**:
   - Opens as an interactive right-hand split pane upon clicking any project row.
   - Allows administrators to inspect AI extraction details without losing table position or filter context.
   - **Quick Inline Edits**: Instant updates for English title (with one-click AI translation via `/api/admin/translate`), category selection, budget, and project lifecycle status.
5. **Multi-Source Ingestion & Sync Health**: Telemetry across BMA e-Procurement (`egp2.bangkok.go.th`), National e-GP (`gprocurement.go.th`), and Open Data Thailand (`data.go.th`).
6. **Dead Letter Queue (DLQ) & Audit Logs**: Detailed error tracking (`SyncError`) displaying extraction failures, network timeouts, and third-party rate limits.

### 4. Automated Verification
- `src/components/admin/__tests__/AdminPanel.test.tsx`: Validates rendering of stats strip, filter pills, and project tables.
- `src/components/admin/__tests__/ProjectInspectorDrawer.test.tsx`: Tests split-pane opening, field updates, and AI translation triggers.
- `src/app/api/admin/__tests__/admin-routes.integration.test.ts`: Verifies admin authorization, RBAC gating, and update endpoints.
- `src/app/api/admin/translate/__tests__/route.test.ts`: Asserts AI translation route behavior and fallback responses.
