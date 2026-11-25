## FEAT-05: Proactive Notification & Bookmark Engine
[← Back to Feature Details](Feature-Details) · [Notification Specification](Notification-Requirements) · [API Specification](6-notifications-subsystem)

### 1. Overview & Purpose
Continuously monitors incoming tenders, status transitions, and document amendments, alerting vendors when an opportunity matches their technical tags, budget thresholds, or bookmarked watchlists.

### 2. Architecture & Components
- **Services**:
  - `src/services/notifications/matching-engine.ts`: Evaluates project attributes against user preferences.
  - `src/services/notifications/email-delivery-service.ts`: Dispatches transactional HTML emails via Nodemailer SMTP.
  - `src/services/notifications/email-templates.ts`: Responsive HTML templates for Opportunity Alerts and Deadline Reminders.
  - `src/services/notifications/deadline-scanner.ts`: Scans upcoming submission closing dates.
  - `src/services/notifications/procurement-diff.ts`: Detects substantive revisions to bookmarked tenders.
- **Primary Models**: `Notification.ts`, `Bookmark.ts`, `UserSettings.ts`
- **Route Handlers**:
  - `GET /api/notifications`: Feed of user notifications.
  - `PATCH /api/notifications/[id]`: Mark notification as read.
  - `POST /api/notifications/preferences`: Save notification preferences.
  - `POST /api/cron/deadline-reminders`: Cron-triggered deadline evaluation.
  - `GET/POST/DELETE /api/bookmarks`: User saved opportunities.

### 3. Event Types & Evaluation Triggers

| Event Trigger | Trigger Condition | Target Audience | Delivery Mode |
|---|---|---|---|
| `PROCUREMENT_MATCHED` | Newly ingested active software tender | Users whose `interestTags` and `budgetRange` match | In-App & Email |
| `PROCUREMENT_UPDATED` | Existing project record modified with critical diff | Users with saved bookmark | In-App & Email |
| `DEADLINE_APPROACHING` | 72 hours and 24 hours prior to submission closing | Users with saved bookmark | In-App (Urgent) & Email |
| `STATUS_CHANGED` | Opportunity transitions (`open` → `closingSoon` → `closed` / `awarded`) | Users with saved bookmark | In-App |
| `TOR_UPDATED` | Re-uploaded or amended TOR document detected | Users with saved bookmark | In-App & Email |

### 4. Deduplication & Idempotency Key
To eliminate duplicate alerts during automated cron iterations, every notification uses a deterministic idempotency key enforced via a MongoDB unique sparse index:
```
notif:<recipientId>:<eventType>:<procurementId>:<versionOrWindow>
```

### 5. Multi-Channel Email Service
- **Nodemailer SMTP Transporter**: Configured with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`.
- **Templates**:
  - **Opportunity Alert**: Surfaces title, issuing agency, budget formatted in Thai Baht (฿), deadline with Buddhist Era date format, category badges, and direct CTA link.
  - **Deadline Reminder**: Highlights remaining countdown (72h / 24h), tender title, agency, and submission guidelines.
- **CLI Test Utility**: `torbidd-app/scripts/test-email.ts` for end-to-end verification of SMTP credentials and template rendering.

### 6. Automated Verification
- `src/services/notifications/__tests__/email-delivery.test.ts`: Verifies email dispatch, mock transporter, and HTML generation.
- `src/services/notifications/__tests__/procurement-matching.test.ts`: Tests matching criteria and negative suppression.
- `src/services/notifications/__tests__/deadline-scanner.test.ts`: Confirms 72h and 24h scan triggers.
- `src/services/notifications/__tests__/diff-and-scheduled-notifications.integration.test.ts`: Full integration test from diff detection to notification record.
