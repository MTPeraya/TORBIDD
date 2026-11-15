# Authentication Security

> ASVS coverage: **V6.1.1** (Authentication Documentation) · **V6.3.1** (Brute-Force / Credential-Stuffing Protection)

---

## Overview

TORBIDD uses **Google OAuth 2.0** as the sole authentication mechanism (use case UC-1: Sign In with Google OAuth).  
There are no locally-managed passwords. The authentication flow is:

```
Browser → GET /api/auth/google  (1. initiate OAuth, set state cookie)
       → Google Accounts         (2. user authenticates with Google)
       → GET /api/auth/callback/google (3. exchange code, create session)
       → Redirect to app         (4. session cookie set, user is logged in)
```

Session tokens are HMAC-SHA-256-signed with a server-side secret (`SESSION_SECRET` env var). They are stored in `httpOnly`, `SameSite=Lax` cookies and expire after **7 days**.

---

## Rate Limiting (SEC-01)

### Design

A **sliding-window in-memory rate limiter** (`src/lib/rate-limiter.ts`) is applied to all authentication-related endpoints.  
The limiter is keyed on the client's IP address (extracted from `X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP` headers, in that order).

| Endpoint | Limiter ID | Window | Max requests | Purpose |
|---|---|---|---|---|
| `GET /api/auth/google` | `auth-google-initiate` | 10 min | 20 | Stop automated redirect floods |
| `GET /api/auth/callback/google` | `auth-callback-google` | 5 min | 10 | Throttle state-token brute-force |
| `POST /api/auth/logout` | `auth-logout` | 1 min | 30 | Prevent logout-flood interference |
| `PUT /api/auth/me` | `auth-me-write` | 1 min | 10 | Throttle profile-update abuse |

### Behaviour when limit is exceeded

- **Initiate / callback endpoints** return HTTP **429 Too Many Requests** (or redirect to `/login?error=rate_limited`) with a `Retry-After: <seconds>` header.
- **Logout / me-write endpoints** return HTTP **429** JSON with `retryAfter` field.
- All rate-limit counters expire automatically at the end of their window — **no permanent lockout is possible**.

### Response headers (informational)

All auth endpoints add these headers to every response (not just 429):

```
X-RateLimit-Limit:     <max requests in window>
X-RateLimit-Remaining: <requests remaining>
X-RateLimit-Reset:     <Unix epoch seconds when window resets>
Retry-After:           <seconds> (only on 429 responses)
```

### No permanent lockout

An attacker cannot permanently block a legitimate user because:
1. Counters are time-windowed and reset automatically.
2. Blocking is per-IP, not per-account. A legitimate user on a different network is unaffected.
3. After the window expires the counter starts fresh — the user can retry normally.

### Configuration

Limits are defined as exported constants in `src/lib/rate-limiter.ts`:

```ts
export const AUTH_INITIATE_LIMITER: RateLimitConfig  = { windowMs: 10 * 60 * 1000, max: 20 };
export const AUTH_CALLBACK_LIMITER: RateLimitConfig  = { windowMs:  5 * 60 * 1000, max: 10 };
export const AUTH_LOGOUT_LIMITER:   RateLimitConfig  = { windowMs:      60 * 1000, max: 30 };
export const AUTH_ME_WRITE_LIMITER: RateLimitConfig  = { windowMs:      60 * 1000, max: 10 };
```

Adjust these constants and redeploy to change limits without code changes in the route handlers.

### Production considerations

The current implementation stores counters in **module-level memory** (Node.js process). This is correct for single-instance deployments (Docker Compose, single-container App Hosting).

For **horizontally-scaled** (multi-instance) production deployments, replace the in-memory `store` Map in `rate-limiter.ts` with a shared Redis store (e.g. `ioredis` with a sliding-window Lua script). The public API (`checkRateLimit`, `resetRateLimit`) remains unchanged — only the backing store needs to change.

---

## CSRF Protection

OAuth `state` tokens are:
- Generated with `crypto.randomBytes(16)` (128-bit entropy).
- HMAC-SHA-256-signed with the server secret.
- Stored in an `httpOnly`, `SameSite=Lax` cookie with a 10-minute TTL.
- Verified on the callback before the code exchange is performed.

This prevents cross-site request forgery on the OAuth callback.

---

## Session Security

| Property | Value |
|---|---|
| Algorithm | HMAC-SHA-256 |
| Secret source | `SESSION_SECRET` env var (falls back to `AUTH_SECRET`) |
| Cookie flags | `httpOnly=true`, `secure=true` (in HTTPS), `SameSite=Lax` |
| Expiry | 7 days |
| Timing-safe comparison | `crypto.timingSafeEqual` used in `verifySession` |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes (prod) | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes (prod) | Google OAuth 2.0 client secret |
| `SESSION_SECRET` | **Strongly recommended** | ≥32-byte random string for HMAC signing |
| `ADMIN_EMAILS` | Optional | Comma-separated emails granted `admin` role on first login |
| `NEXT_PUBLIC_APP_URL` | Yes (prod) | Canonical app URL (used to build OAuth redirect URI) |

> **Warning:** If `SESSION_SECRET` is not set, the application falls back to a hardcoded development key. This key is public knowledge and must never be used in production.
