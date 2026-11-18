# SEC-20: Data Protection, Privacy Controls & Transport Security

This document defines TORBIDD's comprehensive data protection architecture, privacy controls under Thai Personal Data Protection Act (PDPA B.E. 2562 / 2019), anti-caching enforcement, automated retention pruning, and client storage hardening in compliance with **OWASP ASVS v4.0.3 Chapter 14 (Data Protection)**.

---

## 1. Data Classification Scheme & Inventory (ASVS V14.1.1)

All data ingested, stored, processed, and transmitted by TORBIDD is classified into three distinct protection levels taking into account Thai PDPA compliance and public government procurement transparency mandates:

| Classification Level | Definition & Criteria | Examples in TORBIDD | PDPA / Legal Category |
| :--- | :--- | :--- | :--- |
| **Public Data** | Information intended for public distribution and open government transparency. Requires integrity verification but no confidentiality restrictions. | • Public procurement announcements (e-GP, BMA)<br>• Approved Terms of Reference (TOR) text<br>• Winning contractor awards and budget allocations<br>• Open government datasets (data.go.th) | Public Records / Official Information Act B.E. 2540 |
| **Internal Data** | Operational information intended solely for application operators and administrative monitoring. Unauthorized disclosure does not breach personal privacy but may reveal system topology. | • Dead Letter Queue (DLQ) ingestion failure logs<br>• Application telemetry and performance metrics<br>• Crawling and synchronization schedules<br>• Non-sensitive administrative audit events | Non-Personal System Operational Data |
| **Confidential Data** | Personally Identifiable Information (PII) and security credentials whose compromise could impact user privacy, identity integrity, or application access. | • User display name, email, avatar image<br>• Google OAuth Subject IDs (`googleId`)<br>• User bookmark collections and notification preferences<br>• HMAC-signed session tokens (`__Host-torbidd_auth`)<br>• Database connection strings and API secrets | Personal Data (Thai PDPA Sections 24 & 27) / Authentication Secrets |

---

## 2. Protection Requirements by Classification Level (ASVS V14.1.2 & V14.2.4)

Each protection level enforces strict technical and organizational controls covering encryption in transit, encryption at rest, access controls, retention, and logging sanitization:

| Security Domain | Public Data | Internal Data | Confidential Data |
| :--- | :--- | :--- | :--- |
| **Encryption in Transit** | TLS 1.3 / TLS 1.2 via HTTPS (HSTS enforced) | TLS 1.3 / TLS 1.2 across all internal/external endpoints | TLS 1.3 / TLS 1.2 with HSTS (`max-age=31536000; preload`) |
| **Encryption at Rest** | Encrypted MongoDB filesystem volumes (AES-256) | MongoDB storage engine encryption (WiredTiger AES-256) | MongoDB storage engine encryption + salted HMAC/Bcrypt hashing |
| **Access Control** | Open to unauthenticated and authenticated users | Restrict strictly to administrators (`/api/admin/*`, `isAdmin: true`) | Strict owner-scoped authorization (`userId` verification, RBAC) |
| **Retention Policy** | Preserved indefinitely for historical trend analysis | Automated pruning via MongoDB TTL index after **30 days** | Retained while user account is active; pruned upon account deletion |
| **Logging & Telemetry** | Logged with project ID and source URL | Logged with sanitized error messages; stack traces stripped of credentials | **Strictly prohibited**: zero PII, passwords, or tokens in server logs |
| **HTTP Caching** | Cacheable by reverse proxies with valid `ETag` | Anti-caching enforced (`Cache-Control: no-store`) | Anti-caching enforced (`Cache-Control: no-store, no-cache, private`) |

---

## 3. General Data Protection & Transport Security (ASVS V14.2)

### 3.1 Body and Header-Only Transmission (ASVS V14.2.1)
Sensitive identifiers, user credentials, and session tokens are transmitted exclusively through:
1. **HTTP Request Bodies**: Submitted as JSON payloads in POST/PUT/PATCH methods (e.g. `POST /api/auth/me`, `POST /api/bookmarks`).
2. **HTTP Headers**: Session identifiers and OAuth tokens reside in signed `Cookie` or `Authorization: Bearer` headers.
3. **URL and Query String Restrictions**: URLs and query strings never accept or reflect authentication tokens, user passwords, session secrets, or confidential user identifiers.

### 3.2 Anti-Caching Controls for Server & Proxies (ASVS V14.2.2 & V14.3.2)
To prevent sensitive user data from residing in intermediate caches, CDN edges, or browser disk caches:
- All `/api/*` endpoints and authenticated client routes (`/saved`, `/historical`, `/notifications`, `/admin`, `/settings`) emit standard anti-caching headers defined in `src/lib/security-headers.ts`:
  ```http
  Cache-Control: no-store, no-cache, must-revalidate, private
  Pragma: no-cache
  Expires: 0
  ```
- Dynamic Next.js API routes explicitly declare `export const dynamic = 'force-dynamic'` and leverage `applyAntiCacheHeaders(res)`.

### 3.3 Prohibition of Untrusted Third-Party Trackers (ASVS V14.2.3)
- TORBIDD is built with privacy-by-design principles: **zero third-party tracking scripts, analytics pixels (e.g., Google Analytics, Meta Pixel, Hotjar), or external ad beacons** are loaded or bundled in the application.
- All outbound requests are strictly confined to vetted, safe domains (`accounts.google.com`, `generativelanguage.googleapis.com`, and official Thai government portals).

### 3.4 Web Cache Deception Mitigation (ASVS V14.2.5)
- Nonexistent files and invalid routes immediately resolve to a dedicated `404 Not Found` page (`src/app/not-found.tsx`) with `Cache-Control: no-store`.
- Static asset rules in `next.config.ts` and `src/middleware.ts` distinguish static assets (`/_next/static/*`) from dynamic pages, preventing CDN proxies from caching sensitive HTML pages when crafted with static file extensions (e.g., `/api/auth/me/test.css`).

### 3.5 Data Minimization in API Responses (ASVS V14.2.6)
- Responses from `/api/auth/me` and `/api/bookmarks` return only the minimal required presentation fields (`id`, `name`, `email`, `role`, `org`, `picture`).
- Internal system attributes (e.g., Google OAuth access/refresh tokens, raw password hashes, internal database revision keys) are excluded at the schema level and never returned to the client.

### 3.6 Automated Retention Pruning via MongoDB TTL (ASVS V14.2.7)
Transient operational logs and Dead Letter Queue (DLQ) sync errors are pruned automatically using MongoDB native Time-To-Live (TTL) index:
- In `src/models/SyncError.ts`:
  ```typescript
  SyncErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
  ```
- Documents older than **30 days (2,592,000 seconds)** are automatically purged by MongoDB background workers, preventing unbounded disk growth and obsolete error retention.

---

## 4. Client-Side Data Protection & Storage Hardening (ASVS V14.3)

### 4.1 Session Termination & Client State Purge (ASVS V14.3.1)
When a user logs out (`POST /api/auth/logout`):
1. **Server-Side Invalidation**:
   - Clears `__Host-torbidd_auth` and `torbidd_auth` cookies with `maxAge: 0`.
   - Emits the `Clear-Site-Data` HTTP header:
     ```http
     Clear-Site-Data: "cache", "cookies", "storage"
     ```
2. **Client-Side Storage Purge**:
   - `AuthContext.tsx` and `Topbar.tsx` clear in-memory user state (`setUser(null)`).
   - Local browser cache items (`torbidd_profile`, `torbidd_settings`) are removed via `localStorage.removeItem(...)`.
   - `sessionStorage.clear()` executes to purge any temporary session variables.

### 4.2 Browser Storage Hardening (ASVS V14.3.3)
- **Zero Tokens in Web Storage**: Neither `localStorage`, `sessionStorage`, nor `IndexedDB` ever store JWT session tokens, OAuth bearer tokens, or user credentials.
- **Cookie Security**: Authentication state is maintained exclusively via secure cookies configured with:
  - `HttpOnly: true` (prevents JavaScript access and XSS exfiltration).
  - `Secure: true` (transmitted strictly over HTTPS in production).
  - `SameSite: 'Lax'` (mitigates CSRF while supporting top-level navigation).
  - `__Host-` prefix in production (enforces origin and path binding).
