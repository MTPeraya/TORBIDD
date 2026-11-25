# 🔔 TORBIDD Notification Requirements & Subsystem Specification

[← Back to Wiki Home](Home) · [Feature Details](Feature-Details) · [Requirement Traceability](Requirement-Traceability) · [Use Case UC-6](uc-6-configure-and-receive-opportunity-alerts)

This document defines the requirements, architecture, event taxonomy, delivery rules, and email templates for the **TORBIDD Notification Subsystem** (SRS Section 3.8: NOTF-1 through NOTF-8, Use Case UC-6 / UC-11).

---

## 1. System Overview & Objectives

The TORBIDD Notification Subsystem proactively delivers actionable intelligence to technology vendors, bidding analysts, and administrative users:
1. **New Matching Procurement Opportunities**: Instant notification when a published tender matches configured category tags, technologies, and budget constraints.
2. **Saved Procurement Updates**: Immediate alerts when critical attributes (deadline, budget, status, TOR attachments) change on bookmarked/saved opportunities.
3. **Approaching Submission Deadlines**: Automated countdown reminders dispatched at 3 days (72 hours) and 24 hours prior to bid submission closing.
4. **Multi-Channel Delivery**: Real-time in-app notification feed paired with responsive, bilingual HTML email digests via SMTP.

---

## 2. Event Definitions & Taxonomy (`NotificationType`)

| Event Type | System Trigger | Target Audience | Priority | Deduplication / Window |
|---|---|---|---|---|
| `PROCUREMENT_MATCHED` | Ingestion and classification of a new software procurement tender | Users whose `interestTags` and `budgetRange` match | `MEDIUM` | Once per project per user |
| `PROCUREMENT_UPDATED` | Existing project record modified with meaningful diff (budget, deadline, price) | Users who bookmarked/saved the project | `HIGH` | 24 hours per content revision |
| `DEADLINE_APPROACHING` | Scheduled scan detects closing deadline within 72 hours or 24 hours | Users who bookmarked/saved the project | `URGENT` / `HIGH` | Once per reminder threshold |
| `STATUS_CHANGED` | Opportunity lifecycle state transition (`open` → `closingSoon` → `closed` / `awarded`) | Users who bookmarked/saved the project | `HIGH` | Once per status transition |
| `TOR_UPDATED` | Re-uploaded or amended TOR document detected, or AI clauses updated | Users who bookmarked/saved the project | `HIGH` | Once per TOR revision bump |

---

## 3. Procurement Matching Engine Rules

### 3.1 Matching Evaluation Criteria
A newly ingested opportunity triggers a match for a user if and only if **all three conditions** are satisfied:

1. **Category & Technology Alignment**:
   - The opportunity `category` (e.g. `Website`, `Mobile App`, `AI`, `Database`, `Cloud/Infra`) matches any tag in the user's `interestTags`.
   - **OR** any of the project's `requiredTechnologies` (e.g. `Cloud`, `Security`, `AI`, `IoT`, `Database`) matches user interest tags.
   - **OR** keywords in the procurement title/description intersect with user interest tags.
2. **Budget Threshold Compliance**:
   - If user specified `budgetMin`, the procurement `budget` must be $\ge$ `budgetMin`.
   - If user specified `budgetMax`, the procurement `budget` must be $\le$ `budgetMax`.
   - If either bound is unspecified (`null` or omitted), it is treated as unbounded.
3. **Preference Activation**:
   - The user must have enabled `newOpportunity` (or `newProjectAlert`) in their notification settings.

### 3.2 Negative Evaluation & Suppression
- If an opportunity does not meet both category and budget conditions, **no notification is generated**.
- Notifications are never broadcast to non-matching users.

---

## 4. Saved Procurement Update Rules

### 4.1 Meaningful Changes Classification
Only **substantive** changes trigger notifications for users who bookmarked the opportunity:

| Attribute | Meaningful Change Criteria | Notification Subtype | Priority |
|---|---|---|---|
| **Procurement Status** | Any transition between `open`, `closingSoon`, `closed`, `awarded`, or `cancelled` | `STATUS_CHANGED` | `HIGH` |
| **Submission Deadline** | Submission timestamp postponed or advanced by $\ge$ 1 day | `PROCUREMENT_UPDATED` | `HIGH` |
| **Approved Budget** | Budget altered by $> 0\%$ (any non-zero adjustment) | `PROCUREMENT_UPDATED` | `HIGH` |
| **Contract / Award Price** | Contract price recorded or revised | `PROCUREMENT_UPDATED` | `MEDIUM` |
| **TOR Documents** | New TOR attachment, document revision bump, or clause modification | `TOR_UPDATED` | `HIGH` |
| **Mandatory Qualifications** | Addition, deletion, or threshold change to mandatory qualification clauses | `TOR_UPDATED` | `HIGH` |

### 4.2 Minor / Internal Edits Suppression
The following changes **do not trigger notifications**:
- Internal sync timestamp updates (`processedDate`, `updatedAt` without field changes)
- Minor typographical fixes in descriptions where core parameters remain identical
- Re-syncing existing records with identical content hashes (`contentHash`)
- System metadata or crawler diagnostics updates

---

## 5. Deduplication & Idempotency Architecture

To prevent alert fatigue and duplicate notifications during continuous polling:

1. **Idempotency Key Pattern**:
   ```
   notif:<recipientId>:<eventType>:<procurementId>:<versionOrWindow>
   ```
   - *Example Match*: `notif:usr_123:PROCUREMENT_MATCHED:proj_67119538991:v1`
   - *Example Deadline*: `notif:usr_123:DEADLINE_APPROACHING:proj_67119538991:72h`
   - *Example Update*: `notif:usr_123:PROCUREMENT_UPDATED:proj_67119538991:rev2_deadline`

2. **Database Constraint**:
   - MongoDB collection `notifications` enforces a compound unique sparse index on `idempotencyKey`.
   - Duplicate creation attempts are caught and silently resolved without error.

3. **Rate Throttling**:
   - Maximum 1 update alert per saved procurement per user within a 1-hour window unless the priority is `URGENT`.

---

## 6. Multi-Channel Delivery Engine

### 6.1 In-App Notification Center (`/notifications`)
- **Feed Presentation**: Chronological notification feed ordered by `createdAt` descending.
- **Visual State**:
  - Unread items displayed with visual indicator (unread badge, subtle accent background, colored dot).
  - Read items displayed in subdued neutral styling.
- **User Actions**:
  - Individual "Mark as Read" action (`PATCH /api/notifications/[id]`).
  - Global "Mark all as Read" bulk action.
  - Deep-link navigation: clicking a notification navigates directly to `/opportunities/[id]`.

### 6.2 SMTP Email Delivery Service (`src/services/notifications/email-delivery-service.ts`)
- **Transporter**: Built with `nodemailer` utilizing standard SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).
- **Templates** (`src/services/notifications/email-templates.ts`):
  1. **Opportunity Alert**: Surfaces title, issuing agency, budget in Thai Baht (฿), deadline with Buddhist Era date format, category tags, and direct view CTA button.
  2. **Deadline Reminder**: Highlights remaining time (e.g. "3 Days Remaining" or "24 Hours Left"), project title, agency, and submission instructions.
- **Responsive HTML**: Styled with clean inline CSS, high-contrast typography, and accessible design matching the platform theme.

---

## 7. Automated Deadline Scanner Cron (`POST /api/cron/deadline-reminders`)

The platform executes a background cron task (configured via external cron or GitHub Actions) to scan upcoming deadlines:
- **Authentication**: Strict fail-secure Bearer token check (`Authorization: Bearer <CRON_SECRET>`). If `CRON_SECRET` is unset in production, returns `503 Service Unavailable`.
- **Query Logic**:
  - Identifies active bookmarked projects where `submissionDeadline` falls within $[now, now + 72\text{h}]$.
  - Evaluates whether a 72-hour or 24-hour reminder was previously sent using the idempotency key.
  - Creates in-app notifications and queues SMTP email delivery for affected users.

---

## 8. Verification & Test Coverage

The notification subsystem is verified by comprehensive automated test suites:
- `src/services/notifications/__tests__/email-delivery.test.ts`: Verifies Nodemailer transporter creation, template HTML rendering, and error handling.
- `src/services/notifications/__tests__/procurement-matching.test.ts`: Tests matching engine rules against category, budget, and preference combinations.
- `src/services/notifications/__tests__/deadline-scanner.test.ts`: Asserts reminder triggers at 72h and 24h thresholds with idempotency.
- `src/services/notifications/__tests__/diff-and-scheduled-notifications.integration.test.ts`: End-to-end integration across project diffing, alert generation, and notification feed.
- `src/components/notifications/__tests__/NotificationComponents.test.tsx`: Validates UI rendering, unread badges, and mark-as-read interactions.
