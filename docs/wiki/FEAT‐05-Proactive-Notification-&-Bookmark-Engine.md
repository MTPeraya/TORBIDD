## FEAT-05: Proactive Notification & Bookmark Engine
[← Back to Feature Details](Feature-Details)

### 1. Overview & Purpose
Monitors incoming tenders and status updates, immediately alerting vendors when an opportunity matches their technical capabilities, budget thresholds, or bookmarked watchlists.

### 2. Architecture & Components
- **Services**:
  - `src/services/notifications/matching-engine.ts`
  - `src/services/notifications/email-digest-service.ts`
  - `src/services/procurement-diff.ts`
- **Primary Models**: `Notification.ts`, `Bookmark.ts`, `UserSettings.ts`
- **Route Handlers**: `GET/POST/DELETE /api/bookmarks`, `GET/PUT /api/settings`

### 3. Event Types & Evaluation Triggers

| Event Trigger | Trigger Condition | Target Audience | Delivery Mode |
|---|---|---|---|
| `PROCUREMENT_MATCHED` | Ingestion of a new active software tender | Users whose `interestTags` and `budgetRange` match | In-App & Email |
| `PROCUREMENT_UPDATED` | Existing project record modified with critical diff | Users with saved bookmark | In-App & Email |
| `DEADLINE_APPROACHING` | 3 days and 24 hours prior to submission closing | Users with saved bookmark | In-App (Urgent) & Email |
| `STATUS_CHANGED` | Opportunity transitions (e.g., Open  Closed) | Users with saved bookmark | In-App |
| `TOR_UPDATED` | Re-uploaded or amended TOR document detected | Users with saved bookmark | In-App & Email |

### 4. User Preference Settings Contract
```json
{
  "emailNotif": true,
  "dailyDigest": true,
  "closingAlert": true,
  "newProjectAlert": true,
  "interestTags": ["AI", "Website", "Cloud"],
  "budgetMin": 2000000,
  "budgetMax": 15000000,
  "language": "th"
}
```

---
