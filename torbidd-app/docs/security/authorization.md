# Authorization and Access Control Policy

> ASVS coverage:
> - **V6.3.2** (Default User Accounts Must Not Be Present or Must Be Disabled) — *SEC-02*
> - **V8.1.1** (Document function-level and data-specific authorization rules) — *SEC-05, SEC-06*
> - **V8.1.2** (Document field-level access restrictions) — *SEC-07*
> - **V8.2.1** (Restrict function-level access to consumers with explicit permissions) — *SEC-05*
> - **V8.2.2** (Restrict data-specific access to consumers with explicit permissions) — *SEC-06*
> - **V8.2.3** (Enforce field-level authorization) — *SEC-07*
> - **V8.3.1** (Enforce authorization at a trusted service layer) — *SEC-08*
> - **V8.3.2** (Apply changes to authorization-related values immediately) — *SEC-08*
> - **V8.3.3** (Base object access on originating user permissions) — *SEC-08*

---

## Overview

TORBIDD uses **Google OAuth 2.0 as the sole authentication mechanism**. There are no locally-managed passwords and no default accounts.  

All authorization decisions are evaluated and enforced strictly at the **trusted Node.js backend layer** (`src/lib/authorization/`, route handlers, and middleware). The frontend user interface simply mirrors permissions for UX purposes; security is never delegated to client-side checks.

Administrative privileges (`admin` role) are granted exclusively through one of two controlled channels:
1. **Operator configuration** – An operator lists trusted email addresses in the `ADMIN_EMAILS` environment variable before deployment. Users whose Google accounts match those emails receive the `admin` role automatically on first sign-in.
2. **Explicit admin promotion** – An existing administrator uses the `PATCH /api/admin/users` endpoint to promote another registered user to `admin`.

No other path to administrative privilege exists.

---

## Role-Based Access Control (RBAC) — SEC-05

> ASVS Requirements: **V8.1.1**, **V8.2.1**  
> Implementation: `src/lib/authorization/roles.ts`, `src/lib/authorization/permissions.ts`

TORBIDD defines three principal access contexts:

| Role / Context | Description | Assignment Mechanism |
|---|---|---|
| `admin` | System Administrator with full platform access, user administration, manual sync triggers, AI provider management, and classification review overrides. | Configured via `ADMIN_EMAILS` or promoted by an existing admin. |
| `BMA Officer` | Standard registered user with full access to procurement search, opportunity viewing, personal bookmarks, personal preferences, and profile updates. | Default role automatically assigned to all new OAuth sign-ins. |
| `anonymous` | Unauthenticated public visitor with read-only access to procurement search and project details. | Unauthenticated requests. |

### Permission Matrix (Function-Level Authorization)

The permission mapping is strictly enforced via `hasPermission(role, permission)`:

| Permission | Description | `admin` | `BMA Officer` | `anonymous` |
|---|---|:---:|:---:|:---:|
| `read:procurement` | Search and browse procurement listings | ✅ | ✅ | ✅ |
| `read:opportunity` | View opportunity details and tech specs | ✅ | ✅ | ✅ |
| `write:bookmark` | Create, retrieve, and delete personal bookmarks | ✅ | ✅ | ❌ |
| `write:profile` | Update personal profile (name, organization) | ✅ | ✅ | ❌ |
| `read:notifications` | Manage personal notification alerts and preferences | ✅ | ✅ | ❌ |
| `admin:users` | List registered users and modify user roles (UC-9) | ✅ | ❌ | ❌ |
| `admin:sync` | Trigger immediate government data synchronization | ✅ | ❌ | ❌ |
| `admin:ai` | Configure AI provider models and cooldowns | ✅ | ❌ | ❌ |
| `admin:classification` | Review, approve, or correct AI classifications (UC-4, UC-10) | ✅ | ❌ | ❌ |

---

## Resource Ownership and Object-Level Authorization — SEC-06

> ASVS Requirements: **V8.1.1**, **V8.2.2**  
> Implementation: `src/lib/authorization/ownership.ts`, `src/models/Bookmark.ts`, `src/services/database/bookmarks.ts`

To prevent **Insecure Direct Object Reference (IDOR)** and **Broken Object Level Authorization (BOLA)** vulnerabilities, all private user-specific resources are tied directly to an immutable owner identifier.

### Data-Specific Access Rules: Bookmark Management

1. **Owner Association**:
   - Each `Bookmark` document contains a `userId` field (the authenticated user's ID) as well as the anonymous `sessionId`.
   - When an authenticated user creates a bookmark (`POST /api/bookmarks`), the backend extracts the verified user ID from the signed session cookie and records it in `userId`.
2. **Access and Modification Scoping**:
   - `GET /api/bookmarks`: Queries `Bookmark.find({ userId })` for authenticated users. Users can only see their own bookmarks.
   - `DELETE /api/bookmarks/[id]`: The backend verifies resource ownership before deletion. It queries `Bookmark.deleteOne({ userId, projectId })`.
3. **IDOR & BOLA Prevention (Existence Leakage Guard)**:
   - If User A attempts to delete or access a bookmark belonging to User B by substituting resource IDs, the query matches 0 records.
   - The backend responds with **HTTP 404 Not Found** (rather than 403 Forbidden) so that attackers cannot even enumerate whether a private resource ID exists for another user.
4. **Anonymous Fallback**:
   - Unauthenticated visitors continue to have device-local bookmarks scoped by anonymous `sessionId`.

---

## Field-Level Authorization — SEC-07

> ASVS Requirements: **V8.1.2**, **V8.2.3**  
> Implementation: `src/lib/authorization/fields.ts`, `src/app/api/auth/me/route.ts`, `src/app/api/projects/[id]/classification/route.ts`

Field-level authorization prevents **Broken Object Property Level Authorization (BOPLA)** and mass-assignment attacks where clients inject unauthorized property updates into API payloads.

### User Profile Field Restrictions (`PUT /api/auth/me`)

| Field | Readable By | Writable By | Enforcement Mechanism |
|---|---|---|---|
| `name` | Any authenticated user | Owner (`BMA Officer`, `admin`) | Sanitized text update |
| `org` | Any authenticated user | Owner (`BMA Officer`, `admin`) | Sanitized text update |
| `picture` / `avatar` | Any authenticated user | Owner (`BMA Officer`, `admin`) | Validated URL update |
| `role` | Any authenticated user | **`admin` only** | **`rejectUnauthorizedFields` returns HTTP 400** if submitted by non-admin |
| `email` | Any authenticated user | **Immutable (Google OAuth bound)** | **`validateEmailMutation` returns HTTP 400** on attempt to alter |

### Project & Classification Field Restrictions (`PATCH /api/projects/:id/classification`)

Ordinary users (`BMA Officer`) cannot modify procurement data, nor can they override AI classification results:

| Field Group | Permitted Roles | Endpoint |
|---|---|---|
| AI Category (`category`, `software_category`) | `admin` only | `PATCH /api/projects/[id]/classification` |
| Software Relevance (`isSoftwareRelated`, `is_software`) | `admin` only | `PATCH /api/projects/[id]/classification` |
| Review Status (`classificationReviewStatus`) | `admin` only | `PATCH /api/projects/[id]/classification` |
| Review Notes (`classificationReviewNote`) | `admin` only | `PATCH /api/projects/[id]/classification` |

---

## Backend Authorization Enforcement — SEC-08

> ASVS Requirements: **V8.3.1**, **V8.3.2**, **V8.3.3**  
> Implementation: `src/lib/authorization/backend.ts`, `src/proxy.ts`, `src/app/api/admin/*`

### 1. Trusted Service Layer Enforcement (V8.3.1)

Authorization checks are enforced in two complementary layers (defence-in-depth):
- **Next.js Proxy (`src/proxy.ts`)**: Fast perimeter check protecting `/admin` and `/api/admin/*` paths before route invocation.
- **Backend Route Handlers (`src/app/api/**/route.ts`)**: Mandatory handler-level checks utilizing `requireAdmin()`, `requireAuth()`, or `requirePermission()`. Even if edge middleware is bypassed or misconfigured, every backend endpoint validates the session independently.

### 2. Immediate Permission Freshness (V8.3.2)

- Role changes (e.g., when an admin updates a user's role via `PATCH /api/admin/users`) are saved directly to the database.
- `GET /api/auth/me` queries the database to compare the active database role against the session cookie.
- If a discrepancy is detected (e.g. role upgraded or revoked), the backend **immediately updates the user context and re-issues a signed session cookie**, ensuring permission adjustments take effect without delay.

### 3. Originating User Context Preservation (V8.3.3)

- User-initiated operations (such as triggering an alert evaluation or processing bookmarks) pass the authenticated `user.id` through to database queries.
- Backend background tasks and worker daemons execute under their own explicit context (`actor: 'Daemon'`) and cannot assume an arbitrary user's permissions.

---

## No Default Accounts (ASVS V6.3.2)

The following measures ensure no default accounts exist:

### 1. No hardcoded credentials
TORBIDD contains no hardcoded usernames, passwords, or access tokens. The only account creation path is `src/app/api/auth/callback/google/route.ts`, which provisions records via `User.findOneAndUpdate` upon valid Google OAuth callback.

### 2. Default role is always non-privileged
Every new user record is inserted with `role: 'BMA Officer'` via `$setOnInsert` in Mongoose. The admin role is only applied via `$set` when `ADMIN_EMAILS` contains the user's email.

### 3. Reserved identifiers blocked
Account name prefixes matching system identifiers (`admin`, `administrator`, `root`, `sa`, `system`, `superuser`, `sysadmin`, `superadmin`, `service_account`) are detected by `isReservedIdentifier()` and strictly blocked from holding privileged roles.

### 4. No direct user creation via API
`POST /api/admin/users` returns HTTP **405 Method Not Allowed** with an explicit message:
> *"User accounts cannot be created directly. All accounts are provisioned through Google OAuth 2.0 on first sign-in."*

---

## Privilege Escalation Prevention

### Self-escalation blocked
A regular user calling `PUT /api/auth/me` and attempting to supply `role: "admin"` is rejected with HTTP 400 by `rejectUnauthorizedFields()`.

### Cross-user escalation blocked
Only authenticated admins may call `PATCH /api/admin/users`. Requests pass through two checks:
1. `src/proxy.ts` → verifies `AUTH_COOKIE_NAME` and `isAdminUser(session.user)`.
2. `src/app/api/admin/users/route.ts` → re-verifies admin privileges with `isAdminUser(actor)`.

### Self-demotion blocked
An administrator cannot modify their own role via the admin user API (`targetUser.email === actor.email` returns 403 Forbidden).

---

## Audit Logging

All role changes and security violations are logged to stdout:
```
[SEC-02 AUDIT] Role changed: actor=admin@domain.com → target=user@domain.com oldRole=BMA Officer newRole=admin
[SEC-02] Role escalation blocked: actor=user@domain.com → target=user@domain.com role=admin reason=Privilege escalation denied...
[SEC-07] Field-level violation: user=user@domain.com attempted to set fields: role
```

---

## Related Files

| File | Purpose |
|---|---|
| [`src/lib/authorization/roles.ts`](../../src/lib/authorization/roles.ts) | Canonical role constants, reserved identifiers, role assignment validation |
| [`src/lib/authorization/permissions.ts`](../../src/lib/authorization/permissions.ts) | Permission types and RBAC matrix (`hasPermission`) |
| [`src/lib/authorization/ownership.ts`](../../src/lib/authorization/ownership.ts) | Ownership validation (`verifyBookmarkOwnership`, `verifyOwnership`) |
| [`src/lib/authorization/fields.ts`](../../src/lib/authorization/fields.ts) | Field allowlists/blocklists (`stripUnauthorizedFields`, `rejectUnauthorizedFields`) |
| [`src/lib/authorization/backend.ts`](../../src/lib/authorization/backend.ts) | Backend service authorization guards (`requireAuth`, `requireAdmin`, `requirePermission`) |
| [`src/lib/authorization.ts`](../../src/lib/authorization.ts) | Barrel re-export preserving legacy import paths |
| [`src/models/Bookmark.ts`](../../src/models/Bookmark.ts) | Bookmark data model with `userId` ownership attribute |
| [`src/services/database/bookmarks.ts`](../../src/services/database/bookmarks.ts) | Bookmark repository enforcing `userId` ownership scoping |
| [`src/app/api/bookmarks/route.ts`](../../src/app/api/bookmarks/route.ts) | Bookmark list & create with user ownership binding |
| [`src/app/api/bookmarks/[id]/route.ts`](../../src/app/api/bookmarks/[id]/route.ts) | Bookmark delete with ownership verification and IDOR prevention |
| [`src/app/api/auth/me/route.ts`](../../src/app/api/auth/me/route.ts) | Profile API with field-level authorization and dynamic permission freshness |
| [`src/app/api/admin/users/route.ts`](../../src/app/api/admin/users/route.ts) | Admin user management and role assignment endpoint |
| [`src/proxy.ts`](../../src/proxy.ts) | Perimeter route protection |
