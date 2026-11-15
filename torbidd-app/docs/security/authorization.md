# Administrative Access Policy

> ASVS coverage: **V6.3.2** (Default User Accounts Must Not Be Present or Must Be Disabled)

---

## Overview

TORBIDD uses **Google OAuth 2.0 as the sole authentication mechanism**. There are no locally-managed passwords and no default accounts.  

Administrative privileges (`admin` role) are granted exclusively through one of two controlled channels:

1. **Operator configuration** – An operator lists trusted email addresses in the `ADMIN_EMAILS` environment variable before deployment. Users whose Google accounts match those emails receive the `admin` role automatically on first sign-in.
2. **Explicit admin promotion** – An existing administrator uses the `PATCH /api/admin/users` endpoint to promote another registered user to `admin`.

No other path to administrative privilege exists.

---

## Role Model

| Role | Description | How assigned |
|---|---|---|
| `admin` | Full platform access, user management, data sync, AI controls | Via `ADMIN_EMAILS` env var OR explicit admin promotion |
| `BMA Officer` | Standard user, read-only access to procurement data | Default for all new OAuth sign-ins |

> **No password, PIN, or pre-set credential is associated with any role.**  
> Authentication is entirely delegated to Google's identity platform.

---

## No Default Accounts (ASVS V6.3.2)

The following measures ensure no default accounts exist:

### 1. No hardcoded credentials

TORBIDD contains no hardcoded usernames, passwords, or access tokens.  
The only user creation path is `src/app/api/auth/callback/google/route.ts`, which creates a user record via `User.findOneAndUpdate` after a successful Google OAuth exchange.

### 2. Default role is always non-privileged

Every new user record is inserted with `role: 'BMA Officer'` via `$setOnInsert` in Mongoose.  
The admin role is only applied via `$set` when `ADMIN_EMAILS` contains the user's email.

```ts
// src/lib/authorization.ts
export function resolveInitialRole(email: string): AppRole {
  if (isEmailConfiguredAsAdmin(email)) return ROLES.ADMIN;
  return ROLES.BMA_OFFICER;
}
```

### 3. Reserved identifiers blocked

The following account name prefixes are considered reserved and can never hold the `admin` role, even when explicitly promoted by an existing admin:

`admin`, `administrator`, `root`, `sa`, `system`, `superuser`, `sysadmin`, `superadmin`, `service_account`

This is enforced in `src/lib/authorization.ts → isReservedIdentifier()` and checked inside `validateRoleAssignment()`.

### 4. No direct user creation via API

`POST /api/admin/users` returns HTTP **405 Method Not Allowed** with an explicit message:

> *"User accounts cannot be created directly. All accounts are provisioned through Google OAuth 2.0 on first sign-in."*

---

## Privilege Escalation Prevention

### Self-escalation blocked

A regular user calling `PUT /api/auth/me` and setting `role: "admin"` is rejected by `validateRoleAssignment()`:

```
403 Forbidden
{ "error": "Privilege escalation denied: only administrators can assign admin roles." }
```

### Cross-user escalation blocked

Only authenticated admins may call `PATCH /api/admin/users`. The request goes through two layers:

1. `src/middleware.ts` → checks `AUTH_COOKIE_NAME` and validates `isAdminUser(session.user)`.
2. `src/app/api/admin/users/route.ts` (handler) → repeats the admin check (defence-in-depth).

### Self-demotion blocked

An administrator cannot modify their own role via the admin user API. This prevents an accidental or coerced loss of the last admin account:

```
403 Forbidden
{ "error": "Administrators cannot modify their own role." }
```

---

## Audit Logging

All role changes are logged at `INFO` level to stdout:

```
[SEC-02 AUDIT] Role changed: actor=admin@domain.com → target=user@domain.com oldRole=BMA Officer newRole=admin
```

Blocked escalation attempts are logged at `WARN` level:

```
[SEC-02] Role escalation blocked: actor=user@domain.com → target=user@domain.com role=admin reason=Privilege escalation denied...
```

---

## Mock / Development Mode

The developer mock session (`code=mock_dev_code`) uses the email `officer.bma@bangkok.go.th`. Its role is resolved with the same `resolveInitialRole()` function as real accounts — it only gets `admin` if that email is in `ADMIN_EMAILS`. No special mock-admin bypass exists.

---

## Configuration Reference

| Variable | Required | Description |
|---|---|---|
| `ADMIN_EMAILS` | Optional | Comma-separated list of Google emails that receive `admin` role on first sign-in. Example: `alice@bma.go.th,bob@bma.go.th` |

> **Warning:** `ADMIN_EMAILS` must be set before first deployment. Adding an email after a user has already signed in will not automatically change their role in the database — an existing admin must use the `PATCH /api/admin/users` endpoint to promote them.

---

## Related Files

| File | Purpose |
|---|---|
| [`src/lib/authorization.ts`](../../src/lib/authorization.ts) | Centralised role logic, reserved-identifier list, `validateRoleAssignment`, `resolveInitialRole` |
| [`src/lib/auth-constants.ts`](../../src/lib/auth-constants.ts) | `isAdminUser` helper (Edge-safe) |
| [`src/app/api/admin/users/route.ts`](../../src/app/api/admin/users/route.ts) | User management API (list users, update role) |
| [`src/app/api/auth/callback/google/route.ts`](../../src/app/api/auth/callback/google/route.ts) | OAuth callback — only place accounts are created |
| [`src/app/api/auth/me/route.ts`](../../src/app/api/auth/me/route.ts) | Profile update — role assignment validated |
| [`src/middleware.ts`](../../src/middleware.ts) | First-layer admin route protection |
