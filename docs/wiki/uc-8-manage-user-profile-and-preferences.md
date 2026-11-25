## 3.11 Bookmarks & 3.12 User Profile

### Functional Requirements
- **BM-1 / BM-2**: Allow users to save and remove opportunity bookmarks.
- **UP-1 / UP-2**: Allow users to manage profile details and notification settings.

---

### UC-8: Manage User Profile and Preferences

| Item | Details |
|---|---|
| **Use Case ID** | **UC-8** |
| **Use Case Name** | Manage User Profile and Preferences |
| **Primary Actor** | Registered User |

#### Main Flow
1. User opens profile page (`/profile`).
2. System displays account name, organization, role, and alert preferences.
3. User edits permitted fields and clicks Save.
4. System validates inputs via Zod.
5. System updates `User` and `UserSettings` records in MongoDB.
6. System displays success confirmation toast.
