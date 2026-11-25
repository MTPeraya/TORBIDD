## 6. Notifications Subsystem

[← Back to API Directory](API-Documentation) · [Notification Specification](Notification-Requirements) · [Feature Details](FEAT‐05-Proactive-Notification-&-Bookmark-Engine)

The Notifications Subsystem provides RESTful endpoints to read in-app alerts, mark items as read, update user notification preferences, and trigger scheduled deadline scans.

---

### `GET /api/notifications`
Retrieves recent in-app notifications for the authenticated user, ordered by creation date descending.

- **Authentication**: Required (`__Host-` session cookie)
- **Query Parameters**:
  - `unreadOnly=true` *(boolean, optional)*: Filter for unread notifications only.
  - `limit=20` *(number, optional)*: Maximum items to return (default: 50).
- **Response (`200 OK`)**:
  ```json
  {
    "data": [
      {
        "_id": "672fb01b8e90a...",
        "recipientId": "usr_671195...",
        "type": "DEADLINE_APPROACHING",
        "title": "Deadline Reminder: 3 Days Remaining",
        "message": "Submission for AI Traffic Analytics closes on 20 Nov 2026.",
        "projectId": "6724a8f9...",
        "isRead": false,
        "createdAt": "2026-11-17T10:00:00.000Z"
      }
    ],
    "unreadCount": 1
  }
  ```

---

### `PATCH /api/notifications/[id]`
Marks a specific in-app notification as read. Ownership is strictly verified against the authenticated user's ID.

- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "isRead": true
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "data": {
      "_id": "672fb01b8e90a...",
      "isRead": true,
      "updatedAt": "2026-11-25T20:15:00.000Z"
    }
  }
  ```

---

### `POST /api/notifications/preferences`
Saves or updates the user's notification preferences, interest technology tags, and budget alert thresholds.

- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "emailNotif": true,
    "dailyDigest": true,
    "closingAlert": true,
    "newOpportunity": true,
    "interestTags": ["AI", "Website", "Cloud"],
    "budgetMin": 1000000,
    "budgetMax": 20000000
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "message": "Notification preferences updated successfully",
    "data": { ... }
  }
  ```

---

### `POST /api/cron/deadline-reminders`
Background cron endpoint invoked to scan upcoming project deadlines ($\le 72$ hours and $\le 24$ hours) and dispatch notifications with idempotency protection.

- **Authentication**: Strict Bearer token check (`Authorization: Bearer <CRON_SECRET>`). Returns `503 Service Unavailable` if `CRON_SECRET` is unset in production; returns `401 Unauthorized` on missing/invalid token.
- **Rate Limit**: 10 requests / minute per client IP.
- **Response (`200 OK`)**:
  ```json
  {
    "scanned": 48,
    "notificationsCreated": 4,
    "emailsDispatched": 4,
    "errors": 0
  }
  ```

---

### `POST /api/notifications/trigger-evaluation`
Internal evaluation hook triggered after newly ingested projects are classified, matching projects against all user preferences.

- **Authentication**: Internal / Admin session required.
- **Response (`200 OK`)**:
  ```json
  {
    "evaluatedProjects": 12,
    "matchedNotifications": 5
  }
  ```
