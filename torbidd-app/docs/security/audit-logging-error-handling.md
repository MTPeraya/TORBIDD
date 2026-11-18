# SEC-22: Security Audit Logging, Fail-Secure Error Handling & WebRTC Scope Exclusion

This document defines TORBIDD's security audit logging architecture, time synchronization, sensitive token redaction, fail-secure error boundaries, and WebRTC architectural scope exclusion in compliance with **OWASP ASVS v4.0.3 Chapter 16 (Security Logging and Error Handling)** and **Chapter 17 (WebRTC)**.

---

## 1. Security Logging Inventory & Architecture (ASVS V16.1.1, V16.2.3, V16.4.2)

TORBIDD implements a centralized, structured JSON security audit logging mechanism (`src/lib/audit-logger.ts`) across all application layers:

| Layer / Component | Logged Events | Format | Approved Destination | Access Control | Retention Schedule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication Service** | Successful Google OAuth logins (`AUTH_LOGIN_SUCCESS`), failed logins (`AUTH_LOGIN_FAILURE`), state/nonce mismatches | Structured JSON | Container `stdout` $\to$ Cloud Logging | Restricted to Security Admins | 90 Days |
| **Authorization / Middleware** | Unauthorized access attempts (`AUTHZ_ACCESS_DENIED`), forbidden admin API calls (HTTP 403), TRACE method blocks | Structured JSON | Container `stdout` $\to$ Cloud Logging | Restricted to Security Admins | 90 Days |
| **Ingestion & AI Pipeline** | Dead Letter Queue errors (`DLQ_SYNC_ERROR_ENQUEUED`), alert threshold triggers, external API drops | Structured JSON | MongoDB `sync_errors` + `stdout` | Administrators & Ingestion Operators | 30 Days (MongoDB TTL) / 90 Days (Audit) |
| **Security Controls** | Rate limit trips (`AI_CLASSIFY_LIMITER`, `AUTH_LOGOUT_LIMITER`), cleartext HTTP blocks (HTTP 426) | Structured JSON | Container `stdout` $\to$ Cloud Logging | Restricted to Security Admins | 90 Days |
| **Runtime & Node.js Process** | Uncaught exceptions (`UNCAUGHT_EXCEPTION`), unhandled promise rejections (`UNHANDLED_REJECTION`) | Structured JSON | Container `stderr` | System Engineers & Admins | 90 Days |

---

## 2. Structured Metadata & UTC Time Synchronization (ASVS V16.2.1, V16.2.2, V16.2.4)

Every security log entry adheres to a strict JSON schema providing complete forensic context:

```json
{
  "timestamp": "2026-11-18T10:15:30.124Z",
  "level": "SECURITY",
  "eventType": "AUTHZ_ACCESS_DENIED",
  "userId": "67119538991",
  "clientIp": "192.168.1.50",
  "resource": "/api/admin/users",
  "outcome": "BLOCKED",
  "details": {
    "reason": "Forbidden: Admin access required",
    "status": 403
  }
}
```

- **UTC Synchronization (ASVS V16.2.2)**: All timestamps are generated using `new Date().toISOString()`, enforcing unambiguous ISO 8601 UTC representation across distributed containers and cloud services.
- **Correlatable JSON (ASVS V16.2.4)**: Machine-readable JSON output enables automated parsing and alerting in Cloud Logging, Datadog, Elasticsearch, and SIEM platforms.

---

## 3. Data Sanitization & Log Injection Defenses (ASVS V16.2.5 & V16.4.1)

- **Sensitive Token Auto-Redaction (ASVS V16.2.5)**:
  - The logging pipeline automatically scrubs passwords, OAuth client secrets, Google ID tokens, Authorization headers, and session cookies (`__Host-torbidd_auth`).
  - Values corresponding to keys matching `/password|secret|token|cookie|authorization|bearer|credential/i` are replaced with `[REDACTED]`.
  - Bearer token strings (`Bearer eyJ...`) are automatically masked as `Bearer [REDACTED]`.
- **Log Injection / CRLF Escaping (ASVS V16.4.1)**:
  - Untrusted user strings (such as user inputs, query parameters, or search terms) are sanitized using `sanitizeLogString`.
  - Carriage return and line feed characters (`\r`, `\n`) are escaped to `\r` and `\n` literals, completely neutralizing log forging and split-entry attacks.

---

## 4. Fail-Secure Error Handling & Circuit Breaking (ASVS V16.5)

### 4.1 Generic Consumer Messages & Zero Stack Trace Leaks (ASVS V16.5.1)
- Public error responses return generic, sanitized messages:
  ```json
  { "error": "Internal Server Error" }
  ```
- Stack traces, internal SQL/MongoDB syntax queries, database connection strings, and system paths are never returned in production API payloads.
- The App Router error boundary (`src/app/error.tsx`) renders a user-friendly error card with zero internal diagnostics.

### 4.2 Graceful Degradation & Circuit Breaking (ASVS V16.5.2)
- When external services fail (e.g., Google Cloud Vertex AI rate limit HTTP 429, or e-GP timeout), the system degrades gracefully to deterministic keyword classification (`classifyByKeywords`) or routes failed ingestion items to the Dead Letter Queue without crashing the application.

### 4.3 Fail-Secure Operation (ASVS V16.5.3)
- All authorization checks default to **fail-closed** (deny-by-default). If a session token cannot be verified or a role is ambiguous, access is immediately blocked with HTTP 401 or 403.
- Database write transactions abort atomically on validation failure, preventing partial or inconsistent state updates.

### 4.4 Last-Resort Global Error Handlers (ASVS V16.5.4)
- Process-level unhandled errors are trapped via `src/lib/global-error-handler.ts`:
  ```typescript
  process.on('uncaughtException', (error) => {
    logSystemError('UNCAUGHT_EXCEPTION', error);
  });
  process.on('unhandledRejection', (reason) => {
    logSystemError('UNHANDLED_REJECTION', reason);
  });
  ```
- Prevents silent process termination and ensures diagnostic details are captured securely in audit logs.

---

## 5. WebRTC Architectural Scope Exclusion (ASVS Chapter 17)

### 5.1 Architecture Boundary & Threat Model Summary
TORBIDD is an open government procurement intelligence and tender analysis web application. Real-time media streaming, peer-to-peer audio/video conferencing, and WebRTC protocols are **entirely excluded from the platform architecture**:

| ASVS Chapter 17 Section | Protocol / Technology | Applicability | Architectural Rationale & Controls |
| :--- | :--- | :---: | :--- |
| **V17.1 TURN Server** (V17.1.1 - V17.1.2) | Traversal Using Relays around NAT (TURN) | **Plan: FALSE** (N/A) | TORBIDD does not operate, proxy, or connect to TURN/STUN relay servers. |
| **V17.2 Media** (V17.2.1 - V17.2.8) | DTLS, SRTP, RTP, Media Server | **Plan: FALSE** (N/A) | No real-time audio/video media servers, DTLS handshake keys, or SRTP streams exist in the codebase. |
| **V17.3 Signaling** (V17.3.1 - V17.3.2) | WebRTC Signaling Server, SDP Exchange | **Plan: FALSE** (N/A) | No WebRTC signaling or SDP exchange channels are operated. Client-server communications use standard HTTPS REST. |

### 5.2 Network Port & Protocol Verification
- **Container Port Mappings**: `docker-compose.yml` maps exclusively **TCP port 3000** (`3000:3000` / HTTP/HTTPS).
- **Zero UDP Ports Exposed**: No UDP port ranges (such as standard WebRTC UDP 10000–20000 or TURN UDP 3478/5349) are bound, mapped, or exposed to external networks.
- **Residual Risk**: Formally classified as **zero residual risk** with no WebRTC attack surface.
