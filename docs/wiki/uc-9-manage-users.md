## 3.13 Administration Panel

### Description & Priority
Role-restricted management panel for system administrators to audit ingestion, review AI extraction logs, override classifications, and manage user accounts.  
**Priority:** `Medium`

### Functional Requirements
- **AP-1**: Secure, role-restricted admin panel accessible only to authorized administrators.
- **AP-2**: Monitor automated data ingestion status and pipeline sync logs.
- **AP-3**: Manually edit or correct data extracted from TOR documents.
- **AP-4**: Override automated software project classifications.
- **AP-5**: View system processing logs (`SyncError`, `SyncLog`) for troubleshooting.
- **AP-6**: Manage user accounts (view, suspend, activate, delete).

---

### UC-9: Manage Users

| Item | Details |
|---|---|
| **Use Case ID** | **UC-9** |
| **Use Case Name** | Manage Users |
| **Primary Actor** | System Administrator |

#### Main Flow
1. Administrator navigates to `/admin/users`.
2. System verifies admin role in session token.
3. System displays registered user accounts, roles, and status.
4. Administrator searches for or selects a target user.
5. Administrator performs action: change role, suspend account, or restore account.
6. System validates action and updates account status.
7. If suspended, active sessions for the target user are terminated.
8. System writes an audit log entry.

#### Alternative Flows
- **A1: Unauthorized Role Change**: Operation denied with 403 Forbidden.
- **A2: User Not Found**: Display 404 error banner.
- **A3: Active Session Termination**: Active session cookies invalidated upon suspension.
- **A4: Cancel Action**: Admin cancels before confirming modal dialog.

#### Postconditions
- User status updated; administrative action logged for auditing.