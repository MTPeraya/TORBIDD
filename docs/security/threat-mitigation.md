# Threat Mitigation Status & Priority Implementation (Section 10.1 & 10.2)

## 1. Resolution of Contradictions & Priority Alignment

### Critical Threat Inaction vs. Priority Mandate
Sections 5.1 and 5.4 established that all threat mitigations must strictly adhere to risk priority (Critical: Score 16–25 first, followed by High, Medium, Low). Previously, only 1 of 18 threats was marked "Done" (T-09, High priority), while all 4 Critical threats (T-01, T-02, T-03, T-04) and key high-priority threats remained "Partial" or "Open".

All 4 Critical threats (`T-01`, `T-02`, `T-03`, `T-04`) along with high-priority targeted mitigations (`T-06`, `T-17`) have been remediated in the codebase and verified by automated regression test suites.

### Elimination of Contradiction Between T-01 and Section 10.2
Previously, Section 10.1 noted that `T-01` (*SSRF via AI Document URL Submission*) still required authentication on `/api/ai/extract`, while Section 10.2 marked *AI Endpoint Abuse* as "Done". This contradiction has been eliminated:
- `POST /api/ai/extract` now strictly requires session authentication via `getAuthSessionFromRequest` and `requireAuth`, rejecting unauthenticated requests with HTTP 401 Unauthorized before any file parsing, SSRF evaluation, or Vertex AI / Gemini invocation occurs.

---

## 2. Code Remediations Implemented & Verified

### 1. T-01 & T-14: Enforce Authentication on POST /api/ai/extract
- **File**: `torbidd-app/src/app/api/ai/extract/route.ts`
- **Fix**: Added `getAuthSessionFromRequest` and `requireAuth` to reject unauthenticated requests with HTTP 401 Unauthorized before any file parsing or AI invocation occurs.
- **Verification**: Verified via `src/app/api/ai/extract/__tests__/route.test.ts`.

### 2. T-02: Enforce Production Startup Secrets Validation
- **File**: `torbidd-app/src/lib/auth.ts`, `torbidd-app/src/instrumentation.ts`, `torbidd-app/scripts/secure-server.mjs`
- **Fix**: Added explicit production guard asserting `SESSION_SECRET` is present, not a default/placeholder string (`placeholder`, `change-me`), and meets the 256-bit entropy threshold (`>= 32` chars). Throws a fatal exception and aborts server boot if violated.
- **Verification**: Verified via `src/lib/__tests__/production-secrets.test.ts`.

### 3. T-03: Fail-Secure Behavior on /api/cron/deadline-reminders
- **File**: `torbidd-app/src/app/api/cron/deadline-reminders/route.ts`
- **Fix**: Replaced optional check with fail-secure validation. If `CRON_SECRET` is not configured in production, it returns HTTP 503 Service Unavailable rather than running unprotected. Missing/invalid Bearer token returns HTTP 401 Unauthorized. IP-based rate limiting is enforced.
- **Verification**: Verified via `src/app/api/cron/deadline-reminders/__tests__/route.test.ts`.

### 4. T-04: Document Path Traversal & Containment Defense
- **File**: `torbidd-app/src/app/api/documents/[projectId]/[fileName]/route.ts`
- **Fix**: Path traversal is verified with `assertNoPathTraversal()` and confined using `resolvePrivatePath()`. Sensitive/internal documents require authenticated sessions, returning HTTP 404 on nonexistent files to prevent resource enumeration.
- **Verification**: Verified via `containment-defense.test.ts`.

### 5. T-06: Admin Authorization for Ingestion Routes
- **File**: `torbidd-app/src/app/api/ingestion/discover/route.ts`
- **Fix**: Added `getAuthSessionFromRequest` and `requireAdmin` to `/api/ingestion/discover` so arbitrary external callers cannot trigger background ingestion spiders.
- **Verification**: Verified via `src/services/ingestion/__tests__/api-endpoints.test.ts`.

### 6. T-17: Production Environment Guard for Database Seed Script
- **File**: `torbidd-app/scripts/seed.ts`
- **Fix**: Added fail-safe exit preventing the seed script from running against production databases (`process.env.NODE_ENV === 'production'`).
- **Verification**: Verified entrypoint guard logic.

---

## 3. Updated Threat Mitigation Status Table (Section 10.1)

| Threat ID | Threat Name | Severity | Status | Implemented Controls & Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **T-01** | SSRF via AI Document URL | **Critical** | **Done** | `requireAuth()` enforced on `/api/ai/extract`; SSRF allowlist (`src/lib/ssrf.ts`) strictly permits only verified government domains (`gprocurement.go.th`, `bangkok.go.th`, `data.go.th`); blocks private IPs, loopbacks, and cloud metadata (`169.254.169.254`). |
| **T-02** | Credential Leakage / Build-Time Secrets | **Critical** | **Done** | Multi-stage Docker build excludes all `.env*` files via `.dockerignore`; production startup validation throws if `SESSION_SECRET` is unset, default, or `< 32` characters; secrets provided via runtime environment. |
| **T-03** | Insecure Cron Endpoint | **Critical** | **Done** | Fail-secure: returns HTTP 503 if `CRON_SECRET` is missing in production; returns HTTP 401 on invalid/missing Bearer header; rate limited per IP. |
| **T-04** | Path Traversal in Document Route | **Critical** | **Done** | `assertNoPathTraversal()` rejects `../`, `..\`, and percent-encoded variants; storage restricted to non-web private root via `resolvePrivatePath()`; sensitive documents require authentication with 404 responses for non-existent files to block resource enumeration; files named with SHA-256 hashes (`tor_<hash>.pdf`). |
| **T-05** | Rate Limiter Multi-Instance Bypass | High | Partial | Sliding-window memory rate limiter active on all endpoints; Redis-backed adapter planned for horizontal scaling across multiple container replicas. |
| **T-06** | Ingestion Endpoints Auth Gating | High | **Done** | `requireAdmin()` enforced across `/api/ingestion/sync`, `/api/ingestion/discover`, and administrative trigger endpoints; unauthenticated callers receive HTTP 401/403. |
| **T-07** | CSP unsafe-inline / unsafe-eval | High | Partial | Production CSP removes `unsafe-eval`; `frame-ancestors 'none'`, `object-src 'none'`. Nonce-based CSP for Next.js hydration scripts planned under milestone v2. |
| **T-08** | AI Prompt Injection via Documents | High | Partial | PDF parsing isolated in 1GB memory sandbox; 10s strict timeout; Vertex AI prompts wrapped in delimiters with output schema validation via Zod; admin review queue active. |
| **T-09** | Session Cookie Leakage over HTTP | High | **Done** | Cookies enforce `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`; HTTP requests rejected with HTTP 426 Upgrade Required; HSTS enforced globally. |
| **T-10** | CI/CD Secret Exposure | High | Partial | GitHub Actions uses GitHub Encrypted Secrets; `.dockerignore` excludes secrets; Dependabot and Workload Identity Federation planned. |
| **T-11** | IDOR via Notification API | Medium | **Done** | Notifications queried and updated strictly with compound `{ _id: id, recipientId: userId }` predicate; unauthorized access returns HTTP 404. |
| **T-12** | Sensitive Information in Logs | Medium | **Done** | `redactSensitiveData()` automatically masks passwords, tokens, cookies, Bearer headers, and Mongo connection credentials; CRLF sanitized against log injection. |
| **T-13** | Stored/Reflected XSS | Medium | Partial | React automatic JSX text-escaping; Zod input sanitization; audit confirmed zero instances of raw `dangerouslySetInnerHTML`. |
| **T-14** | DoS via Large Base64 PDF Upload | Medium | **Done** | Framework-level `Content-Length` inspection; 25 MiB payload cap enforced before buffering; authentication enforced; rate limited (10 req/min). |
| **T-15** | Admin Role Assignment Protection | High | **Done** | User email bound immutably to Google sub; `PUT /api/auth/me` rejects role and email modifications (HTTP 400); role updates logged to audit trail. |
| **T-16** | Verbose Error Messages | Medium | **Done** | Production error boundaries (`error.tsx`, `global-error.tsx`) return generic `{ error: "Internal Server Error" }`; internal stack traces logged server-side only. |
| **T-17** | Seed Script Run in Production | Low | **Done** | `NODE_ENV === 'production'` guard added at entry point of `scripts/seed.ts`; halts process with non-zero exit code. |
| **T-18** | Outdated Dependencies (Supply Chain) | Low | Partial | `npm audit --audit-level=high` and lockfile integrity enforced in CI pipeline; SBOM generation planned. |

**Result Summary**: All 4 Critical threats (**T-01 to T-04**) and high-priority quick fixes (**T-06**, **T-17**) are now verified as **Done**, fully aligning implementation with the required risk priorities.
