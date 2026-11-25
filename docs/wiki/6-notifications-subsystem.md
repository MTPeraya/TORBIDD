## 6. Notifications Subsystem

### `GET /api/notifications`
Retrieves recent in-app notifications for the authenticated user.

- **Query Parameters**: `unreadOnly=true` *(boolean, optional)*
- **Response (`200 OK`)**:
  ```json
  {
    "data": [
      {
        "_id": "672fb01...",
        "type": "DEADLINE_APPROACHING",
        "title": "Deadline Reminder: 3 Days Remaining",
        "message": "Submission for AI Traffic Analytics closes on 20 Nov 2026.",
        "projectId": "6724a8f9...",
        "isRead": false,
        "createdAt": "2026-11-17T10:00:00.000Z"
      }
    ]
  }
  ```

### `PATCH /api/notifications/[id]`
Marks an in-app notification as read (`{ "isRead": true }`).

### `POST /api/cron/deadline-reminders`
Invoked via scheduled cron job to evaluate upcoming deadlines and dispatch email/in-app alert digests.
