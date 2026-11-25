# 🏛️ Architecture Decision Records (ADRs)

[← Back to Wiki Home](Home)

This document records the formal architectural and technical decisions made for the **TORBIDD** platform, directly derived from client progress updates and confirmed requirements.

---

## 📋 ADR Index

| ID | Title | Status | Date | Decision Summary |
|---|---|---|---|---|
| [ADR-001](#adr-001-five-pillar-data-model-for-tor-extraction-bid--no-bid-decision-sheet) | Five-Pillar Data Model for TOR Extraction (Bid / No-Bid Decision Sheet) | `🟢 Accepted` | 2026-10-08 | Structure the extraction of ~50-page government TOR documents into 5 core business pillars for bid evaluation. |
| [ADR-002](#adr-002-dual-date-and-fiscal-timeline-representation) | Dual Date and Fiscal Timeline Representation | `🟢 Accepted` | 2026-10-08 | Explicitly separate Thai fiscal year from calendar year, submission deadlines, and delivery milestones. |
| [ADR-003](#adr-003-classification-scope-for-software-related-procurement-and-licenses) | Classification Scope for Software-Related Procurement & Licenses | `🟢 Accepted` | 2026-10-08 | Include software licenses, subscriptions, and SaaS alongside core software development categories. |
| [ADR-004](#adr-004-modular-ai-provider-architecture) | Modular AI Provider Architecture | `🟢 Accepted` | 2026-10-01 | Encapsulate AI document processing in an isolated, modular layer to allow provider replacement/fallback without affecting other components. |
| [ADR-005](#adr-005-tor-document-as-mandatory-source-document-and-resilience-handling) | TOR Document as Mandatory Source Document & Resilience Handling | `🟢 Accepted` | 2026-10-08 | Treat the TOR document as the mandatory source of truth, provide original document access, and handle missing/corrupted files gracefully. |

---

## ADR-001: Five-Pillar Data Model for TOR Extraction (Bid / No-Bid Decision Sheet)

- **Status**: `🟢 Accepted` (Confirmed by client on 8 October 2026)
- **Date**: 2026-10-08
- **Deciders**: Client & TORBIDD Development Team
- **Technical Area**: Domain Data Modeling & Document Extraction

### Context & Problem Statement
Government procurement and Terms of Reference (TOR) documents are dense legal files (often ~50 pages long). Technical vendors, company leadership, sales teams, and tech leads need a clear, actionable way to quickly evaluate opportunities without manually reading through extensive documents.

### Decision Drivers
- High-level business perspective needed for executive Go/No-Go decisions.
- Clear separation between financial feasibility, technical delivery capabilities, and legal compliance.
- Structured output that can be populated reliably via automated document extraction.

### Considered Options
1. **Unstructured / Generic Document Summary**:
   - Free-form text summaries of the PDF.
   - *Rejected*: Inconsistent, difficult to query, and fails to guarantee that critical legal and financial gates are surfaced.
2. **Five Core Business Pillars (Bid / No-Bid Decision Sheet)**:
   - Organize all extracted data into 5 distinct evaluation pillars.
   - *Accepted*: Validated and confirmed by the client as satisfying business evaluation needs.

### Decision Outcome
**Chosen Option: Organize the TOR extraction model into Five Core Business Pillars:**

1. **Commercial & Financial Profile**:
   - Allocated Budget & Median Price (*งบประมาณ / ราคากลาง*)
   - Procuring Agency (*หน่วยงานเจ้าของโครงการ*)
   - Fiscal Year (*ปีงบประมาณ*)
   - Procurement Method (*วิธีการจัดซื้อจัดจ้าง*, e.g., open e-bidding, selective, specific invitation)
2. **Executive Scope & Strategic Objectives**:
   - Executive Summary (objectives, target beneficiaries, contract duration)
   - Work Scope (*ขอบเขตงาน*: deployment, software licenses, data migration, training, warranty)
   - Contract Period
   - Maintenance Terms
3. **Technical Fit & Delivery Feasibility**:
   - Core Technology Stack (e.g., DICOM 3.0, HL7, Kubernetes, NGFW, Oracle)
   - Technical Compliance Checklist
   - Availability & Service Level Agreement (SLA) (uptime and incident response times)
   - Support Window (e.g., 24/7 emergency support vs. standard business hours)
   - Maintenance Conditions (inclusion/exclusion of spare parts)
   - Regulatory Compliance (PDPA, Computer Crime Act, ISO 27001)
4. **Bidder Qualification & Compliance Gates**:
   - **Legal Gate**: Thai business registration, government procurement blacklist checks
   - **Experience Gate**: Past performance within domain and specified timeframe
   - **Financial Gate**: Minimum paid-up capital, audited financial standing
   - **Technical Gate**: Organizational certifications (ISO/IEC 29110, CMMI Level 3+), professional staff qualifications
5. **Bid Submission & Execution Roadmap**:
   - Announcement Date
   - Document Purchase & Download Window
   - Bid Submission Deadline (Exact closing date and time)
   - Contract Award & Project Kickoff timeline
   - Delivery Milestones

### Consequences
- **Positive**: Provides a standardized executive summary; drastically reduces bid qualification evaluation time; client confirmed satisfaction with this structure.
- **Negative / Trade-off**: Requires fine-grained parsing prompts and schemas to reliably populate all five pillars from varied government PDF layouts.

---

## ADR-002: Dual Date and Fiscal Timeline Representation

- **Status**: `🟢 Accepted` (Evolved from *Needs Confirmation* on Oct 1 to *Confirmed* on Oct 8)
- **Date**: 2026-10-08
- **Deciders**: Client & TORBIDD Development Team
- **Technical Area**: Data Schema & Date Handling

### Context & Problem Statement
In Thai public procurement, project timing involves multiple overlapping temporal concepts: the Thai fiscal year (*ปีงบประมาณ*), the calendar year, the bidding submission window, and the multi-stage implementation timeline. During the 1 October meeting, the client stressed the critical importance of these dates.

### Decision Drivers
- Thai government fiscal years run from October 1 to September 30 and often differ from calendar years.
- Bidders face hard disqualification if closing dates/times are missed.
- Revenue forecasting requires tracking both budget fiscal year and post-award delivery milestones.

### Decision Outcome
**Model distinct, explicit date entities across the platform:**
1. **Commercial Fiscal Year**: Stored explicitly as `fiscalYear` (e.g., 2569 / 2570) under the Commercial & Financial Profile.
2. **Bid Submission Deadline (Closing Date & Time)**: High-priority, exact timestamp field extracted into the Bid Submission Roadmap and surfaced on search feeds.
3. **Procurement Window Stages**: Distinct fields for Announcement Date, Document Purchase/Download Window, Contract Award, Kickoff, and Delivery Milestones.

### Consequences
- **Positive**: Eliminates confusion between calendar year publication and fiscal budget accounting; gives vendors clear milestone countdowns.
- **Negative / Trade-off**: Ingestion must parse both Buddhist Era (B.E.) and Gregorian dates with varied time-string formats.

---

## ADR-003: Classification Scope for Software-Related Procurement & Licenses

- **Status**: `🟢 Accepted` (Confirmed on 8 October 2026)
- **Date**: 2026-10-08
- **Deciders**: Client & TORBIDD Development Team
- **Technical Area**: Filtering & Opportunity Classification

### Context & Problem Statement
Government tenders frequently bundle software with hardware or classify pure software under broader procurement terms. The team needed to define what falls within TORBIDD's scope, specifically regarding software licenses, subscriptions, and SaaS.

### Decision Drivers
- Avoiding irrelevant tenders (pure civil construction or generic office supplies).
- Ensuring modern cloud subscriptions, enterprise licenses, and software maintenance services are not excluded.

### Decision Outcome
**Include software licenses and subscriptions as first-class software-related procurement:**
- Core software categories: Website development, Mobile applications, Information systems, AI solutions, Database systems, and Software maintenance.
- Software licenses, subscriptions, SaaS, and related maintenance obligations are explicitly classified as software-related procurement under the **Work Scope** and **Commercial Profile**.

### Consequences
- **Positive**: Captures high-value software licensing and SaaS tenders; matches vendor bidding interests.
- **Negative / Trade-off**: Classification models must distinguish between pure hardware tenders with incidental software and genuine software subscription tenders.

---

## ADR-004: Modular AI Provider Architecture

- **Status**: `🟢 Accepted` (Established on 1 October 2026)
- **Date**: 2026-10-01
- **Deciders**: TORBIDD Engineering Team
- **Technical Area**: AI System Architecture

### Context & Problem Statement
Google Cloud Vertex AI is specified as the primary AI service for TOR PDF document processing, information extraction, and classification. However, the system requires architectural flexibility to evaluate alternative AI providers or fallbacks without coupling business logic to a single vendor.

### Decision Drivers
- Prevent tight coupling to proprietary AI SDKs.
- Support alternative AI providers as potential replacements or fallback options.
- Maintain seamless developer workflows and testing when external cloud AI services are unavailable.
- The choice of AI provider must remain an internal architectural detail not exposed to end users.

### Decision Outcome
**Implement a modular AI service interface (`src/services/ai/`):**
- System components interact with AI extraction and classification through an abstract service interface.
- Google Cloud Vertex AI acts as the primary production provider.
- Alternative providers or fallback implementations can be swapped behind this interface without changing route handlers, UI components, or data schemas.

### Consequences
- **Positive**: High architectural resilience; enables local mock/fallback testing; clean separation of concerns.
- **Negative / Trade-off**: Output schemas must be strictly standardized (e.g., via typed JSON schemas) to ensure alternative models return identical data structures.

---

## ADR-005: TOR Document as Mandatory Source Document & Resilience Handling

- **Status**: `🟢 Accepted` (Confirmed on 1 October & 8 October 2026)
- **Date**: 2026-10-08
- **Deciders**: Client & TORBIDD Development Team
- **Technical Area**: Data Integrity & Error Resilience

### Context & Problem Statement
The TOR document is the single authoritative source containing legal gates, technical requirements, and submission deadlines. However, third-party government websites occasionally have missing, delayed, unreadable, or corrupted TOR files.

### Decision Drivers
- Users must be able to inspect and verify claims against the original government source document.
- The system must remain resilient and not crash when government portals provide broken or delayed attachments.

### Decision Outcome
1. **Mandatory Source Status**: Every processed procurement opportunity treats the official TOR PDF as its primary source document.
2. **Direct Source Access**: The user interface must provide a direct link to view/download the original government TOR document on the procurement detail page.
3. **Resilience & Graceful Degradation Handling**:
   - If a TOR is **not available or temporarily unreadable**, the system logs the state (`SyncError` / status flag) and surfaces available announcement metadata with a clear *Insufficient Information / Awaiting TOR* indicator.
   - Opportunities are not discarded, but Bid/No-Bid Decision Gates that depend on TOR text are marked as *Pending Document Verification*.

### Consequences
- **Positive**: Preserves transparency and trust; allows users to independently audit AI-extracted gates against the original document; prevents ingestion pipeline halts.
- **Negative / Trade-off**: Requires fallback UI presentation when full five-pillar data is incomplete.