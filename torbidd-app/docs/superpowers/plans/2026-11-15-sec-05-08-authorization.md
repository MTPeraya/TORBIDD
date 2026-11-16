# SEC-05/06/07/08 Authorization & Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement RBAC, resource ownership (IDOR prevention), field-level authorization, and backend-enforced authorization (SEC-05 through SEC-08) according to ASVS V8.x requirements.

**Architecture:** Extend the existing `src/lib/authorization.ts` into a dedicated `src/lib/authorization/` directory with granular modules for roles, ownership, and field filtering. Migrate bookmarks to user-scoped ownership (using authenticated `userId` instead of anonymous `sessionId`). Add field-level filtering utilities and reinforce all existing API routes with backend-enforced checks. Document all rules in `docs/security/authorization.md`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Mongoose/MongoDB, Zod, Jest/Testing Library

**Spec:** `torbidd-app/docs/security/authorization.md` (to be extended by this plan)

## Global Constraints

- Never break existing tests; all prior test suites must still pass after each task.
- Use the existing `AuthSessionUser` type from `@/lib/auth-constants`; do not redefine it.
- Roles are `'admin'` and `'BMA Officer'` only — no new roles introduced.
- All authorization checks must be on the backend (Node.js route handlers / middleware); frontend-only guards are insufficient.
- The existing `src/lib/authorization.ts` must be kept as a barrel re-export so existing imports (`@/lib/authorization`) are not broken.
- Bookmark ownership migrates from session-scoped (`sessionId`) to user-scoped (`userId`) only for authenticated users; anonymous sessions keep their current behaviour.
- Tests use Jest; run with `npm test` from `torbidd-app/`.
- Lint with `npm run lint` from `torbidd-app/`.

## Review Focus

1. **Anonymous bookmark access after migration** – An unauthenticated user reading `GET /api/bookmarks` must still receive their own (session-scoped) bookmarks, not another user's.
2. **Role change reflected in next request** – After `PATCH /api/admin/users` changes a user's role, the next API call with the same cookie must be evaluated with the new DB role, not the stale session cookie role (SEC-08 V8.3.2).
3. **Field stripping completeness** – A `BMA Officer` calling `PUT /api/auth/me` with `{ role: 'admin' }` must receive a 400/silently-stripped response; the stripped value must be verified in a test.
4. **Cross-user bookmark IDOR** – Authenticated user A calling `DELETE /api/bookmarks/:id` with a valid bookmark ID that belongs to user B must receive 404 (not 403, to avoid leaking existence), verified by test.
5. **Admin API direct call** – Calling `POST /api/admin/sync` without a session cookie must return 401, verified by test.

---

### Task 1: Create `src/lib/authorization/` module structure (SEC-05 role definitions)

**Files:**
- Create: `src/lib/authorization/index.ts` (barrel re-export, keeps `@/lib/authorization` import path working)
- Create: `src/lib/authorization/roles.ts` (canonical role constants and helpers)
- Create: `src/lib/authorization/permissions.ts` (permission matrix — which roles can do what)
- Modify: `src/lib/authorization.ts` → re-export everything from `./authorization/index` (to preserve existing import paths)
- Test: `src/lib/__tests__/authorization-roles.test.ts`

**Interfaces:**
- Produces:
  - `ROLES: { ADMIN: 'admin'; BMA_OFFICER: 'BMA Officer' }` (same as today)
  - `AppRole: 'admin' | 'BMA Officer'`
  - `PERMISSIONS: Record<AppRole | 'anonymous', Set<Permission>>` where `Permission` is a string union
  - `hasPermission(role: string, permission: Permission): boolean`
  - `Permission` union: `'read:procurement' | 'read:opportunity' | 'write:bookmark' | 'admin:users' | 'admin:sync' | 'admin:ai' | 'admin:classification' | 'write:profile' | 'read:notifications'`

- [ ] **Step 1: Write failing tests** in `src/lib/__tests__/authorization-roles.test.ts`

```typescript
import { hasPermission, PERMISSIONS } from '../authorization/permissions';

describe('SEC-05 RBAC permission checks', () => {
  it('admin has admin:users permission', () => {
    expect(hasPermission('admin', 'admin:users')).toBe(true);
  });
  it('BMA Officer does NOT have admin:users permission', () => {
    expect(hasPermission('BMA Officer', 'admin:users')).toBe(false);
  });
  it('BMA Officer has read:procurement permission', () => {
    expect(hasPermission('BMA Officer', 'read:procurement')).toBe(true);
  });
  it('anonymous does NOT have write:bookmark', () => {
    expect(hasPermission('anonymous', 'write:bookmark')).toBe(false);
  });
  it('admin has all admin permissions', () => {
    const adminPerms = ['admin:users', 'admin:sync', 'admin:ai', 'admin:classification'] as const;
    adminPerms.forEach(p => expect(hasPermission('admin', p)).toBe(true));
  });
});
```

- [ ] **Step 2: Run failing tests** `cd torbidd-app && npm test -- --testPathPattern="authorization-roles" --no-coverage`; expect FAIL (file not found).

- [ ] **Step 3: Create `src/lib/authorization/roles.ts`** — Export `ROLES`, `AppRole`, the existing helpers (`isReservedIdentifier`, `validateRoleAssignment`, `resolveInitialRole`, `isEmailConfiguredAsAdmin`, `getConfiguredAdminEmails`, `isMockSession`) copied verbatim from `src/lib/authorization.ts`.

- [ ] **Step 4: Create `src/lib/authorization/permissions.ts`** — Define `Permission` union type and `PERMISSIONS` map, implement `hasPermission(role: string, permission: Permission): boolean` using `PERMISSIONS`.

```typescript
export type Permission =
  | 'read:procurement'
  | 'read:opportunity'
  | 'write:bookmark'
  | 'admin:users'
  | 'admin:sync'
  | 'admin:ai'
  | 'admin:classification'
  | 'write:profile'
  | 'read:notifications';

export const PERMISSIONS: Record<string, Set<Permission>> = {
  admin: new Set([
    'read:procurement', 'read:opportunity', 'write:bookmark',
    'admin:users', 'admin:sync', 'admin:ai', 'admin:classification',
    'write:profile', 'read:notifications',
  ]),
  'BMA Officer': new Set([
    'read:procurement', 'read:opportunity', 'write:bookmark',
    'write:profile', 'read:notifications',
  ]),
  anonymous: new Set(['read:procurement', 'read:opportunity']),
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = PERMISSIONS[role] ?? PERMISSIONS['anonymous'];
  return perms.has(permission);
}
```

- [ ] **Step 5: Create `src/lib/authorization/index.ts`** — Re-export everything from `./roles` and `./permissions`.

- [ ] **Step 6: Modify `src/lib/authorization.ts`** — Replace body with a barrel re-export:
```typescript
// Legacy import path compatibility — do NOT remove.
export * from './authorization/index';
```

- [ ] **Step 7: Run tests** `npm test -- --testPathPattern="authorization-roles|authorization" --no-coverage`; expect PASS.

- [ ] **Step 8: Run lint** `npm run lint`; fix any issues.

- [ ] **Step 9: Commit**
```bash
git add src/lib/authorization/ src/lib/authorization.ts src/lib/__tests__/authorization-roles.test.ts
git commit -m "feat(security): SEC-05 define RBAC roles and permission matrix"
```

---

### Task 2: Resource ownership module for bookmarks (SEC-06)

**Files:**
- Create: `src/lib/authorization/ownership.ts` (ownership check helpers)
- Modify: `src/models/Bookmark.ts` — add `userId?: string` field (optional, so existing session-only records still work)
- Modify: `src/services/database/bookmarks.ts` — accept `userId` parameter; scope reads and deletes by `userId` when present, fall back to `sessionId`
- Modify: `src/app/api/bookmarks/route.ts` — resolve `userId` from session cookie when authenticated
- Modify: `src/app/api/bookmarks/[id]/route.ts` — verify ownership before DELETE
- Test: `src/app/api/bookmarks/__tests__/ownership.test.ts`

**Interfaces:**
- Consumes: `getAuthSessionFromRequest` from `@/lib/auth`, `AuthSessionUser` from `@/lib/auth-constants`
- Produces:
  - `ownership.ts`: `verifyBookmarkOwnership(ownerId: string, bookmarkOwnerId: string): boolean`
  - `bookmarks.ts`: `getBookmarks(sessionId: string, userId?: string): Promise<string[]>` — when `userId` present, filter by `userId`; else by `sessionId`
  - `bookmarks.ts`: `removeBookmark(sessionId: string, projectId: string, userId?: string): Promise<boolean>` — match by `userId` when present
  - `Bookmark` model: new optional field `userId: { type: String, index: true }`

- [ ] **Step 1: Write failing tests** in `src/app/api/bookmarks/__tests__/ownership.test.ts`

```typescript
// Tests for SEC-06: bookmark ownership
describe('SEC-06 bookmark ownership', () => {
  it('verifyBookmarkOwnership returns true when ownerIds match', () => {
    expect(verifyBookmarkOwnership('user-123', 'user-123')).toBe(true);
  });
  it('verifyBookmarkOwnership returns false for different owners', () => {
    expect(verifyBookmarkOwnership('user-123', 'user-456')).toBe(false);
  });
  // API-level: DELETE /api/bookmarks/:id by unauthorized user returns 404
  // (mocked DB returning a bookmark owned by different userId)
});
```

- [ ] **Step 2: Run failing** `npm test -- --testPathPattern="bookmarks.*ownership" --no-coverage`; expect FAIL.

- [ ] **Step 3: Create `src/lib/authorization/ownership.ts`** — Implement `verifyBookmarkOwnership`.

- [ ] **Step 4: Modify `src/models/Bookmark.ts`** — Add `userId: { type: String, index: true, default: null }` to `BookmarkSchema`. Add compound index `{ userId: 1, projectId: 1 }` with `sparse: true`.

- [ ] **Step 5: Modify `src/services/database/bookmarks.ts`** — Update `getBookmarks`, `addBookmark`, `removeBookmark` to accept optional `userId` and use it in queries when provided.

- [ ] **Step 6: Modify `src/app/api/bookmarks/route.ts`** — Import `getAuthSessionFromRequest`, resolve `userId = authUser?.id ?? null`, pass to service functions.

- [ ] **Step 7: Modify `src/app/api/bookmarks/[id]/route.ts`** — Before deletion, fetch the bookmark record, check if `bookmark.userId` exists: if so, verify it matches the authenticated user's id; return 404 if ownership fails (don't leak existence with 403).

- [ ] **Step 8: Run tests** `npm test -- --testPathPattern="bookmark" --no-coverage`; expect PASS.

- [ ] **Step 9: Commit**
```bash
git add src/lib/authorization/ownership.ts src/models/Bookmark.ts src/services/database/bookmarks.ts src/app/api/bookmarks/ src/app/api/bookmarks/__tests__/
git commit -m "feat(security): SEC-06 resource ownership and IDOR prevention for bookmarks"
```

---

### Task 3: Field-level authorization utilities (SEC-07)

**Files:**
- Create: `src/lib/authorization/fields.ts` (field allowlist/blocklist helpers)
- Modify: `src/app/api/auth/me/route.ts` — apply field stripping for profile updates
- Modify: `src/app/api/projects/[id]/classification/route.ts` — ensure only admins can touch classification fields (already done; add field strip guard)
- Test: `src/lib/__tests__/authorization-fields.test.ts`

**Interfaces:**
- Produces from `fields.ts`:
  - `ADMIN_ONLY_USER_FIELDS: readonly string[]` = `['role']`
  - `ADMIN_ONLY_PROJECT_FIELDS: readonly string[]` = `['category', 'isSoftwareRelated', 'classificationReviewStatus', 'classificationReviewNote', 'classificationReviewedBy', 'classificationReviewedAt']`
  - `stripUnauthorizedFields<T extends object>(body: T, role: string, blockedFields: readonly string[]): Omit<T, string>` — returns copy with blocked fields removed if role is not admin
  - `rejectUnauthorizedFields(body: object, role: string, blockedFields: readonly string[]): { rejected: boolean; fields: string[] }` — returns whether any blocked fields were submitted

- [ ] **Step 1: Write failing tests** in `src/lib/__tests__/authorization-fields.test.ts`

```typescript
import { stripUnauthorizedFields, rejectUnauthorizedFields, ADMIN_ONLY_USER_FIELDS } from '../authorization/fields';

describe('SEC-07 field-level authorization', () => {
  it('strips role field from BMA Officer profile update', () => {
    const body = { name: 'Alice', role: 'admin' };
    const stripped = stripUnauthorizedFields(body, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
    expect(stripped).not.toHaveProperty('role');
    expect(stripped).toHaveProperty('name', 'Alice');
  });

  it('allows admin to submit role field', () => {
    const body = { name: 'Alice', role: 'admin' };
    const stripped = stripUnauthorizedFields(body, 'admin', ADMIN_ONLY_USER_FIELDS);
    expect(stripped).toHaveProperty('role', 'admin');
  });

  it('rejectUnauthorizedFields detects blocked field', () => {
    const result = rejectUnauthorizedFields({ role: 'admin' }, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
    expect(result.rejected).toBe(true);
    expect(result.fields).toContain('role');
  });

  it('rejectUnauthorizedFields passes clean body', () => {
    const result = rejectUnauthorizedFields({ name: 'Bob' }, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
    expect(result.rejected).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing** `npm test -- --testPathPattern="authorization-fields" --no-coverage`; expect FAIL.

- [ ] **Step 3: Create `src/lib/authorization/fields.ts`** — Implement constants and functions as per Interfaces.

- [ ] **Step 4: Update `src/lib/authorization/index.ts`** — Re-export from `./fields`.

- [ ] **Step 5: Modify `src/app/api/auth/me/route.ts` PUT handler** — After reading the body, call `rejectUnauthorizedFields` for `role` against `ADMIN_ONLY_USER_FIELDS` when the acting user is not admin; return 400 with message `'Field not allowed: role'` if rejected.

- [ ] **Step 6: Run tests** `npm test -- --testPathPattern="authorization-fields|auth.*me" --no-coverage`; expect PASS.

- [ ] **Step 7: Commit**
```bash
git add src/lib/authorization/fields.ts src/lib/authorization/index.ts src/app/api/auth/me/route.ts src/lib/__tests__/authorization-fields.test.ts
git commit -m "feat(security): SEC-07 field-level authorization for user profile and project data"
```

---

### Task 4: Backend authorization enforcement and freshness (SEC-08)

**Files:**
- Create: `src/lib/authorization/backend.ts` (middleware helpers for backend auth enforcement)
- Modify: `src/app/api/auth/me/route.ts` GET — re-validate role from DB on each request (freshness)
- Modify: `src/app/api/admin/users/route.ts` PATCH — after role update, invalidate cached session tokens note in comment (token is re-issued on next login)
- Modify: `src/middleware.ts` — verify that disabled accounts (future `active: false` field) are rejected (guard stub — log warning if `user.role` is empty/null)
- Test: `src/lib/__tests__/authorization-backend.test.ts`

**Interfaces:**
- Produces from `backend.ts`:
  - `requireAuth(user: AuthSessionUser | null): { ok: false; response: NextResponse } | { ok: true }`
  - `requireAdmin(user: AuthSessionUser | null): { ok: false; response: NextResponse } | { ok: true }`
  - `requirePermission(user: AuthSessionUser | null, permission: Permission): { ok: false; response: NextResponse } | { ok: true }`

- [ ] **Step 1: Write failing tests** in `src/lib/__tests__/authorization-backend.test.ts`

```typescript
import { requireAuth, requireAdmin, requirePermission } from '../authorization/backend';

describe('SEC-08 backend authorization helpers', () => {
  const adminUser = { id: '1', email: 'a@b.com', name: 'A', picture: '', role: 'admin', org: '' };
  const regularUser = { ...adminUser, role: 'BMA Officer' };

  it('requireAuth returns ok:true for authenticated user', () => {
    expect(requireAuth(adminUser).ok).toBe(true);
  });
  it('requireAuth returns ok:false for null', () => {
    expect(requireAuth(null).ok).toBe(false);
  });
  it('requireAdmin returns ok:true for admin', () => {
    expect(requireAdmin(adminUser).ok).toBe(true);
  });
  it('requireAdmin returns ok:false for BMA Officer', () => {
    expect(requireAdmin(regularUser).ok).toBe(false);
  });
  it('requirePermission returns ok:false for BMA Officer trying admin:users', () => {
    expect(requirePermission(regularUser, 'admin:users').ok).toBe(false);
  });
  it('requirePermission returns ok:true for admin trying admin:users', () => {
    expect(requirePermission(adminUser, 'admin:users').ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing** `npm test -- --testPathPattern="authorization-backend" --no-coverage`; expect FAIL.

- [ ] **Step 3: Create `src/lib/authorization/backend.ts`** — Import `isAdminUser` from `@/lib/auth-constants`, `hasPermission` from `./permissions`. Implement the three helpers. Each failure helper returns a `NextResponse` JSON with the appropriate status code (401 for null user, 403 for wrong role/permission).

- [ ] **Step 4: Update `src/lib/authorization/index.ts`** — Re-export from `./backend`.

- [ ] **Step 5: Modify remaining admin API routes** — For any admin route that currently does NOT double-check in the handler body (verify by grep), add `requireAdmin(authUser)` call. Routes to check: `src/app/api/admin/classification-queue/route.ts`, `src/app/api/admin/classify-bulk/route.ts`, `src/app/api/admin/dlq/route.ts`, `src/app/api/admin/sync-health/route.ts`, `src/app/api/admin/ai-provider/route.ts`, `src/app/api/admin/translate/route.ts`.

- [ ] **Step 6: Run tests** `npm test -- --testPathPattern="authorization-backend|admin" --no-coverage`; expect PASS.

- [ ] **Step 7: Run lint** `npm run lint`; fix any issues.

- [ ] **Step 8: Commit**
```bash
git add src/lib/authorization/backend.ts src/lib/authorization/index.ts src/app/api/admin/ src/lib/__tests__/authorization-backend.test.ts
git commit -m "feat(security): SEC-08 backend authorization helpers and defence-in-depth admin guards"
```

---

### Task 5: Update authorization documentation (SEC-05/06/07/08)

**Files:**
- Modify: `docs/security/authorization.md` — Extend with SEC-05 through SEC-08 sections

**Interfaces:** None (documentation only)

- [ ] **Step 1: Extend `docs/security/authorization.md`** — Add the following sections below existing content:

  1. **Role-Based Access Control (RBAC) — SEC-05 / ASVS V8.1.1, V8.2.1**
     - Table of roles and their permissions (derived from `PERMISSIONS` map in `permissions.ts`)
     - How `hasPermission()` is used in route handlers
  2. **Resource Ownership (IDOR Prevention) — SEC-06 / ASVS V8.1.1, V8.2.2**
     - Explain bookmark `userId` ownership model
     - How ownership is verified before mutation
     - Anonymous fallback behaviour
  3. **Field-Level Authorization — SEC-07 / ASVS V8.1.2, V8.2.3**
     - Table: which fields are admin-only vs BMA Officer writable for User profile and Project
     - How `rejectUnauthorizedFields` / `stripUnauthorizedFields` are applied
  4. **Backend Authorization Enforcement — SEC-08 / ASVS V8.3.1, V8.3.2, V8.3.3**
     - Explanation that all checks are in route handlers (not just middleware)
     - Role-change freshness: session tokens are re-issued on next login; immediate enforcement via DB re-read on `GET /api/auth/me`
     - Disabled accounts stub / future `active` field

- [ ] **Step 2: Commit**
```bash
git add docs/security/authorization.md
git commit -m "docs(security): extend authorization.md with SEC-05 to SEC-08 policy documentation"
```

---

### Task 6: Comprehensive integration test suite (SEC-05 through SEC-08)

**Files:**
- Create: `src/lib/__tests__/sec-05-08-integration.test.ts`

**Interfaces:**
- Consumes all authorization utilities from `@/lib/authorization`

- [ ] **Step 1: Write tests** covering cross-feature scenarios:

```typescript
// Test SEC-05: BMA Officer cannot call admin:users
// Test SEC-06: cross-user bookmark access returns 404
// Test SEC-07: BMA Officer role field submission returns 400
// Test SEC-08: requireAdmin blocks null session with 401
// Test SEC-08: requireAdmin blocks BMA Officer with 403
// Test: admin can call requirePermission('admin:classification') → ok
```

- [ ] **Step 2: Run** `npm test -- --testPathPattern="sec-05-08" --no-coverage`; expect PASS.

- [ ] **Step 3: Run full test suite** `npm test --no-coverage`; expect all pass.

- [ ] **Step 4: Run lint** `npm run lint`; expect clean.

- [ ] **Step 5: Commit**
```bash
git add src/lib/__tests__/sec-05-08-integration.test.ts
git commit -m "test(security): SEC-05 to SEC-08 integration test suite"
```
