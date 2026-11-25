# ⚙️ Environment Variables Setup

[← Back to Wiki Home](Home)

This guide details all configuration and environment variables required to run the **TORBIDD** platform across local development, staging, and production environments.

> [!CAUTION]
> **Security Policy**: Never commit `.env.local`, service account JSON files, or production secrets to version control. The repository’s `.gitignore` is pre-configured to ignore all `.env*.local` files.

---

## 🚀 Quick Setup

1. In the `torbidd-app/` directory, copy the template file:
   ```bash
   cd torbidd-app
   cp .env.example .env.local
   ```
2. Generate a secure session secret:
   ```bash
   openssl rand -hex 32
   ```
3. Open `.env.local` and paste the generated string into `SESSION_SECRET`, then provide your MongoDB connection string and AI credentials.

---

## 📋 Comprehensive Environment Reference

### 1. General & Core Application

| Variable | Required? | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Optional | `development` | Runtime environment (`development`, `production`, `test`). |
| `NEXT_PUBLIC_APP_URL` | **Required** | `http://localhost:3000` | Canonical public URL. Used for redirects, OpenGraph meta, and callbacks. |
| `SESSION_SECRET` | **Required** | *None* | 64+ char random string used to sign session cookies. |
| `ADMIN_EMAILS` | Optional | *Empty* | Comma-separated list of authorized administrator email addresses. |

---

### 2. Database (MongoDB Atlas)

TORBIDD uses MongoDB Atlas for all collections (`ProcurementProject`, `HistoricalProject`, `UserSettings`, etc.).

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `MONGODB_URI` | **Required** | `mongodb+srv://<user>:<pwd>@cluster0.xxx.mongodb.net/` | Full MongoDB connection string with connection options. |
| `MONGODB_DB` | **Required** | `torbidd` | Target database name within the Atlas cluster. |

> [!NOTE]
> If `MONGODB_URI` is omitted during local development, the app will degrade gracefully to use the bundled offline dataset for read operations.

---

### 3. AI Providers & Document Intelligence (UC-10)

TORBIDD uses a **modular AI architecture** supporting multiple backends with automatic failover.

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `AI_TAGGING_ENABLED` | Optional | `true` | Master switch. When `false`, forces deterministic keyword-based rules only. |
| `AI_PROVIDER` | **Required** | `google-ai-studio` | Active provider: `google-ai-studio`, `vertexai`, `openrouter`, `fallback`, or `keyword`. |
| `AI_FALLBACK_ORDER` | Optional | `google-ai-studio,openrouter,vertexai,keyword` | Comma-separated sequence of providers to try on HTTP 429 rate limits or errors. |

#### Option A: Google AI Studio (Recommended for Fast Local Setup)
*Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).*

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Conditional | *None* | Google AI Studio API key. Supports comma-separated keys for automated 429 key rotation (`key1,key2`). |
| `GEMINI_MODEL` | Optional | `gemini-2.5-flash` | Model identifier used for classification and tagging. |

#### Option B: Google Cloud Vertex AI (Production / Enterprise)
*Requires a GCP project with Vertex AI API enabled.*

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | Conditional | *your-gcp-project-id* | GCP Project ID hosting Vertex AI. |
| `GOOGLE_CLOUD_LOCATION` | Optional | `asia-southeast1` | Regional endpoint (Singapore / Bangkok low-latency). |
| `VERTEX_AI_MODEL` | Optional | `gemini-2.0-flash` | Default multi-purpose model. |
| `VERTEX_AI_MODEL_PRO` | Optional | `gemini-1.5-pro` | High-capacity model for deep multimodal TOR PDF parsing. |
| `VERTEX_AI_MODEL_FLASH` | Optional | `gemini-1.5-flash` | Low-latency model for fast category classification. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional | `/path/to/service-account.json` | Path to GCP Service Account key (omit if running on Cloud Run or using ADC). |

#### Option C: OpenRouter (Alternative Provider)
*Get an API key from [OpenRouter](https://openrouter.ai).*

| Variable | Required? | Default / Example | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Conditional | *None* | API key for OpenRouter models. |
| `OPENROUTER_MODEL` | Optional | `qwen/qwen3.5-flash-02-23` | OpenRouter model endpoint. |
| `OPENROUTER_BASE_URL` | Optional | `https://openrouter.ai/api/v1` | Base API endpoint URL. |

---

### 4. Authentication (Google OAuth 2.0)

Configures user sign-in and session identity.

| Variable | Required? | Example | Description |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Optional* | `xxxx.apps.googleusercontent.com` | OAuth 2.0 Client ID created in Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Optional* | `GOCSPX-xxxx` | OAuth 2.0 Client Secret. |

*\* If not configured, mock user session mode is enabled for development.*

> [!TIP]
> **Authorized Redirect URI**: In the Google Cloud Console, ensure your OAuth client has:  
> `http://localhost:3000/api/auth/callback/google` (for local dev) or `https://your-domain.com/api/auth/callback/google` (for production).

---

### 5. External Government Data Sources & Ingestion

Configures external API endpoints, polling RSS feeds, and document storage paths.

| Variable | Required? | Default | Description |
|---|---|---|---|
| `GOVSPENDING_API_KEY` | Optional | *None* | API key from [opend.data.go.th](https://opend.data.go.th) for historical contract datasets. |
| `GOVSPENDING_BASE_URL` | Optional | `https://opend.data.go.th/govspending/service/egp-contract` | Base URL for open government spending data. |
| `DATA_GO_TH_BASE_URL` | Optional | `https://data.go.th` | Public catalog portal URL. |
| `EGP_BASE_URL` | Optional | `https://process5.gprocurement.go.th` | National e-GP portal service URL. |
| `EGP_PORTAL_URL` | Optional | `https://www.gprocurement.go.th` | Public national e-GP frontend URL. |
| `EGP_RSS_BASE_URL` | Optional | `https://process3.gprocurement.go.th/.../egpannouncerss.xml` | Official XML RSS feed for new tender notices. |
| `BMA_BASE_URL` | Optional | `http://egp2.bangkok.go.th` | Bangkok Metropolitan Administration e-procurement portal. |
| `REQUEST_TIMEOUT_MS` | Optional | `15000` | HTTP request timeout in milliseconds for scraping/fetching external files. |
| `DOCUMENT_STORAGE_PATH` | Optional | `./storage/documents` | Local filesystem path used to cache downloaded TOR PDF files. |

---

## 🔒 Secret Isolation & Client Exposure Rules

Next.js automatically enforces security boundaries around environment variables:

1. **Server-Only (Private) Secrets**:
   - Variables without the `NEXT_PUBLIC_` prefix (e.g., `MONGODB_URI`, `GEMINI_API_KEY`, `SESSION_SECRET`) are **never bundled into browser JavaScript**.
   - These variables can only be read within Server Components, Route Handlers (`app/api/*`), and server-side utilities (`src/services/*`).
2. **Client-Exposed (Public) Variables**:
   - Only variables explicitly prefixed with `NEXT_PUBLIC_` (such as `NEXT_PUBLIC_APP_URL`) are inlined into client JavaScript bundles.
   - **Never prefix API keys, database credentials, or secret tokens with `NEXT_PUBLIC_`.**

---

## 🐳 Docker & CI/CD Environment Usage

When deploying via **Docker** or **Docker Compose**:
- Place `.env.local` inside `torbidd-app/` before running:
  ```bash
  docker compose --env-file torbidd-app/.env.local up -d
  ```
- In **GitHub Actions**, store these values as GitHub Repository Secrets and inject them into build or container steps as needed.