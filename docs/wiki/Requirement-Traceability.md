# Requirement Traceability Matrix (RTM)

[← Back to Wiki Home](Home) · [SRS Document](https://github.com/MTPeraya/TORBIDD/blob/main/docs/TORBIDD_SRS.pdf) · [Testing Documentation](Testing-Documentation)

## 1. Traceability Framework & Engineering Lifecycle

TORBIDD enforces bidirectional traceability across the entire engineering lifecycle:

$$\text{Stakeholder Need} \longrightarrow \text{SRS Requirement} \longrightarrow \text{Design / SDD} \longrightarrow \text{Implementation Code} \longrightarrow \text{Verification Test Suite}$$

Every functional and non-functional requirement defined in the **Software Requirements Specification (SRS v1.0)** is mapped to its active source code modules, API endpoints, and automated verification test suites.

---

## 2. Functional Requirements Traceability Matrix

### 2.1 User Authentication & Access Control (SRS Section 3.2: AUTH-1 – AUTH-7)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **AUTH-1** | Google OAuth 2.0 / OIDC user sign-in with RS256 token verification | `src/lib/auth.ts`<br>`src/lib/google-oidc.ts` | `/api/auth/google`<br>`/api/auth/callback/google` | `src/lib/__tests__/google-oidc.test.ts`<br>`src/app/login/__tests__/page.test.tsx` | `🟢 Implemented` |
| **AUTH-2** | Session management via cryptographically signed `__Host-` HTTP cookies | `src/lib/auth.ts`<br>`src/middleware.ts` | Server-side cookie signer | `src/lib/__tests__/cookie-security.test.ts`<br>`src/__tests__/auth-middleware.integration.test.ts` | `🟢 Implemented` |
| **AUTH-3** | Session termination (logout) clearing all cookies | `src/app/api/auth/logout/route.ts` | `POST /api/auth/logout` | `src/lib/__tests__/auth.test.ts` | `🟢 Implemented` |
| **AUTH-4** | Retrieve authenticated user profile and roles | `src/app/api/auth/me/route.ts` | `GET /api/auth/me` | `src/lib/__tests__/authorization.test.ts` | `🟢 Implemented` |
| **AUTH-5** | Role-Based Access Control (RBAC) protecting `/admin/*` routes | `src/middleware.ts`<br>`src/lib/auth.ts` | Global middleware & route guards | `src/lib/__tests__/authorization-roles.test.ts`<br>`src/__tests__/middleware.test.ts` | `🟢 Implemented` |
| **AUTH-6** | Immutable identity binding (forbids tampering with email/role via client) | `src/app/api/auth/me/route.ts` | `PUT /api/auth/me` | `src/lib/__tests__/auth-restrictions.test.ts` | `🟢 Implemented` |
| **AUTH-7** | Production secrets validation (fails securely if `SESSION_SECRET` is insecure) | `src/lib/auth.ts`<br>`src/instrumentation.ts` | Server initialization | `src/lib/__tests__/production-secrets.test.ts` | `🟢 Implemented` |

### 2.2 Procurement Opportunity Dashboard (SRS Section 3.3: DASH-1 – DASH-6)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **DASH-1** | Real-time centralized procurement feed displaying active tenders | `src/app/opportunities/page.tsx`<br>`src/app/api/projects/route.ts` | `GET /api/projects`<br>`GET /api/procurements` | `src/app/api/procurements/__tests__/procurements.integration.test.ts` | `🟢 Implemented` |
| **DASH-2** | Opportunity card surfacing budget, agency, deadline, and category | `src/components/procurement-filters/` | `ProjectCard.tsx` | `src/components/procurement-filters/__tests__/ProcurementComponents.test.tsx` | `🟢 Implemented` |
| **DASH-3** | Approaching deadline countdown badges (flags closing in $\le 7$ days) | `src/lib/utils.ts` | `RemainingDaysBadge.tsx` | `src/lib/__tests__/utils.test.ts` | `🟢 Implemented` |
| **DASH-4** | Dynamic pagination and cursor-based loading | `src/app/api/projects/route.ts` | Query param `page`, `limit` | `src/services/database/__tests__/projects.integration.test.ts` | `🟢 Implemented` |
| **DASH-5** | Featured project carousel on home page | `src/app/page.tsx` | `ProjectCarousel.tsx` | `src/components/ui/__tests__/ProjectCarousel.test.tsx` | `🟢 Implemented` |
| **DASH-6** | One-click bookmarking directly from dashboard cards | `src/hooks/useBookmarks.ts` | `BookmarkButton.tsx` | `src/hooks/__tests__/useBookmarks.test.tsx` | `🟢 Implemented` |

### 2.3 Smart Search & Multi-Filter Engine (SRS Section 3.4: SRCH-1 – SRCH-8)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **SRCH-1** | Full-text search across tender titles and agency names | `src/services/procurement-filter.ts` | Query param `q` | `src/services/__tests__/procurementFilter.test.ts` | `🟢 Implemented` |
| **SRCH-2** | Category filter pills (Website, Mobile, AI, Database, Cloud/Infra, SaaS) | `src/components/procurement-filters/` | `CategoryFilter.tsx` | `src/components/procurement-filters/__tests__/ProcurementComponents.test.tsx` | `🟢 Implemented` |
| **SRCH-3** | Budget range min/max slider with Baht (฿) formatting | `src/components/procurement-filters/` | `BudgetSlider.tsx` | `src/components/procurement-filters/__tests__/ProcurementComponents.test.tsx` | `🟢 Implemented` |
| **SRCH-4** | Deadline filter presets (All, $\le 7$ Days, $\le 30$ Days, Closing Soon) | `src/components/procurement-filters/` | `DeadlineFilter.tsx` | `src/components/home/__tests__/HomeFilterLogic.test.ts` | `🟢 Implemented` |
| **SRCH-5** | Searchable issuing agency dropdown across BMA and national departments | `src/components/procurement-filters/` | `AgencyDropdown.tsx` | `src/components/procurement-filters/__tests__/ProcurementComponents.test.tsx` | `🟢 Implemented` |
| **SRCH-6** | Hide closed/awarded projects toggle | `src/components/procurement-filters/` | `StatusFilter.tsx` | `src/services/__tests__/procurementFilter.test.ts` | `🟢 Implemented` |
| **SRCH-7** | Thai Buddhist Era (B.E.) date rendering with bilingual support | `src/lib/utils.ts`<br>`src/contexts/LanguageContext.tsx` | `formatDateBE()` | `src/services/transformation/__tests__/date-normalizer.test.ts` | `🟢 Implemented` |
| **SRCH-8** | Synchronize active filter state to browser URL search params | `src/app/opportunities/page.tsx` | Next.js Router hooks | `src/components/home/__tests__/HomeFilterLogic.test.ts` | `🟢 Implemented` |

### 2.4 AI TOR Document Extraction & 5-Pillar Model (SRS Section 3.5: EXTR-1 – EXTR-8)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **EXTR-1** | Multimodal PDF extraction via Google Cloud Vertex AI / Gemini 1.5 Pro | `src/services/ai/tor-extractor.ts`<br>`src/services/ai/vertex-ai.ts` | `POST /api/ai/extract` | `src/services/ai/__tests__/tor-extractor.test.ts` | `🟢 Implemented` |
| **EXTR-2** | Five-Pillar business data model extraction (Commercial, Scope, Tech, Gates, Roadmap) | `src/models/ProcurementProject.ts` | Mongoose schema pillars | `src/app/opportunities/[id]/__tests__/clause-modal.test.tsx` | `🟢 Implemented` |
| **EXTR-3** | Bidder qualification gate parsing (Legal, Experience, Financial, Technical ISO/CMMI) | `src/services/ai/tor-extractor.ts` | Qualification clauses | `src/services/ai/__tests__/qualification-validator.test.ts` | `🟢 Implemented` |
| **EXTR-4** | Secure PDF caching outside web root with SHA-256 content hashes | `src/services/ingestion/` | `storage/documents/` | `src/lib/__tests__/secure-pdf.test.ts` | `🟢 Implemented` |
| **EXTR-5** | Document download endpoint with path traversal containment defense | `src/app/api/documents/[projectId]/[fileName]/route.ts` | `GET /api/documents/...` | `src/app/api/documents/.../__tests__/containment-defense.test.ts` | `🟢 Implemented` |
| **EXTR-6** | Background document ingestion and resilience retry policies | `src/services/resilience/retry-policy.ts` | Exponential backoff | `src/services/resilience/__tests__/retry-policy.test.ts` | `🟢 Implemented` |
| **EXTR-7** | Graceful degradation indicator when TOR PDF is missing/unreadable | `src/models/SyncError.ts` | `InsufficientInfoBanner` | `src/services/database/__tests__/dlq.test.ts` | `🟢 Implemented` |
| **EXTR-8** | Direct source verification linking to official government announcement PDF | `src/components/ui/` | `TorDocumentViewer.tsx` | `src/lib/__tests__/detailView.test.ts` | `🟢 Implemented` |

### 2.5 Software Project Classification & Categorization (SRS Section 3.6: CLAS-1 – CLAS-5)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **CLAS-1** | Software relevance classification (Website, Mobile, AI, DB, SaaS/Licenses) | `src/services/ai/classifier.ts` | `POST /api/ai/classify` | `src/services/ai/__tests__/classifier.test.ts` | `🟢 Implemented` |
| **CLAS-2** | Modular multi-tier AI fallback (Google AI Studio → OpenRouter → Vertex AI → Keywords) | `src/services/ai/adapters/` | `fallback-adapter.ts` | `src/services/ai/adapters/__tests__/fallback-adapter.test.ts`<br>`src/services/ai/__tests__/ai-fallback-dlq.integration.test.ts` | `🟢 Implemented` |
| **CLAS-3** | Non-software exclusion gate (filters out civil construction, vehicles, supplies) | `src/services/ai/classifier.ts` | Gate predicate | `src/services/ai/__tests__/classifier.test.ts` | `🟢 Implemented` |
| **CLAS-4** | Confidence score recording for AI extraction and classification auditing | `src/models/ProcurementProject.ts` | `aiConfidence` field | `src/services/database/__tests__/projects.integration.test.ts` | `🟢 Implemented` |
| **CLAS-5** | Low-confidence triage queue for administrative override | `src/app/admin/page.tsx` | `GET /api/admin/classification-queue` | `src/components/admin/__tests__/AdminPanel.test.tsx` | `🟢 Implemented` |

### 2.6 Procurement Detail Viewer & Decision Sheet (SRS Section 3.7: DETL-1 – DETL-8)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **DETL-1** | Procurement hero header with status, ID, dates, and closing countdown | `src/app/opportunities/[id]/page.tsx` | Hero Header UI | `src/lib/__tests__/detailView.test.ts` | `🟢 Implemented` |
| **DETL-2** | Interactive Go/No-Go bidder qualification checklist | `src/components/ui/EligibilityChecklist.tsx` | Checklist UI | `src/components/ui/__tests__/EligibilityChecklist.test.tsx` | `🟢 Implemented` |
| **DETL-3** | Technical stack and certification requirements display | `src/components/ui/TechStackRequirements.tsx` | Tech stack view | `src/components/ui/__tests__/TechStackRequirements.test.tsx` | `🟢 Implemented` |
| **DETL-4** | Budget comparison bar evaluating budget against historical category medians | `src/app/opportunities/[id]/page.tsx` | `BudgetComparisonBar` | `src/app/opportunities/[id]/__tests__/budget-contract-price.test.tsx` | `🟢 Implemented` |
| **DETL-5** | Procurement lifecycle milestone timeline (Announcement → Submission → Award) | `src/components/ui/` | `ProcurementTimeline.tsx` | `src/lib/__tests__/detailView.test.ts` | `🟢 Implemented` |
| **DETL-6** | Embedded TOR document viewer and full PDF download | `src/components/ui/` | `TorDocumentViewer.tsx` | `src/app/opportunities/[id]/__tests__/clause-modal.test.tsx` | `🟢 Implemented` |
| **DETL-7** | Clause detail modal for deep inspection of specific TOR requirements | `src/components/ui/` | `ClauseDetailModal.tsx` | `src/app/opportunities/[id]/__tests__/clause-modal.test.tsx` | `🟢 Implemented` |
| **DETL-8** | Automated Thai-English translation of procurement scope and title | `src/services/translation/` | `/api/admin/translate` | `src/services/translation/__tests__/auto-translation.test.ts` | `🟢 Implemented` |

### 2.7 Proactive Notification & Email Alerts (SRS Section 3.8: NOTF-1 – NOTF-8)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **NOTF-1** | Notification matching engine evaluating interest tags and budget bounds | `src/services/notifications/matching-engine.ts` | Matching engine | `src/services/notifications/__tests__/procurement-matching.test.ts` | `🟢 Implemented` |
| **NOTF-2** | Scheduled deadline scanner triggering 72-hour and 24-hour reminders | `src/services/notifications/deadline-scanner.ts` | `POST /api/cron/deadline-reminders` | `src/services/notifications/__tests__/deadline-scanner.test.ts`<br>`src/app/api/cron/.../__tests__/route.test.ts` | `🟢 Implemented` |
| **NOTF-3** | In-app notification center with unread badge counter | `src/app/notifications/page.tsx` | `GET /api/notifications` | `src/components/notifications/__tests__/NotificationComponents.test.tsx` | `🟢 Implemented` |
| **NOTF-4** | Mark notifications as read individually or in bulk | `src/app/api/notifications/[id]/route.ts` | `PATCH /api/notifications/[id]` | `src/services/notifications/__tests__/notification-model.test.ts` | `🟢 Implemented` |
| **NOTF-5** | SMTP transactional email alerts via Nodemailer | `src/services/notifications/email-delivery-service.ts` | SMTP Transporter | `src/services/notifications/__tests__/email-delivery.test.ts` | `🟢 Implemented` |
| **NOTF-6** | Responsive HTML email templates for Opportunity Alerts & Deadline Reminders | `src/services/notifications/email-templates.ts` | Template generators | `src/services/notifications/__tests__/email-delivery.test.ts` | `🟢 Implemented` |
| **NOTF-7** | Idempotency key pattern preventing duplicate alert dispatch | `src/services/notifications/` | Unique sparse index | `src/services/notifications/__tests__/notification-model.test.ts` | `🟢 Implemented` |
| **NOTF-8** | Substantive change diff engine for saved project updates | `src/services/notifications/procurement-diff.ts` | Diff evaluator | `src/services/notifications/__tests__/procurement-diff.test.ts` | `🟢 Implemented` |

### 2.8 Historical Price & Outlier Analytics (SRS Section 3.9 & 3.10: HIST-1 – HIST-7, OUTL-1 – OUTL-5)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **HIST-1** | Historical awarded contracts analytics by software category | `src/lib/historicalAnalytics.ts` | `GET /api/historical` | `src/lib/__tests__/historicalAnalytics.test.ts` | `🟢 Implemented` |
| **HIST-2** | Five-Number summary computation (Min, Q1, Median, Q3, Max) | `src/lib/historicalAnalytics.ts` | Quartile algorithms | `src/lib/__tests__/historicalAnalytics.test.ts` | `🟢 Implemented` |
| **HIST-3** | Mean budget calculation and project count aggregation | `src/lib/historicalAnalytics.ts` | Summary stats | `src/lib/__tests__/historicalAnalytics.test.ts` | `🟢 Implemented` |
| **HIST-4** | Interactive price distribution and quartile box plot | `src/components/historical/` | `Chart.js` visualizers | `src/components/historical/__tests__/HistoricalComponents.test.tsx` | `🟢 Implemented` |
| **HIST-5** | Contract price vs allocated budget spread (savings analysis) | `src/components/historical/` | Spread visualizer | `src/components/historical/__tests__/HistoricalComponents.test.tsx` | `🟢 Implemented` |
| **HIST-6** | Agency spending leaderboard across municipal departments | `src/components/historical/` | Department breakdown | `src/components/historical/__tests__/HistoricalComponents.test.tsx` | `🟢 Implemented` |
| **HIST-7** | Null-safe statistical handling for zero-budget or sparse categories | `src/lib/historicalAnalytics.ts` | Boundary guards | `src/lib/__tests__/historicalAnalytics.test.ts` | `🟢 Implemented` |
| **OUTL-1** | Interquartile Range (IQR) calculation ($\text{IQR} = Q_3 - Q_1$) | `src/lib/historicalAnalytics.ts` | Outlier engine | `src/lib/__tests__/historicalAnalytics.test.ts` | `🟢 Implemented` |
| **OUTL-2** | High outlier threshold gate ($\text{UpperBound} = Q_3 + 1.5 \times \text{IQR}$) | `src/lib/historicalAnalytics.ts` | Outlier flags | `src/lib/__tests__/historicalAnalytics.test.ts` | `🟢 Implemented` |
| **OUTL-3** | Low outlier threshold gate ($\text{LowerBound} = Q_1 - 1.5 \times \text{IQR}$) | `src/lib/historicalAnalytics.ts` | Outlier flags | `src/lib/__tests__/historicalAnalytics.test.ts` | `🟢 Implemented` |
| **OUTL-4** | Visual outlier warning banner on project detail and historical views | `src/components/historical/` | Warning banners | `src/components/historical/__tests__/HistoricalComponents.test.tsx` | `🟢 Implemented` |
| **OUTL-5** | Filter to isolate or suppress budget outliers in benchmarks | `src/app/historical/page.tsx` | Filter toggle | `src/components/historical/__tests__/HistoricalComponents.test.tsx` | `🟢 Implemented` |

### 2.9 Bookmark & User Preference Management (SRS Section 3.11 & 3.12: BOOK-1 – BOOK-5, PROF-1 – PROF-5)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **BOOK-1** | One-click bookmark toggle on opportunity cards and detail pages | `src/hooks/useBookmarks.ts` | `POST/DELETE /api/bookmarks` | `src/hooks/__tests__/useBookmarks.test.tsx` | `🟢 Implemented` |
| **BOOK-2** | Dedicated `/saved` page displaying personal watchlist | `src/app/saved/page.tsx` | `GET /api/bookmarks` | `src/app/saved/__tests__/page.test.tsx` | `🟢 Implemented` |
| **BOOK-3** | Strict user ownership isolation (IDOR protection on bookmarks) | `src/app/api/bookmarks/[id]/route.ts` | Compound query predicate | `src/app/api/bookmarks/__tests__/ownership.test.ts` | `🟢 Implemented` |
| **BOOK-4** | Duplicate bookmark suppression via MongoDB compound unique index | `src/models/Bookmark.ts` | Unique index | `src/app/api/bookmarks/__tests__/bookmarks.integration.test.ts` | `🟢 Implemented` |
| **BOOK-5** | Real-time optimistic bookmark UI updates | `src/hooks/useBookmarks.ts` | React Hook state | `src/hooks/__tests__/useBookmarks.test.tsx` | `🟢 Implemented` |
| **PROF-1** | User profile viewing (name, email, role, avatar) | `src/app/settings/page.tsx` | `GET /api/auth/me` | `src/lib/__tests__/authorization.test.ts` | `🟢 Implemented` |
| **PROF-2** | Configure notification preferences (in-app, email, closing alert, tags) | `src/app/settings/page.tsx` | `POST /api/notifications/preferences` | `src/services/notifications/__tests__/notification-preferences.test.ts` | `🟢 Implemented` |
| **PROF-3** | Set interest technology tags and budget brackets | `src/models/UserSettings.ts` | Preferences schema | `src/services/notifications/__tests__/notification-preferences.test.ts` | `🟢 Implemented` |
| **PROF-4** | Language toggle preference (Thai B.E. / English) | `src/contexts/LanguageContext.tsx` | Language switcher | `src/contexts/__tests__/LanguageContext.test.tsx` | `🟢 Implemented` |
| **PROF-5** | Clean light theme standardization (dark mode removed globally) | `src/app/globals.css` | Light CSS design tokens | `src/components/layout/__tests__/Sidebar.test.tsx` | `🟢 Implemented` |

### 2.10 Administration Panel & Ingestion Telemetry (SRS Section 3.13: ADMN-1 – ADMN-8)

| SRS Req ID | Requirement Description | Implementation Code | API Route / Component | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **ADMN-1** | Unified admin console restricted to `admin` role | `src/app/admin/page.tsx`<br>`src/middleware.ts` | `/admin` route guard | `src/app/api/admin/__tests__/admin-routes.integration.test.ts` | `🟢 Implemented` |
| **ADMN-2** | Always-visible header stats strip summarizing pipeline and triage queue | `src/app/admin/page.tsx` | `StatsStrip` component | `src/components/admin/__tests__/AdminPanel.test.tsx` | `🟢 Implemented` |
| **ADMN-3** | Split-pane project inspector drawer for side-by-side triage | `src/components/admin/ProjectInspectorDrawer.tsx` | `ProjectInspectorDrawer` | `src/components/admin/__tests__/ProjectInspectorDrawer.test.tsx` | `🟢 Implemented` |
| **ADMN-4** | Quick inline edits (English title, category, budget, status) | `src/app/api/admin/projects/[id]/route.ts` | `PUT /api/admin/projects/[id]` | `src/app/api/admin/__tests__/admin-routes.integration.test.ts` | `🟢 Implemented` |
| **ADMN-5** | One-click AI Thai-English translation trigger | `src/app/api/admin/translate/route.ts` | `POST /api/admin/translate` | `src/app/api/admin/translate/__tests__/route.test.ts` | `🟢 Implemented` |
| **ADMN-6** | Ingestion pipeline health telemetry across BMA, e-GP, and Data.go.th | `src/app/api/admin/sync-health/route.ts` | `GET /api/admin/sync-health` | `src/services/database/__tests__/sync-logs.test.ts` | `🟢 Implemented` |
| **ADMN-7** | Manual scraper trigger with source targeting | `src/app/api/ingestion/sync/route.ts` | `POST /api/ingestion/sync` | `src/services/ingestion/__tests__/api-endpoints.test.ts` | `🟢 Implemented` |
| **ADMN-8** | User account management and role administration | `src/app/api/admin/users/route.ts` | `GET/PUT /api/admin/users` | `src/app/api/admin/__tests__/admin-routes.integration.test.ts` | `🟢 Implemented` |

---

## 3. Non-Functional Requirements & Security Traceability

| NFR Category | Requirement & Code Location | Technical Controls & Verification Suite | Status |
|---|---|---|---|
| **Security (SEC-08 / ASVS V5)** | File Handling & PDF Validation<br>`src/services/ai/tor-extractor.ts`<br>`src/app/api/documents/[projectId]/[fileName]/route.ts` | • Rejects non-PDF extensions and checks `%PDF-` magic bytes.<br>• 25MB payload threshold.<br>• Path traversal rejected via `assertNoPathTraversal()`.<br>• Storage confined to private root outside web folders via `resolvePrivatePath()`.<br>• Verified: `src/app/api/documents/.../__tests__/containment-defense.test.ts` | `🟢 Verified` |
| **Security (SEC-17 / ASVS V12)** | Secure Communications & TLS<br>`src/middleware.ts`<br>`src/lib/security-headers.ts` | • Enforces TLS 1.2+ (`NODE_TLS_REJECT_UNAUTHORIZED=1`).<br>• Rejects unencrypted HTTP with HTTP 426 Upgrade Required.<br>• HSTS (`max-age=31536000; includeSubDomains; preload`).<br>• Verified: `src/lib/__tests__/tls.test.ts`<br>`src/lib/__tests__/security-headers.test.ts` | `🟢 Verified` |
| **Security (SEC-18 / ASVS V13)** | Configuration Hardening & Secrets<br>`src/lib/auth.ts`<br>`src/instrumentation.ts` | • Startup assertion: `SESSION_SECRET` $\ge 32$ chars, non-default.<br>• Multi-stage Docker build excludes all `.env*` files.<br>• Parameterized MongoDB connection pool (`MONGODB_MAX_POOL_SIZE=10`).<br>• Verified: `src/lib/__tests__/production-secrets.test.ts`<br>`src/__tests__/sec-19-environment-hardening.test.ts` | `🟢 Verified` |
| **Security (SEC-19 / ASVS V14)** | Data Protection & Cookie Hardening<br>`src/lib/auth.ts`<br>`src/lib/canonicalize.ts` | • `__Host-` session cookies (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`).<br>• `redactSensitiveData()` masks passwords, tokens, connection strings in logs.<br>• Verified: `src/lib/__tests__/cookie-security.test.ts`<br>`src/__tests__/sec-20-data-protection.test.ts` | `🟢 Verified` |
| **Security (SEC-20 / ASVS V15)** | Defensive Architecture & SSRF<br>`src/lib/ssrf.ts`<br>`src/lib/rate-limiter.ts` | • Strict outbound domain allowlist (`*.gprocurement.go.th`, `*.bangkok.go.th`, `*.data.go.th`).<br>• Blocks private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, loopbacks, metadata 169.254.169.254).<br>• Sliding-window rate limiter.<br>• Verified: `src/lib/__tests__/ssrf.test.ts`<br>`src/lib/__tests__/rate-limiter.test.ts` | `🟢 Verified` |
| **Security (SEC-22 / ASVS V16)** | Security Logging & CSP Reporting<br>`src/app/api/security/csp-report/route.ts`<br>`src/app/error.tsx` | • Production error boundaries return generic `{ error: "Internal Server Error" }`.<br>• Dedicated CSP reporting endpoint (`/api/security/csp-report`).<br>• Centralized audit logging for role updates and crawler triggers.<br>• Verified: `src/app/api/security/csp-report/__tests__/route.test.ts` | `🟢 Verified` |
| **Performance (PERF)** | Next.js 16 SSR & Connection Pooling<br>`src/lib/mongodb.ts` | • Mongoose client connection caching prevents socket exhaustion.<br>• Paginated API responses with compound MongoDB indexes.<br>• Verified: `src/services/database/__tests__/projects.integration.test.ts` | `🟢 Verified` |
| **Reliability (RELI)** | Crawler Fault Tolerance & DLQ<br>`src/services/resilience/retry-policy.ts` | • Exponential backoff on 5xx errors; dead-letter queue records failures in `SyncError`.<br>• Fail-secure cron endpoint authentication.<br>• Verified: `src/services/resilience/__tests__/retry-policy.test.ts` | `🟢 Verified` |
| **Usability & Localization (USAB/LOCL)** | Bilingual Support & Responsive UI<br>`src/contexts/LanguageContext.tsx` | • Full Thai (ภาษาไทย) and English toggle.<br>• Thai Buddhist Era calendar (`2569 ว/ด/ป`).<br>• Clean light theme without dark mode ambiguities.<br>• Verified: `src/contexts/__tests__/LanguageContext.test.tsx` | `🟢 Verified` |
