# TORBIDD Notification Requirements & Specification
**Use Case UC-11: Procurement Notifications**  
**Subtasks:** Issues #132, #133, #134, #135, #136, #137, #140

---

## 1. System Overview & Objectives
The TORBIDD Notification Subsystem proactively informs technology vendors, BMA officers, and business users about:
1. **New Matching Procurement Opportunities** matching their configured interests, technology categories, and budget constraints.
2. **Saved Procurement Updates** when critical information changes on opportunities they have bookmarked/saved.
3. **Approaching Submission Deadlines** to ensure timely preparation and proposal submission.

---

## 2. Event Definitions & Triggers

### 2.1 Event Types (`NotificationType`)

| Event Type | System Trigger | Target Audience | Priority | Deduplication Window |
|---|---|---|---|---|
| `PROCUREMENT_MATCHED` | Newly published procurement record ingested into the platform | Users with matching interest tags / budget criteria and active opportunity alerts | `MEDIUM` | Once per project per user |
| `PROCUREMENT_UPDATED` | Existing procurement record updated with meaningful changes | Users who have bookmarked/saved the procurement | `HIGH` | 24 hours per content revision |
| `DEADLINE_APPROACHING` | Saved procurement submission deadline is 3 days or 24 hours away | Users who have saved the procurement | `URGENT` / `HIGH` | Once per reminder threshold |
| `STATUS_CHANGED` | Procurement lifecycle status transition (e.g. open -> closingSoon -> closed / cancelled) | Users who have saved the procurement | `HIGH` | Once per status transition |
| `TOR_UPDATED` | TOR document amended, re-uploaded, or AI clauses updated | Users who have saved the procurement | `HIGH` | Once per TOR revision |

---

## 3. Procurement Matching Engine Rules (Issue #134)

### 3.1 Matching Evaluation Criteria
A new procurement matches a user if:
1. **Category & Technology Alignment**:
   - The procurement `category` (e.g., `Website`, `Mobile App`, `AI`, `Database`) matches any of the user's `interestTags`.
   - OR any of the procurement's `requiredTechnologies` (e.g., `Cloud`, `Security`, `AI`, `IoT`, `Database`) matches user interest tags.
   - OR keywords in procurement title/description match user interest tags.
2. **Budget Threshold Compliance**:
   - If user specified `budgetMin`, the procurement `budget` must be $\ge$ `budgetMin`.
   - If user specified `budgetMax`, the procurement `budget` must be $\le$ `budgetMax`.
   - If either bound is unspecified (`null`), it is treated as unbounded.
3. **Preference Activation**:
   - The user must have enabled `newOpportunity` (or `newProjectAlert`) in their notification preferences.

### 3.2 Negative Evaluation (Alternative Flow A1)
- If a procurement does not meet both category and budget conditions, **no notification is generated**.
- Notifications are never broadcast to non-matching users.

---

## 4. Saved Procurement Update Rules (Issue #135 & #140)

### 4.1 Meaningful Changes Classification
Only **substantive** changes trigger notifications for users who saved the procurement.

| Attribute | Meaningful Change Criteria | Notification Subtype | Priority |
|---|---|---|---|
| **Procurement Status** | Any transition between `open`, `closingSoon`, `closed`, `awarded`, or `cancelled` | `STATUS_CHANGED` | `HIGH` |
| **Submission Deadline** | Submission date postponed or advanced by $\ge$ 1 day | `PROCUREMENT_UPDATED` | `HIGH` |
| **Approved Budget** | Budget altered by $> 0\%$ (any non-zero adjustment) | `PROCUREMENT_UPDATED` | `HIGH` |
| **Contract / Award Price** | Contract price recorded or revised | `PROCUREMENT_UPDATED` | `MEDIUM` |
| **TOR Documents** | New TOR attachment, document revision bump, or clause modification | `TOR_UPDATED` | `HIGH` |
| **Mandatory Qualifications** | Addition, deletion, or threshold change to mandatory qualification clauses | `TOR_UPDATED` | `HIGH` |

### 4.2 Minor / Internal Edits (Suppression Rules - Alternative Flow A2)
The following changes **do not trigger notifications**:
- Internal sync timestamp updates (`processedDate`, `updatedAt` without field changes)
- Minor typographical fixes in descriptions where core parameters remain identical
- Re-syncing existing records with identical content hashes (`contentHash`)
- System metadata / crawler diagnostics updates

---

## 5. Deduplication & Idempotency Rules

To prevent alert fatigue and duplicate notifications during automated synchronizations:
1. **Idempotency Key Pattern**:
   ```
   notif:<recipientId>:<eventType>:<procurementId>:<versionOrWindow>
   ```
   - *Example Match*: `notif:usr_123:PROCUREMENT_MATCHED:proj_67119538991:v1`
   - *Example Update*: `notif:usr_123:PROCUREMENT_UPDATED:proj_67119538991:rev2_deadline`
2. **Deduplication Check**:
   - Check existing notifications with the identical idempotency key before inserting.
   - Enforce a compound unique sparse index on `idempotencyKey` in MongoDB.
3. **Throttling & Sliding Windows**:
   - Maximum 1 update alert per saved procurement per user within a 1-hour window unless the priority is `URGENT`.

---

## 6. Notification Center UI & UX (Issue #136)

- **Feed Presentation**: Chronological notification feed ordered by `createdAt` descending.
- **Visual State**:
  - Unread items displayed with visual indicator (unread badge, subtle accent background, colored dot).
  - Read items displayed in subdued neutral styling.
- **User Actions**:
  - Individual "Mark as Read" action.
  - Global "Mark all as Read" bulk action.
  - Deep-link navigation: clicking a notification navigates directly to `/opportunities/[id]`.
- **States & Resilience**:
  - Loading: Animated skeletons.
  - Empty State: Friendly illustration and prompt to explore opportunities or configure preferences.
  - Error State: Error banner with retry button.

---

## 7. Notification Preferences (Issue #137)

Users can customize their delivery preferences:
1. **Category Toggles**:
   - `newOpportunity`: Notifications for interest-matched new procurements.
   - `savedUpdate`: Notifications for updates to bookmarked/saved items.
   - `deadlineReminder`: Alerts for approaching submission deadlines.
   - `emailNotif`: Outbound email notifications.
   - `dailyDigest`: 08:00 AM daily briefing digest.
2. **Targeting Filters**:
   - `interestTags`: Selected software technology categories.
   - `budgetMin` / `budgetMax`: Filtered budget boundaries.
3. **Immediate Application**:
   - Settings persist immediately to database and local cache.
   - In-memory dispatch pipeline checks saved preferences before delivery.
