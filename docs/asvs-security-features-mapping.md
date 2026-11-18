# TORBIDD ASVS Security Features & Requirements Mapping
**OWASP Application Security Verification Standard (ASVS) v4.0.3 Mapping for GitHub Project Board**  
**Target Chapters:** V5, V12, V13, V14, V15, V16, V17

---

## 📋 Traceability & Verification Audit Note: Does this cover all necessary requirements?

**YES. 100% of all planned/necessary requirements (`Plan = TRUE`) from the Excel table are fully covered.**

### Coverage Audit Breakdown:

| ASVS Chapter in Excel | Excel Chapter Name | Total Requirements in Excel | Planned / Necessary (`Plan = TRUE`) | Excluded / Out of Scope (`Plan = FALSE`) | Mapped Security Feature | Coverage Rate |
|---|---|---|---|---|---|---|
| **V5** | File Handling | 13 | **8** | 5 | **SEC-08** | **100%** (8/8) |
| **V12** | Secure Communication | 12 | **7** | 5 | **SEC-17** | **100%** (7/7) |
| **V13** | Configuration | 21 | **18** | 3 | **SEC-18** | **100%** (18/18) |
| **V14** | Data Protection | 13 | **12** | 1 | **SEC-19** | **100%** (12/12) |
| **V15** | Secure Coding and Architecture | 21 | **17** | 4 | **SEC-20** | **100%** (17/17) |
| **V16** | Security Logging and Error Handling | 17 | **16** | 1 | **SEC-21** | **100%** (16/16) |
| **V17** | WebRTC | 12 | **0** | 12 | **SEC-22** *(Boundary)* | **100%** (0 planned) |
| **TOTAL** | **Chapters V5, V12–V17** | **109** | **78** | **31** | **6 Core Features + 1 Scope Boundary** | **100% Coverage (78/78)** |

---

### Detailed Excel Row Cross-Reference Note:

1. **SEC-08 (File Handling)**:
   - **Origin in Excel:** Chapter V5, Sections V5.1, V5.2, V5.3, V5.4.
   - **All 8 Planned Requirements Covered:** V5.1.1, V5.2.1, V5.2.2, V5.3.1, V5.3.2, V5.4.1, V5.4.2, V5.4.3.
   - *5 Excluded in Excel (`Plan = FALSE`):* V5.2.3, V5.2.4, V5.2.5, V5.2.6, V5.3.3 (Reason: TORBIDD processes public PDFs, no user file uploads or archive decompression).

2. **SEC-17 (Secure Communication)**:
   - **Origin in Excel:** Chapter V12, Sections V12.1, V12.2, V12.3.
   - **All 7 Planned Requirements Covered:** V12.1.1, V12.1.2, V12.2.1, V12.2.2, V12.3.1, V12.3.2, V12.3.3.
   - *5 Excluded in Excel (`Plan = FALSE`):* V12.1.3, V12.1.4, V12.1.5, V12.3.4, V12.3.5 (Reason: Monolithic Next.js architecture, no mTLS or intra-service mesh needed).

3. **SEC-18 (Configuration)**:
   - **Origin in Excel:** Chapter V13, Sections V13.1, V13.2, V13.3, V13.4.
   - **All 18 Planned Requirements Covered:** V13.1.1, V13.1.2, V13.1.3, V13.1.4, V13.2.2, V13.2.3, V13.2.4, V13.2.5, V13.2.6, V13.3.1, V13.3.2, V13.3.4, V13.4.1, V13.4.2, V13.4.3, V13.4.4, V13.4.5, V13.4.7.
   - *3 Excluded in Excel (`Plan = FALSE`):* V13.2.1, V13.3.3, V13.4.6 (Reason: No HSM hardware or multi-service short-term tokens required).

4. **SEC-19 (Data Protection)**:
   - **Origin in Excel:** Chapter V14, Sections V14.1, V14.2, V14.3.
   - **All 12 Planned Requirements Covered:** V14.1.1, V14.1.2, V14.2.1, V14.2.2, V14.2.3, V14.2.4, V14.2.5, V14.2.6, V14.2.7, V14.3.1, V14.3.2, V14.3.3.
   - *1 Excluded in Excel (`Plan = FALSE`):* V14.2.8 (Reason: No user file upload feature).

5. **SEC-20 (Secure Coding and Architecture)**:
   - **Origin in Excel:** Chapter V15, Sections V15.1, V15.2, V15.3, V15.4.
   - **All 17 Planned Requirements Covered:** V15.1.1, V15.1.2, V15.1.3, V15.1.5, V15.2.1, V15.2.2, V15.2.3, V15.2.4, V15.2.5, V15.3.1, V15.3.2, V15.3.3, V15.3.4, V15.3.5, V15.3.6, V15.3.7, V15.4.2.
   - *4 Excluded in Excel (`Plan = FALSE`):* V15.1.4, V15.4.1, V15.4.3, V15.4.4 (Reason: Single-threaded Node.js event-driven runtime; no manual multi-threading locks).

6. **SEC-21 (Security Logging and Error Handling)**:
   - **Origin in Excel:** Chapter V16, Sections V16.1, V16.2, V16.3, V16.4, V16.5.
   - **All 16 Planned Requirements Covered:** V16.1.1, V16.2.1, V16.2.2, V16.2.3, V16.2.4, V16.2.5, V16.3.1, V16.3.2, V16.3.3, V16.3.4, V16.4.1, V16.4.2, V16.5.1, V16.5.2, V16.5.3, V16.5.4.
   - *1 Excluded in Excel (`Plan = FALSE`):* V16.4.3 (Reason: Centralized container logging suffices for 12-week development phase).

7. **SEC-22 (WebRTC Boundary)**:
   - **Origin in Excel:** Chapter V17, Sections V17.1, V17.2, V17.3.
   - **All 12 Requirements in Excel are `Plan = FALSE`:** V17.1.1 - V17.3.2 (Reason: TORBIDD does not operate WebRTC, TURN, or media streaming servers).

---

# SEC-08: File Handling & Secure TOR Document Processing
> **Excel Origin:** Chapter V5 (File Handling) — Covers all 8 of 8 Planned Requirements (`V5.1.1`, `V5.2.1`, `V5.2.2`, `V5.3.1`, `V5.3.2`, `V5.4.1`, `V5.4.2`, `V5.4.3`)

## Description
Validates, stores, and serves Terms of Reference (TOR) specification PDFs and procurement documents collected from government portals (BMA e-GP and e-GP), preventing file injection, path traversal, and denial of service.

## Scope
Procurement document ingestion, PDF validation, document caching, and file download endpoints.

## ASVS Security Requirements
- V5.1.1: Documented permitted file types, extensions, maximum size, and safe handling before download/processing.
- V5.2.1: Enforce file size limits (25 MB cap) to prevent Denial of Service and resource exhaustion.
- V5.2.2: Validate file extension against content magic bytes (%PDF- / 0x25 0x50 0x44 0x46).
- V5.3.1: Untrusted files stored outside public web folders; disallow server-side script execution.
- V5.3.2: Internally generated safe storage paths (content hashes); prevent path traversal (../).
- V5.4.1: Ignore user-submitted filenames; specify controlled filenames in Content-Disposition.
- V5.4.2: Sanitize and encode filenames in HTTP response headers (RFC 6266) to prevent CRLF injection.
- V5.4.3: Ensure files from untrusted external sources are validated and scanned for malicious content.

## Related Files
- torbidd-app/src/services/ai/tor-extractor.ts
- torbidd-app/src/services/ingestion/clients/bma-client.ts
- torbidd-app/src/services/ingestion/clients/egp-client.ts
- torbidd-app/src/app/api/procurements/route.ts
- torbidd-app/src/services/ai/vertex-ai.ts

## Definition of Done (DoD)
- Ingestion pipeline strictly enforces a .pdf extension allowlist and rejects unlisted extensions.
- Binary magic bytes inspection (%PDF-) is performed before passing files to Vertex AI or text extractors.
- Ingestion and download endpoints reject files exceeding the 25 MB payload threshold.
- Storage keys use deterministic SHA-256 hashes (e.g., tor_${contentHash}.pdf) located strictly outside public web roots.
- Download endpoint sets Content-Type: application/pdf and sanitized Content-Disposition headers (RFC 6266).
- Path traversal sequences (../, ..\\, %2e%2e%2f) are rejected with HTTP 400.

## Use Cases
- UC-2: View Procurement Details & Download TOR Specification
- UC-9: Extract and Classify TOR Information
- UC-10: Software Procurement Discovery & Multi-Source Filtering

---

# SEC-17: Transport Layer Security & Encrypted Service Communications
> **Excel Origin:** Chapter V12 (Secure Communication) — Covers all 7 of 7 Planned Requirements (`V12.1.1`, `V12.1.2`, `V12.2.1`, `V12.2.2`, `V12.3.1`, `V12.3.2`, `V12.3.3`)

## Description
Enforces modern TLS encryption across all client-to-server and service-to-service communications, prioritizing forward-secrecy cipher suites, mandating HTTPS with HSTS, and securing database, AI, and external API traffic.

## Scope
Ingress/reverse proxy, Next.js middleware, MongoDB Atlas connections, Vertex AI SDK calls, and external government API fetch requests.

## ASVS Security Requirements
- V12.1.1: Support only TLS 1.2 and TLS 1.3 (preferring TLS 1.3); disable TLS 1.0 and 1.1.
- V12.1.2: Enable only approved cipher suites supporting forward secrecy (ECDHE).
- V12.2.1: Enforce TLS for all client-facing traffic without falling back to unencrypted HTTP.
- V12.2.2: Use publicly trusted, valid TLS certificates on external-facing endpoints.
- V12.3.1: Encrypt all inbound and outbound connections (MongoDB Atlas, Vertex AI, APIs) using TLS.
- V12.3.2: Validate remote TLS certificates on outbound connections; reject invalid or expired certs.
- V12.3.3: Use TLS or transport encryption for all internal HTTP service communications.

## Related Files
- torbidd-app/src/middleware.ts
- torbidd-app/next.config.ts
- torbidd-app/src/lib/mongodb.ts
- torbidd-app/src/services/ai/vertex-ai.ts
- docker-compose.yml
- torbidd-app/Dockerfile

## Definition of Done (DoD)
- Ingress server and reverse proxy reject TLS 1.0/1.1 connections and disallow weak ciphers (RC4, 3DES, CBC).
- Middleware redirects all unencrypted HTTP requests to HTTPS with 301/308 status codes.
- Strict-Transport-Security (HSTS) header is included on all responses (max-age=31536000; includeSubDomains; preload).
- MongoDB connection string mandates TLS encryption (mongodb+srv:// URI with tls=true).
- Node.js outbound fetch requests enforce certificate validation (NODE_TLS_REJECT_UNAUTHORIZED=1).

## Use Cases
- UC-1: Sign In with Google OAuth
- UC-7: Configure and Receive Opportunity Alerts
- UC-10: Software Procurement Discovery & Multi-Source Filtering

---

# SEC-18: Environment Hardening & Centralized Secrets Management
> **Excel Origin:** Chapter V13 (Configuration) — Covers all 18 of 18 Planned Requirements (`V13.1.1`, `V13.1.2`, `V13.1.3`, `V13.1.4`, `V13.2.2`, `V13.2.3`, `V13.2.4`, `V13.2.5`, `V13.2.6`, `V13.3.1`, `V13.3.2`, `V13.3.4`, `V13.4.1`, `V13.4.2`, `V13.4.3`, `V13.4.4`, `V13.4.5`, `V13.4.7`)

## Description
Hardens application configurations, connection pools, and secrets across production and development environments, eliminating hardcoded credentials, mitigating SSRF with domain allowlisting, and preventing information leakage.

## Scope
Docker containerization, environment variables, MongoDB connection pools, outbound network clients, and administrative endpoints.

## ASVS Security Requirements
- V13.1.1: Document all external communication needs and integration endpoints.
- V13.1.2: Document and configure connection pool limits (MongoDB max pool size: 10) and fallback behaviors.
- V13.1.3: Define resource management strategies (timeouts, exponential backoff retries, Dead Letter Queue routing).
- V13.1.4: Document critical application secrets and rotation schedule.
- V13.2.2: Backend components and database accounts operate with least necessary privileges.
- V13.2.3: Disallow default credentials across services and database accounts (no root/root or admin/admin).
- V13.2.4: Outbound network allowlist for external resources and systems (mitigate SSRF).
- V13.2.5: Server-level allowlist defining permitted outbound request destinations.
- V13.2.6: Enforce connection timeouts and retry strategies across external service connections.
- V13.3.1: Centralized secrets management; secrets excluded from source code and Docker build layers.
- V13.3.2: Restrict secret asset access adhering strictly to least privilege.
- V13.3.4: Define secret expiration and rotation schedule.
- V13.4.1: Exclude source control metadata (.git, .svn) from production deployments.
- V13.4.2: Disable debug modes and verbose development error messages in production.
- V13.4.3: Disable web server directory listing.
- V13.4.4: Disable HTTP TRACE method in production environments.
- V13.4.5: Restrict internal API documentation and administrative endpoints from unauthorized access.
- V13.4.7: Configure web tier to serve only intended static file extensions.

## Related Files
- torbidd-app/.env.example
- torbidd-app/next.config.ts
- torbidd-app/Dockerfile
- torbidd-app/src/lib/mongodb.ts
- torbidd-app/src/services/ingestion/clients/bma-client.ts
- torbidd-app/src/services/database/dlq.ts
- torbidd-app/src/app/api/admin/

## Definition of Done (DoD)
- Secrets (MONGODB_URI, GOOGLE_CLIENT_SECRET, CRON_SECRET) are managed exclusively through environment variables; git status confirms .env.local is ignored.
- Outbound crawler requests validate target URLs against approved domains (egp2.bangkok.go.th, process3.gprocurement.go.th, data.go.th) and reject private RFC 1918 IPs.
- MongoDB connection pool is bounded (maxPoolSize: 10, serverSelectionTimeoutMS: 5000).
- Multi-stage Docker production image strips .git directories, tests, and devDependencies.
- HTTP TRACE requests return HTTP 405 Method Not Allowed.
- Admin API endpoints (/api/admin/*) require valid authenticated session tokens and admin role authorization.

## Use Cases
- UC-4: Review and Verify AI Classifications
- UC-10: Software Procurement Discovery & Multi-Source Filtering
- UC-11: Manage Users & System Administration

---

# SEC-19: Data Protection, Privacy Controls & Transport Security
> **Excel Origin:** Chapter V14 (Data Protection) — Covers all 12 of 12 Planned Requirements (`V14.1.1`, `V14.1.2`, `V14.2.1`, `V14.2.2`, `V14.2.3`, `V14.2.4`, `V14.2.5`, `V14.2.6`, `V14.2.7`, `V14.3.1`, `V14.3.2`, `V14.3.3`)

## Description
Protects sensitive user and procurement data throughout its lifecycle according to Thai PDPA principles, enforcing data classification, body-only transmission, anti-caching headers, automated retention pruning, and browser storage hardening.

## Scope
MongoDB data models (User, Bookmark, Notification, SyncError), Next.js API route headers, browser storage, and session termination.

## ASVS Security Requirements
- V14.1.1: Identify and classify sensitive data into protection levels (Public, Internal, Confidential).
- V14.1.2: Document protection requirements per data classification level (encryption, retention, logging).
- V14.2.1: Sensitive data sent only in HTTP body or headers, never in URLs or query strings.
- V14.2.2: Prevent sensitive data from being cached in server components or intermediate proxies.
- V14.2.3: Prohibit transmitting sensitive user data to untrusted third parties or analytics trackers.
- V14.2.4: Enforce documented protection controls across storage, logs, and database records.
- V14.2.5: Configure cache to prevent Web Cache Deception (return 404 on nonexistent files).
- V14.2.6: Data minimization in API responses (return only required fields, mask internal IDs).
- V14.2.7: Enforce automated retention schedules and deletion for transient logs and expired records.
- V14.3.1: Clear authenticated data from client storage and DOM upon session termination.
- V14.3.2: Set anti-caching HTTP response headers (Cache-Control: no-store) for sensitive/authenticated routes.
- V14.3.3: Disallow sensitive data in browser localStorage, sessionStorage, or IndexedDB.

## Related Files
- torbidd-app/src/models/User.ts
- torbidd-app/src/models/Bookmark.ts
- torbidd-app/src/models/Notification.ts
- torbidd-app/src/models/SyncError.ts
- torbidd-app/src/app/api/bookmarks/route.ts
- torbidd-app/src/app/api/notifications/route.ts
- torbidd-app/src/components/Navbar.tsx

## Definition of Done (DoD)
- Sensitive identifiers and tokens are passed exclusively in JSON request bodies or Authorization headers, never in query strings.
- Dynamic authenticated endpoints emit Cache-Control: no-store, no-cache, must-revalidate.
- MongoDB TTL index automatically prunes Dead Letter Queue sync error logs after 30 days.
- User session tokens rely on HttpOnly cookies; localStorage contains zero tokens or credentials.
- Logout action clears client React state, invalidates session cookies, and emits Clear-Site-Data headers.
- Third-party tracking scripts and analytics pixels are completely absent from the application.

## Use Cases
- UC-1: Sign In with Google OAuth
- UC-3: Bookmark & Save Opportunities
- UC-7: Configure and Receive Opportunity Alerts
- UC-11: Manage Users & Notification Center

---

# SEC-20: Defensive API Architecture, Supply Chain Security & Resiliency
> **Excel Origin:** Chapter V15 (Secure Coding and Architecture) — Covers all 17 of 17 Planned Requirements (`V15.1.1`, `V15.1.2`, `V15.1.3`, `V15.1.5`, `V15.2.1`, `V15.2.2`, `V15.2.3`, `V15.2.4`, `V15.2.5`, `V15.3.1`, `V15.3.2`, `V15.3.3`, `V15.3.4`, `V15.3.5`, `V15.3.6`, `V15.3.7`, `V15.4.2`)

## Description
Embeds defensive coding practices across the Next.js/Node.js stack to eliminate mass assignment, prototype pollution, and resource exhaustion, while securing the software supply chain and preventing TOCTOU race conditions.

## Scope
API input validation, TypeScript compilation, dependency management, Vertex AI integration, and database operations.

## ASVS Security Requirements
- V15.1.1: Document risk-based vulnerability remediation timeframes for third-party dependencies.
- V15.1.2: Maintain dependency inventory/SBOM from trusted repositories (npm).
- V15.1.3: Document and defend against resource exhaustion on demanding operations (PDF parsing, Vertex AI).
- V15.1.5: Document and sandbox dangerous functionality using container resource limits.
- V15.2.1: Production dependencies comply with vulnerability update and remediation timeframes.
- V15.2.2: Implement defenses against loss of availability (PDF size limits, request timeouts, rate limits).
- V15.2.3: Production build excludes test code, mock snippets, and development-only utilities.
- V15.2.4: Verify package integrity using lockfiles (package-lock.json) to prevent dependency confusion.
- V15.2.5: Sandbox resource-demanding operations with Docker container constraints.
- V15.3.1: Return only required subset of fields from data objects in API responses.
- V15.3.2: Backend fetch calls do not follow external redirects automatically unless intended.
- V15.3.3: Countermeasures against mass assignment attacks via Zod allowlisting per action.
- V15.3.4: Accurately resolve client IP addresses via trusted reverse proxy headers for rate limiting.
- V15.3.5: Enforce strict type comparisons and explicit type validations in application code.
- V15.3.6: Prototype pollution prevention via safe object handling (Map/Set, Object.create(null)).
- V15.3.7: Defenses against HTTP parameter pollution.
- V15.4.2: Enforce atomic state checks and updates to prevent TOCTOU race conditions.

## Related Files
- torbidd-app/package.json
- torbidd-app/package-lock.json
- torbidd-app/src/lib/validations/
- torbidd-app/src/services/ai/vertex-ai.ts
- torbidd-app/src/services/database/procurement.ts
- torbidd-app/src/app/api/admin/projects/[id]/route.ts

## Definition of Done (DoD)
- CI pipeline executes npm audit --audit-level=high and enforces lockfile consistency with npm ci.
- All inbound API bodies are validated via strict Zod schemas, stripping unexpected fields and blocking mass assignment.
- Docker containers enforce CPU and memory limits (1GB RAM cap) to isolate heavy extraction tasks.
- Vertex AI prompt calls enforce a 10s timeout with graceful fallback to rule-based classification.
- Database writes use atomic bulkWrite and compound unique indexes, eliminating TOCTOU race conditions.
- TypeScript compiler passes with strict: true and zero type errors.

## Use Cases
- UC-4: Review and Verify AI Classifications
- UC-9: Extract and Classify TOR Information
- UC-10: Software Procurement Discovery & Multi-Source Filtering

---

# SEC-22: Security Audit Logging & Fail-Secure Error Handling
> **Excel Origin:** Chapter V16 (Security Logging and Error Handling) — Covers all 16 of 16 Planned Requirements (`V16.1.1`, `V16.2.1`, `V16.2.2`, `V16.2.3`, `V16.2.4`, `V16.2.5`, `V16.3.1`, `V16.3.2`, `V16.3.3`, `V16.3.4`, `V16.4.1`, `V16.4.2`, `V16.5.1`, `V16.5.2`, `V16.5.3`, `V16.5.4`)

## Description
Establishes structured JSON security audit logging with UTC synchronization, redacting sensitive tokens and preventing log injection, alongside fail-secure error handlers that return generic messages and prevent process crashes.

## Scope
Global error boundaries (error.tsx), authentication middleware, Dead Letter Queue (DLQ), and alert notification services.

## ASVS Security Requirements
- V16.1.1: Document application logging inventory (events, formats, storage, retention).
- V16.2.1: Log entries include essential metadata (timestamp, user, IP, event, resource, outcome).
- V16.2.2: Synchronize time sources and enforce ISO 8601 UTC timestamps across all logging components.
- V16.2.3: Store logs only to documented, approved destinations.
- V16.2.4: Use structured JSON format for log searchability and correlation.
- V16.2.5: Enforce log data sanitization (never log credentials, tokens, or masked secrets).
- V16.3.1: Log all authentication events (successful and failed Google OAuth sign-in attempts).
- V16.3.2: Log failed authorization attempts (unauthorized admin panel accesses, forbidden actions).
- V16.3.3: Log security control bypass attempts, rate-limit triggers, and validation failures.
- V16.3.4: Log unexpected system errors and external service failures (database drops, TLS errors).
- V16.4.1: Prevent log injection by sanitizing untrusted user inputs (CRLF escaping).
- V16.4.2: Restrict log access and protect audit logs from unauthorized modification.
- V16.5.1: Return generic error messages to consumers without leaking stack traces or internal queries.
- V16.5.2: Ensure graceful degradation and circuit breaking when external services (Vertex AI, e-GP) fail.
- V16.5.3: Ensure fail-secure operation; prevent fail-open state on validation or authorization errors.
- V16.5.4: Implement a last-resort global error handler to catch unhandled exceptions and prevent process crashes.

## Related Files
- torbidd-app/src/app/error.tsx
- torbidd-app/src/middleware.ts
- torbidd-app/src/services/database/dlq.ts
- torbidd-app/src/services/notifications/alert-service.ts
- torbidd-app/src/app/api/admin/

## Definition of Done (DoD)
- Application logs use structured JSON formatting with ISO 8601 UTC timestamps, user IDs, and client IP addresses.
- Passwords, OAuth client secrets, Google ID tokens, and session cookies are automatically redacted before logging.
- CRLF characters (\r\n) in logged user inputs are escaped to eliminate log forging attacks.
- Failed administrative requests log unauthorized access attempts with HTTP 403 status codes.
- Production error responses return generic messages ({ error: "Internal Server Error" }) with zero exposed stack traces.
- Global Node.js process handlers (unhandledRejection, uncaughtException) safely catch unhandled errors.

## Use Cases
- UC-1: Sign In with Google OAuth
- UC-4: Review and Verify AI Classifications
- UC-10: Software Procurement Discovery & Multi-Source Filtering
- UC-11: Manage Users & System Administration

---

# SEC-22: WebRTC Architectural Scope Exclusion (ASVS V17)
> **Excel Origin:** Chapter V17 (WebRTC) — All 12 of 12 Requirements in Excel are `Plan = FALSE` (`V17.1.1` - `V17.3.2`)

## Description
Documents the architectural boundary confirming that WebRTC, TURN/STUN servers, and real-time media streaming infrastructure are completely excluded from the TORBIDD platform, eliminating WebRTC-related attack surfaces.

## Scope
System architecture, network port allocations, and threat modeling documentation.

## ASVS Security Requirements
- V17.1.1: TURN server IP filtering (Plan=FALSE; no TURN server operated).
- V17.1.2: TURN resource exhaustion protection (Plan=FALSE; no TURN server operated).
- V17.2.1 - V17.2.8: DTLS, SRTP, and media server protections (Plan=FALSE; no media servers operated).
- V17.3.1 - V17.3.2: Signaling server rate limiting and message handling (Plan=FALSE; no signaling server operated).

## Related Files
- docs/TORBIDD SRS.pdf
- docs/TORBIDD System Architecture and Data Flow.png
- docker-compose.yml

## Definition of Done (DoD)
- System Architecture Specification explicitly records that WebRTC, TURN, and SRTP protocols are not implemented.
- Docker container maps only HTTP/HTTPS web ports (TCP 3000 / 443); zero UDP media ports are bound or exposed.
- Threat model classifies all 12 requirements in ASVS Chapter V17 as non-applicable with zero residual risk.

## Use Cases
- System-wide Architecture & Scope Boundary
