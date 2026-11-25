# ⚙️ Environment Variables Setup

[← Back to Wiki Home](Home) · [Development Setup](Development-Setup) · [Security Considerations](Security-Considerations)

This guide details all configuration and environment variables required to run the **TORBIDD** platform across local development, staging, and production environments.

> [!CAUTION]
> **Security Policy**: Never commit `.env.local`, service account JSON files, or production secrets to version control. The repository’s `.gitignore` and `.dockerignore` are pre-configured to ignore all `.env*.local` and secret files.

---

## 🚀 Quick Setup

1. In the `torbidd-app/` directory, copy the template file:
   ```bash
   cd torbidd-app
   cp .env.example .env.local
   ```
2. Generate secure random secrets:
   ```bash
   # Generate session secret (minimum 32 characters required)
   openssl rand -hex 32

   # Generate cron authentication token
   openssl rand -hex 32
   ```
3. Open `.env.local`, paste the generated strings into `SESSION_SECRET` and `CRON_SECRET`, then provide your MongoDB connection string, AI keys, and SMTP credentials.

---

## 📋 Comprehensive Environment Reference

### 1. General & Core Application

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `NODE_ENV` | Optional | `development` | Runtime environment (`development`, `production`, `test`). |
| `NEXT_PUBLIC_APP_URL` | **Required** | `https://localhost` | Canonical public base URL. Used for redirects, OpenGraph metadata, and OAuth callbacks. |
| `SESSION_SECRET` | **Required** | *None* | 64+ char random string used to sign `__Host-` session cookies. Startup assertions reject values $< 32$ chars or default strings in production. |
| `CRON_SECRET` | **Required in Prod** | *None* | Bearer token required to trigger automated background jobs (e.g. `POST /api/cron/deadline-reminders`). Fails securely with 503 if missing in production. |
| `ADMIN_EMAILS` | Optional | `admin@bangkok.go.th` | Comma-separated list of email addresses granted the `admin` role upon first OAuth login. |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Security | `1` | Enforces remote TLS certificate validation (never set to 0 in production). |
| `NODE_OPTIONS` | Security | `--tls-min-v1.2` | Enforces TLS 1.2+ minimum protocol version. |

---

### 2. Database (MongoDB Atlas)

TORBIDD uses MongoDB Atlas for all collections (`ProcurementProject`, `HistoricalProject`, `UserSettings`, `Notification`, `Bookmark`, `SyncLog`, `SyncError`).

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `MONGODB_URI` | **Required** | `mongodb+srv://<user>:<pwd>@cluster0.xxx.mongodb.net/?tls=true` | Full MongoDB connection string with TLS enabled. |
| `MONGODB_DB` | **Required** | `torbidd` | Target database name within the Atlas cluster. |
| `MONGODB_MAX_POOL_SIZE` | Optional | `10` | Maximum socket connections per Node.js container instance (ASVS V13.1.2). |
| `MONGODB_TIMEOUT_MS` | Optional | `5000` | Connection timeout in milliseconds before throwing a database exception. |

---

### 3. Outbound Email & Notifications (SMTP)

Configures the transactional email delivery service used for Opportunity Alerts and Deadline Reminders.

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `SMTP_HOST` | Optional* | `smtp.gmail.com` | Outbound SMTP server hostname. |
| `SMTP_PORT` | Optional* | `587` | SMTP port (`587` for STARTTLS, `465` for SSL/TLS). |
| `SMTP_SECURE` | Optional* | `false` | `true` for port 465, `false` for port 587 (STARTTLS). |
| `SMTP_USER` | Optional* | `notifications@yourdomain.com` | Authenticated SMTP username / email address. |
| `SMTP_PASS` | Optional* | *App Password* | SMTP password or 16-character Google App Password. |
| `EMAIL_FROM` | Optional* | `"TORBIDD Alerts" <notifications@torbidd.gov.th>` | Formatted email sender header. |

*\* If SMTP credentials are omitted, email delivery logs preview links server-side without crashing.*

---

### 4. AI Providers & Document Intelligence (UC-10)

TORBIDD uses a **modular multi-tier AI architecture** with automated failover.

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `AI_TAGGING_ENABLED` | Optional | `true` | Master switch. When `false`, forces deterministic keyword-based rules only. |
| `AI_PROVIDER` | **Required** | `google-ai-studio` | Active provider: `google-ai-studio`, `vertexai`, `openrouter`, `fallback`, or `keyword`. |
| `AI_FALLBACK_ORDER` | Optional | `google-ai-studio,openrouter,vertexai,keyword` | Comma-separated sequence of providers to try on HTTP 429 rate limits or errors. |

#### Option A: Google AI Studio (Gemini)
| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Conditional | *None* | Google AI Studio API key. Supports comma-separated keys for automated 429 rotation (`key1,key2`). |
| `GEMINI_MODEL` | Optional | `gemini-2.5-flash` | Model identifier used for classification and tagging. |

#### Option B: Google Cloud Vertex AI (Production / Enterprise)
| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | Conditional | `your-gcp-project-id` | GCP Project ID hosting Vertex AI. |
| `GOOGLE_CLOUD_LOCATION` | Optional | `asia-southeast1` | Regional endpoint (Singapore / Bangkok low-latency). |
| `VERTEX_AI_MODEL` | Optional | `gemini-2.0-flash` | Default multi-purpose model. |
| `VERTEX_AI_MODEL_PRO` | Optional | `gemini-1.5-pro` | High-capacity model for deep multimodal TOR PDF parsing. |
| `VERTEX_AI_MODEL_FLASH` | Optional | `gemini-1.5-flash` | Low-latency model for fast category classification. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional | `/path/to/service-account.json` | Path to GCP Service Account key (omit if running on Cloud Run or using ADC). |

#### Option C: OpenRouter
| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Conditional | *None* | API key for OpenRouter models. |
| `OPENROUTER_MODEL` | Optional | `qwen/qwen3.5-flash-02-23` | OpenRouter model endpoint. |
| `OPENROUTER_BASE_URL` | Optional | `https://openrouter.ai/api/v1` | Base API endpoint URL. |

---

### 5. Authentication (Google OAuth 2.0 / OIDC)

| Variable | Required? | Example | Description |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Optional* | `xxxx.apps.googleusercontent.com` | OAuth 2.0 Client ID created in Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Optional* | `GOCSPX-xxxx` | OAuth 2.0 Client Secret. |

*\* If not configured, mock user session mode is enabled for development.*

---

### 6. External Government Sources & SSRF Protection

| Variable | Required? | Default | Description |
|---|---|---|---|
| `GOVSPENDING_API_KEY` | Optional | *None* | API key from [opend.data.go.th](https://opend.data.go.th) for historical contract datasets. |
| `GOVSPENDING_BASE_URL` | Optional | `https://opend.data.go.th/govspending/service/egp-contract` | Base URL for open government spending data. |
| `DATA_GO_TH_BASE_URL` | Optional | `https://data.go.th` | Public catalog portal URL. |
| `EGP_BASE_URL` | Optional | `https://process5.gprocurement.go.th` | National e-GP portal service URL. |
| `EGP_PORTAL_URL` | Optional | `https://www.gprocurement.go.th` | Public national e-GP frontend URL. |
| `EGP_RSS_BASE_URL` | Optional | `https://process3.gprocurement.go.th/.../egpannouncerss.xml` | Official XML RSS feed for new tender notices. |
| `BMA_BASE_URL` | Optional | `https://egp2.bangkok.go.th` | Bangkok Metropolitan Administration e-procurement portal (HTTPS only). |
| `ALLOWED_DOCUMENT_HOSTS` | Security | *Empty* | Comma-separated list of additional permitted document download hostnames. |
| `REQUEST_TIMEOUT_MS` | Optional | `15000` | HTTP request timeout in milliseconds for scraping external files. |
| `DOCUMENT_STORAGE_PATH` | Optional | `./storage/documents` | Local filesystem path used to cache downloaded TOR PDF files. |

---

## 🔒 Secret Isolation & Client Exposure Rules

1. **Server-Only (Private) Secrets**:
   - Variables without the `NEXT_PUBLIC_` prefix (e.g., `MONGODB_URI`, `GEMINI_API_KEY`, `SESSION_SECRET`, `SMTP_PASS`) are **never bundled into browser JavaScript**.
   - These variables can only be read within Server Components, Route Handlers (`app/api/*`), and server-side utilities (`src/services/*`).
2. **Client-Exposed (Public) Variables**:
   - Only variables explicitly prefixed with `NEXT_PUBLIC_` (such as `NEXT_PUBLIC_APP_URL`) are inlined into client JavaScript bundles.
   - **Never prefix API keys, database credentials, or secret tokens with `NEXT_PUBLIC_`.**

---

## 🐳 Docker Deployment

```bash
docker compose --env-file torbidd-app/.env.local up -d
```
