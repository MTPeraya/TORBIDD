# Requirement Traceability Matrix (RTM)

## 1. Traceability Workflow

TORBIDD enforces bidirectional traceability across the entire engineering lifecycle:

$$\text{Customer Need} \longrightarrow \text{Stakeholder} \longrightarrow \text{User Story} \longrightarrow \text{SRS Requirement} \longrightarrow \text{Implementation} \longrightarrow \text{Test Suite}$$

---

## 2. Requirement Traceability Matrix

| Stakeholder & Need | User Story | SRS Req ID | Implementation Code | Verification Test Suite | Status |
|---|---|---|---|---|---|
| **Tech Vendor**: Discover Thai government software tenders | As a vendor, I want to view active software procurement opportunities filtered by budget and category. | **FR-01** (Browse & Filter) | `app/opportunities/page.tsx`<br>`services/procurement-filter.ts` | `src/services/__tests__/procurementFilter.test.ts` | **Implemented** |
| **Tech Vendor**: Search across BMA departments | As a vendor, I want full-text search across project titles and agency names. | **FR-02** (Full-Text Search) | `app/api/projects/route.ts`<br>`ProcurementProject.ts` | `src/components/procurement-filters/__tests__/` | **Implemented** |
| **Bidding Manager**: Evaluate qualification requirements | As a bidder, I want to review extracted TOR clauses in a Go/No-Go checklist. | **FR-03** (TOR Extraction) | `components/ui/EligibilityChecklist.tsx`<br>`services/ai/tor-extractor.ts` | `src/services/ai/__tests__/tor-extractor.test.ts` | **Implemented** |
| **Pricing Analyst**: Evaluate budget fairness | As an analyst, I want to compare budgets against historical category medians. | **FR-04** (Historical Benchmarks) | `app/historical/page.tsx`<br>`src/lib/historicalAnalytics.ts` | `src/lib/__tests__/historicalAnalytics.test.ts` | **Implemented** |
| **Tech Vendor**: Save tenders for later review | As a user, I want to bookmark projects and see them in real time. | **FR-05** (Bookmarks) | `hooks/useBookmarks.ts`<br>`app/saved/page.tsx` | `src/hooks/__tests__/useBookmarks.test.tsx` | **Implemented** |
| **Tech Vendor**: Get deadline reminders | As a user, I want alerts when saved tenders are closing in 72 hours. | **FR-06** (Notifications) | `services/notifications/deadline-scanner.ts`<br>`app/notifications/page.tsx` | `src/services/notifications/__tests__/deadline-scanner.test.ts` | **Implemented** |
| **System Admin**: Audit crawler and AI accuracy | As an admin, I want to review low-confidence classifications and trigger syncs. | **FR-07** (Admin Console) | `app/admin/page.tsx`<br>`components/admin/ClassificationReviewPanel.tsx` | `src/components/admin/__tests__/AdminPanel.test.tsx` | **Implemented** |
| **Compliance**: Reliable uptime & data parsing | System must gracefully retry when government endpoints are slow or failing. | **NFR-01** (Fault Tolerance) | `services/resilience/retry-policy.ts`<br>`models/SyncError.ts` | `src/services/resilience/__tests__/retry-policy.test.ts` | **Implemented** |
| **User**: Full Thai & English accessibility | Interface must support Thai B.E. dates and light/dark theme toggle. | **NFR-02** (Bilingual & Theming) | `contexts/LanguageContext.tsx`<br>`contexts/ThemeContext.tsx` | `src/lib/__tests__/utils.test.ts` | **Implemented** |