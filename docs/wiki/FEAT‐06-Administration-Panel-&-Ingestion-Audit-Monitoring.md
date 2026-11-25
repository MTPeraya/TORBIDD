## FEAT-06: Administration Panel & Ingestion Audit Monitoring
[← Back to Feature Details](Feature-Details)

### 1. Overview & Purpose
Provides system administrators with tools to monitor automated scraping pipelines, audit AI extraction confidence, override project classifications, and manage system users.

### 2. Architecture & Components
- **UI View**: `src/app/admin/page.tsx`, `src/app/admin/users/page.tsx`
- **Primary Models**: `SyncLog.ts`, `SyncError.ts`, `User.ts`
- **Security Middleware**: `src/middleware.ts` (enforces `role === 'admin'`)

### 3. Administrative Functions
- **Ingestion Sync Monitor**: Displays real-time telemetry for BMA, National e-GP, and Open Data Thailand pollers (last sync time, records processed, error counts).
- **Classification Override**: Enables admins to inspect borderline or false-positive tenders (e.g., non-software tenders erroneously classified as software) and manually re-categorize or suppress them.
- **Extraction Audit & Error Logs**: Detailed error tracking (`SyncError`) displaying raw PDF extraction failures, missing mandatory fields, and third-party API rate limits.
- **User Role Management**: Administrative interface to activate, suspend, or update roles for registered accounts.
