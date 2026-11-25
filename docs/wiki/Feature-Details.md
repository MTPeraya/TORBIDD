# 🧩 Feature Details & Specifications

[← Back to Wiki Home](Home) · [Use Case Documentation](Use-Case-Documentation) · [Requirement Traceability](Requirement-Traceability) · [API Documentation](API-Documentation)

This document provides in-depth technical and functional specifications for the core features powering the **TORBIDD** platform. Each feature breakdown covers its architecture, Mongoose schemas, API route contracts, business rules, and error-handling strategies.

---

## 📑 Feature Master Matrix

| Feature ID | Feature Name | Primary Module / Service | SRS Mapping | Related Use Case | Priority | Status |
|---|---|---|---|---|---|---|
| [FEAT-01](FEAT‐01-Real‐Time-Procurement-Discovery-&-Search-Feed) | Real-Time Procurement Discovery & Search Feed | `procurement-search.ts`, `procurement-filter.ts` | 3.3, 3.4 | UC-2, UC-3 | `High` | `🟢 Stable` |
| [FEAT-02](FEAT‐02-AI-TOR-Document-Extraction-&-Classification) | AI TOR Document Extraction & Classification | `services/ai/`, `services/ingestion/` | 3.5, 3.6 | UC-4 | `High` | `🟢 Stable` |
| [FEAT-03](FEAT‐03-Procurement-Detail-Viewer-&-Bid-No‐Bid-Decision-Sheet) | Detail Viewer & Bid/No-Bid Decision Sheet | `ProcurementProject.ts`, `/projects/[id]` | 3.7 | UC-5 | `High` | `🟢 Stable` |
| [FEAT-04](FEAT‐04-Historical-Price-Benchmarking-&-Outlier-Engine) | Historical Price Benchmarking & Outlier Engine | `HistoricalProject.ts`, `/api/historical` | 3.9, 3.10 | UC-7 | `High` | `🟢 Stable` |
| [FEAT-05](FEAT‐05-Proactive-Notification-&-Bookmark-Engine) | Proactive Notification & Bookmark Engine | `services/notifications/`, `Bookmark.ts` | 3.8, 3.11, 3.12 | UC-6, UC-8 | `Medium` | `🟢 Stable` |
| [FEAT-06](FEAT‐06-Administration-Panel-&-Ingestion-Audit-Monitoring) | Administration Panel & Ingestion Audit | `SyncLog.ts`, `SyncError.ts`, `/admin` | 3.13 | UC-9 | `Medium` | `🟢 Stable` |

---
