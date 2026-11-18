# SEC-21: Defensive API Architecture, Supply Chain Security & Resiliency

This document defines TORBIDD's defensive API architecture, third-party dependency supply chain security, resource exhaustion mitigations, container sandboxing, prototype pollution defenses, and atomic concurrency controls in compliance with **OWASP ASVS v4.0.3 Chapter 15 (Secure Coding and Architecture)**.

---

## 1. Vulnerability Remediation Timeframes (ASVS V15.1.1 & V15.2.1)

TORBIDD enforces a risk-based remediation policy for vulnerabilities discovered in third-party dependencies, container base images, and system libraries:

| Vulnerability Severity | CVSS v3/v4 Score | Remediation Deadline | Response Protocol |
| :--- | :--- | :--- | :--- |
| **Critical** | $9.0 - 10.0$ | **$\le$ 7 Days** | Immediate emergency patch / hotfix deployment. If no patch exists, isolate the affected module or enforce network/WAF mitigations. |
| **High** | $7.0 - 8.9$ | **$\le$ 14 Days** | Scheduled high-priority release; update dependency via `npm audit fix` or upgrade package version in `package.json`. |
| **Medium** | $4.0 - 6.9$ | **$\le$ 30 Days** | Addressed in the subsequent scheduled sprint cycle; tested in staging before promotion. |
| **Low / Informational** | $< 4.0$ | **$\le$ 60 Days** | Evaluated and resolved during regular quarterly dependency update cycles. |

Continuous compliance is enforced in CI via `npm audit --audit-level=high` and automated dependency tracking against the GitHub Advisory Database.

---

## 2. Dependency Inventory, SBOM & Integrity Verification (ASVS V15.1.2 & V15.2.4)

- **Official Registry Exclusivity**: All dependencies and their transitive trees are pulled exclusively from the official Node Package Manager registry (`https://registry.npmjs.org/`). Untrusted third-party registries and unvetted git URLs are disallowed.
- **Cryptographic Lockfile Enforcement**: `package-lock.json` pins exact semantic versions and SHA-512 subresource integrity hashes (`integrity: sha512-...`) for all 800+ installed packages, eliminating dependency confusion and supply chain tampering attacks.
- **Deterministic CI Builds**: All CI and container builds run `npm ci` rather than `npm install`, enforcing strict lockfile parity and refusing execution if the lockfile drifts from `package.json`.

---

## 3. Demanding Operations Defense & Resource Exhaustion Protection (ASVS V15.1.3 & V15.2.2)

To prevent Denial of Service (DoS), thread starvation, and event-loop blocking:

### 3.1 PDF Ingestion & Parsing Size Limits
- Large or crafted binary uploads can cause memory spikes. The application enforces a strict **50MB ceiling** (`MAX_PDF_BUFFER_BYTES = 50 * 1024 * 1024`) in `src/services/ai/tor-extractor.ts`.
- Files exceeding 50MB are immediately rejected before passing into compression parsers or AI multimodal endpoints.
- Archive extraction (`src/services/ingestion/document-extractor.ts`) enforces zip-bomb defenses: max 500 entries, max 100MB per entry, max 500MB total expansion, and a max 500:1 compression ratio limit.

### 3.2 Vertex AI Timeout & Graceful Rule-Based Fallback
- Calls to Google Cloud Vertex AI enforce an explicit **10-second timeout** (`VERTEX_AI_TIMEOUT_MS = 10000`) using `withTimeout(...)`.
- If Vertex AI exceeds 10,000 ms, experiences quota exhaustion (HTTP 429), or loses connectivity, the request gracefully catches the error and falls back immediately to the deterministic keyword classifier (`classifyByKeywords`) without failing the user-facing request.

### 3.3 Rate Limiting & Asynchronous Queuing
- High-frequency write routes and authentication endpoints (`/api/auth/logout`, `/api/auth/me`) are bounded by in-memory rate limiters (`AUTH_LOGOUT_LIMITER`, `AUTH_ME_WRITE_LIMITER`).
- Ingestion failures cascade into the MongoDB Dead Letter Queue (`SyncError`) for resilient asynchronous retries.

---

## 4. Container Sandboxing & Resource Constraints (ASVS V15.1.5 & V15.2.5)

To guarantee that CPU-intensive operations (such as regex compilation or heavy document parsing) cannot starve the underlying host machine, container resource constraints are defined in `docker-compose.yml`:

```yaml
services:
  app:
    mem_limit: 1024m
    cpus: 2.0
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1024M
        reservations:
          cpus: '0.5'
          memory: 256M
```
- **Memory Ceiling**: Strict **1GB RAM cap** (`1024M`). Containers exceeding this threshold are bounded and isolated from host memory exhaustion.
- **CPU Quota**: Strict **2.0 vCPU limit**, preventing thread starvation on shared compute nodes.

---

## 5. Production Build Hygiene & Attack Surface Reduction (ASVS V15.2.3)

- **Multi-Stage Containerization**: `Dockerfile` utilizes a 3-stage architecture (`deps` $\to$ `builder` $\to$ `runner`).
- **Exclusion of Non-Production Assets**:
  - The final production image copies only the standalone Next.js bundle (`.next/standalone`) and minimal production dependencies.
  - Test suites (`src/**/__tests__`), mock fixtures, TypeScript compilers, ESLint configurations, and Git metadata (`.git`, `.gitignore`) are stripped via `.dockerignore`.
  - Development tools and devDependencies are excluded (`NODE_ENV=production`).

---

## 6. Defensive Coding Practices (ASVS V15.3)

### 6.1 Data Minimization in API Responses (ASVS V15.3.1)
- Endpoints return only the necessary subset of attributes required by the client UI.
- Administrative endpoints (`/api/admin/projects/[id]`) and public routes project specific fields using `.select(...)` and Zod serialization, withholding internal database timestamps, raw credentials, and system metadata.

### 6.2 Safe Backend Redirects (ASVS V15.3.2)
- Backend HTTP clients (`bma-client.ts`, `egp-client.ts`, `govspending-client.ts`) disallow automatic open redirects (`redirect: 'manual'`).
- The redirect validator `isSafeRedirectTarget` in `src/lib/safe-object.ts` ensures redirect targets strictly match same-origin relative paths or verified government domains.

### 6.3 Mass Assignment Prevention via Strict Zod Allowlisting (ASVS V15.3.3)
- All incoming mutation bodies are parsed through strict Zod schemas (`.strict()`), such as `AdminProjectUpdateSchema` and `BookmarkCreateSchema`.
- Any unmapped, unexpected, or privileged fields (e.g., `role`, `isAdmin`, `_id`, `__proto__`) cause the validation to immediately fail with HTTP 400 Bad Request, preventing Broken Object Property Level Authorization (BOPLA) and mass assignment.

### 6.4 Client IP Resolution via Trusted Proxy (ASVS V15.3.4)
- Client IP addresses are resolved using `getClientIp` in `src/lib/rate-limiter.ts` combined with `sanitizeIntermediaryHeaders` in `src/lib/trusted-proxy.ts`.
- Untrusted user-supplied `X-Forwarded-For` or `X-User-ID` headers from untrusted networks are stripped in middleware.

### 6.5 Strict Type Safety & Comparison (ASVS V15.3.5)
- TypeScript compiler enforces strict mode (`"strict": true` in `tsconfig.json`).
- Application logic enforces strict triple-equals comparisons (`===`, `!==`) and runtime type coercion via Zod (`z.coerce.number()`), preventing JavaScript type juggling vulnerabilities.

### 6.6 Prototype Pollution Prevention (ASVS V15.3.6)
- The utility module `src/lib/safe-object.ts` provides:
  - `isPrototypePollutionKey(key)`: Identifies dangerous keys (`__proto__`, `constructor`, `prototype`).
  - `sanitizeObject(input)`: Recursively strips prototype-polluting keys.
  - `createSafeDict()`: Instantiates null-prototype dictionaries (`Object.create(null)`).
  - `safeJsonParse(str, fallback)`: Custom reviver function discarding forbidden prototype keys during deserialization.

### 6.7 HTTP Parameter Pollution Defenses (ASVS V15.3.7)
- `getSafeSingleParam` in `src/lib/safe-object.ts` flattens array-injected query parameters (e.g., `?id=1&id=2`) to guarantee single string processing, preventing parameter pollution attacks in search and filtering routes.

---

## 7. Safe Concurrency & TOCTOU Race Condition Prevention (ASVS V15.4.2)

- **Atomic Database Operations**: Ingestion and synchronization pipelines (`src/services/database/procurement.ts`) execute batched updates using atomic MongoDB `bulkWrite` operations with `{ upsert: true }`:
  ```typescript
  ProcurementProject.bulkWrite(operations, { ordered: false });
  ```
- **Compound Unique Indexes**: `ProcurementProjectSchema.index({ externalProjectId: 1 }, { unique: true })` guarantees that duplicate insertions are rejected atomically at the database engine level, eliminating Time-of-Check to Time-of-Use (TOCTOU) race conditions during concurrent crawler execution.
- **Atomic Find-and-Modify**: Administrative updates use atomic `findOneAndUpdate({ ... }, { $set: updateFields }, { returnDocument: 'after' })` to prevent read-then-write race windows.
