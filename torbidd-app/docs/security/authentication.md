# Authentication & OpenID Connect Security Policy

> ASVS Coverage:
> - **V6.1.1**: Authentication Documentation
> - **V6.3.1**: Protection against credential stuffing and brute-force attacks
> - **V6.3.6**: Email must not be used as an authentication factor
> - **V6.7.1**: Protect trusted public keys and certificates
> - **V6.7.2**: Use sufficiently long and unique cryptographic nonce
> - **V6.8.2**: Validate authentication assertion signatures
> - **V6.8.4**: Validate authentication strength and recency information
> - **V10.1.1**: Restrict token access to components that require them
> - **V10.1.2**: Bind authorization responses to original session and transaction (PKCE)
> - **V10.2.1**: Protect OAuth authorization-code flow against CSRF
> - **V10.2.3**: Request only necessary OAuth scopes
> - **V10.5.1**: Validate OIDC nonce
> - **V10.5.2**: Identify users using Google's stable `sub` claim
> - **V10.5.3**: Validate the expected issuer
> - **V10.5.4**: Validate the ID Token audience

---

## 1. Authentication Architecture Overview

TORBIDD implements **delegated OpenID Connect (OIDC) & Google OAuth 2.0** as its single, authoritative authentication provider (UC-1). The application operates under a zero-passwords architecture:

```
[ Browser / Client ]
       │
       │ 1. GET /api/auth/google
       ▼
[ TORBIDD App Router ]
       │  - Rate-limiting verification (SEC-01)
       │  - Generate 256-bit OIDC nonce & PKCE (code_verifier / S256 code_challenge)
       │  - Store transaction state in HttpOnly, SameSite=Lax, Secure cookie
       │  - Redirect with scope: "openid email profile"
       ▼
[ Google Accounts Identity Provider ]
       │
       │ 2. User consents & authenticates
       │ 3. Redirect to /api/auth/callback/google?code=...&state=...
       ▼
[ TORBIDD Callback Router ]
       │  - Rate-limiting verification (SEC-01)
       │  - CSRF state verification & transaction binding (V10.2.1, V10.1.2)
       │  - Token exchange with PKCE code_verifier (V10.1.2)
       │  - RS256 signature verification via Google JWKS (V6.8.2, V6.7.1)
       │  - Validate claims: iss, aud, exp, iat, nonce (V10.5.1-4)
       │  - Extract stable Google `sub` claim (V10.5.2)
       │  - Resolve initial role & upsert user in MongoDB Atlas (SEC-02)
       │  - Issue server-signed HTTP-only session cookie (torbidd_auth_session)
       ▼
[ Logged-in User Session (7 Days) ]
```

---

## 2. Authentication Method Restrictions (SEC-03 / ASVS V6.3.6)

### Distinction Between Email Identification and Authentication
In TORBIDD, **email addresses are identifiers and communication endpoints, NOT authentication factors**:
- **Identifier**: Used as an account label to display user identity, filter saved preferences, and route procurement notifications.
- **Authentication**: Proof of identity is solely established by Google's cryptographically signed OIDC ID Token bearing a verified `sub` claim and `email_verified: true`.

### Explicit Prohibitions
To satisfy **ASVS V6.3.6**:
1. **No Email-Only Authentication**: The application contains no routes or mechanisms allowing passwordless login by entering an email address alone.
2. **No Email-Based OTPs**: One-time passcodes delivered via email are strictly prohibited as primary or secondary authentication mechanisms due to the risk of email account compromise, transit interception, and lack of channel binding.
3. **No Direct Account / Password Creation**: Local username/password authentication is disabled. `POST /api/admin/users` returns HTTP 405 Method Not Allowed.
4. **Account Takeover Prevention in Profile Updates (UC-8)**:
   - When a user modifies their profile via `PUT /api/auth/me`, the account email cannot be changed.
   - Any attempt to provide a different `email` in the request body is rejected with HTTP `400 Bad Request` citing ASVS V6.3.6.
   - Changing the account email requires authenticating through Google with the target Google account.

---

## 3. Secure Google OAuth & OIDC Token Validation (SEC-04)

### 3.1 PKCE (Proof Key for Code Exchange - RFC 7636 / ASVS V10.1.2)
To protect the authorization code from interception or substitution:
- A high-entropy `code_verifier` (32 random bytes, base64url encoded) is generated on initiate.
- A SHA-256 challenge `code_challenge = base64url(sha256(code_verifier))` with method `S256` is transmitted to Google.
- The `code_verifier` is stored in the tamper-proof HMAC-signed transaction state cookie.
- During the callback exchange, `code_verifier` is sent in the POST body to `https://oauth2.googleapis.com/token`.

### 3.2 Cryptographic OIDC Nonce (ASVS V6.7.2, V10.5.1)
- Generated using `crypto.randomBytes(32).toString('hex')` (256 bits of cryptographic entropy).
- Transmitted in the Google authorization URL query as `nonce`.
- Embedded by Google into the signed ID Token payload.
- Strictly validated on callback: `idTokenPayload.nonce === originalNonce`. Any mismatch or missing nonce aborts authentication, defeating replay and token substitution attacks.

### 3.3 Trusted Public Key Discovery & RS256 Verification (ASVS V6.7.1, V6.8.2)
- Google's official public keys are fetched via HTTPS from `https://www.googleapis.com/oauth2/v3/certs`.
- Keys are cached in-memory with a 1-hour TTL.
- Key rollover: If a token arrives with an unknown `kid`, the cache is force-refreshed once.
- Signature verification is performed using Node.js native `crypto.createPublicKey` and `crypto.verify('RSA-SHA256', ...)`.

### 3.4 Strict Claims Validation (ASVS V10.5.2, V10.5.3, V10.5.4, V6.8.4)
Before accepting an ID token, the backend asserts:
1. **`iss` (Issuer)**: Must strictly match `https://accounts.google.com` or `accounts.google.com`.
2. **`aud` (Audience)**: Must match `process.env.GOOGLE_CLIENT_ID`.
3. **`exp` (Expiration)**: Must not be expired (with a 60-second clock-skew allowance).
4. **`iat` (Issued-at)**: Must not be in the future (with a 60-second clock-skew allowance).
5. **`sub` (Subject)**: Must be a non-empty string. It serves as the primary unique key (`googleId: sub`) in the database.
6. **`auth_time` (Authentication Recency)**: When sensitive operations require fresh authentication, tokens with stale `auth_time` exceeding the configured threshold are rejected.

### 3.5 Token Exposure Prevention (ASVS V10.1.1)
- Google `access_token` and `id_token` remain exclusively on the backend server.
- They are NEVER sent to the client browser or exposed to frontend JavaScript.
- The client receives only the application's internal `torbidd_auth_session` cookie (`httpOnly: true`, `secure: true`, `SameSite=Lax`).

### 3.6 Scope Minimization (ASVS V10.2.3)
- Only the scopes strictly required for identity and profile are requested:
  `scope=openid email profile`
- No unnecessary permissions (such as Google Drive, Contacts, or Cloud Storage) are requested.

---

## 4. Rate Limiting Reference (SEC-01)

| Endpoint | Limiter ID | Window | Max requests | Purpose |
|---|---|---|---|---|
| `GET /api/auth/google` | `auth-google-initiate` | 10 min | 20 | Stop automated redirect floods |
| `GET /api/auth/callback/google` | `auth-callback-google` | 5 min | 10 | Throttle state/token brute-force |
| `POST /api/auth/logout` | `auth-logout` | 1 min | 30 | Prevent logout-flood interference |
| `PUT /api/auth/me` | `auth-me-write` | 1 min | 10 | Throttle profile-update abuse |

---

## 5. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes (prod) | Google OAuth 2.0 Client ID (used for token audience validation) |
| `GOOGLE_CLIENT_SECRET` | Yes (prod) | Google OAuth 2.0 Client Secret |
| `SESSION_SECRET` | **Strongly recommended** | ≥32-byte random string for HMAC state and session signing |
| `ADMIN_EMAILS` | Optional | Comma-separated emails granted `admin` role on initial sign-in |
| `NEXT_PUBLIC_APP_URL` | Yes (prod) | Canonical app URL (used for redirect_uri) |
