# 🏛️ TORBIDD: Government Software Procurement Intelligence Platform

> **แพลตฟอร์มข่าวกรองการจัดซื้อจัดจ้างซอฟต์แวร์ภาครัฐ**  
> An AI-powered procurement intelligence & analytics platform helping technology vendors discover Thai government and municipal software procurement opportunities, evaluate Go/No-Go bidder qualifications with LLMs, analyze historical price benchmarks, and receive targeted tender alerts.

---

## Project Documentation

Key project specifications, requirements, and design documents are available in the [`docs/`](./docs) directory:

- 📄 [**Software Requirements Specification (SRS)** (`docs/TORBIDD_SRS.pdf`)](./docs/TORBIDD_SRS.pdf) — Comprehensive specification covering system architecture, external data pipelines, functional & non-functional requirements, data schemas, and UI/UX mockups.
- 📄 [**Project Proposal** (`docs/TORBIDD_Proposal.pdf`)](./docs/TORBIDD_Proposal.pdf) — Initial conceptual proposal, problem statement, objectives, and preliminary feasibility study.
- 🖼️ [**System Architecture & Data Flow Diagram** (`docs/TORBIDD System Architecture and Data Flow.png`)](./docs/TORBIDD%20System%20Architecture%20and%20Data%20Flow.png) — Visual architecture diagram depicting external ingestion, Next.js server services, MongoDB Atlas, and Vertex AI multimodal workflows.

---

## 🌐 External Data Sources & Scope Evolution

The platform aggregates and continuously polls procurement notices, Terms of Reference (TOR) specification documents, and historical bidding records from official Thai public government sources.

> [!NOTE]
> **Data Source Evolution (Proposal vs. SRS)**:  
> In our initial **Project Proposal**, 5 external data sources were tentatively proposed for integration. Following technical feasibility evaluations, API accessibility audits, and schema consolidation conducted for the **Software Requirements Specification (SRS)**, the active data ingestion pipeline was refined to focus on **3 authoritative public government sources**:

1. **Bangkok Metropolitan Administration e-Procurement**  
   🔗 [egp2.bangkok.go.th](http://egp2.bangkok.go.th/)  
   *Municipal procurement notices, electronic tender announcements, and downloadable TOR specifications from BMA departments and 50 district offices.*

2. **Electronic Government Procurement (e-GP)**  
   🔗 [www.gprocurement.go.th](http://www.gprocurement.go.th/)  
   *Thailand's central national e-procurement portal operated by the Comptroller General's Department (CGD), Ministry of Finance, covering nationwide ministry and state agency software tenders.*

3. **Open Government Data of Thailand**  
   🔗 [data.go.th](http://data.go.th/)  
   *The national open government data clearinghouse managed by the Digital Government Development Agency (DGA), providing structured historical procurement datasets, agency catalogs, and awarded contract analytics.*

---

## Architecture Overview

![TORBIDD System Architecture and Data Flow](./docs/TORBIDD%20System%20Architecture%20and%20Data%20Flow.png)

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 | Server & Client Components, Route Handlers |
| **Language** | TypeScript (Strict Mode) | Full-stack end-to-end type safety |
| **Styling** | CSS | High-performance design system with Dark/Light theme |
| **Database** | MongoDB Atlas + Mongoose | Document database with connection pooling & indexing |
| **AI Layer** | Google Cloud Vertex AI (Gemini 1.5) | TOR document extraction & project classification |
| **Charts** | Chart.js + react-chartjs-2 | Interactive historical budget & comparison visualizers |
| **Validation** | Zod | Server-side runtime validation for all API inputs |
| **Testing** | Jest + React Testing Library | Unit tests for business logic & validation |

---

## Project Structure

```
TORBIDD/
├── docs/                 # Formal documentation and diagrams
├── torbidd-app/          # Full-stack Next.js web application
│   ├── src/
│   │   ├── app/          # App Router (pages & API routes)
│   │   ├── components/   # Reusable UI components & Chart.js visualizers
│   │   ├── contexts/     # Application state (Theme, Language, Toast)
│   │   ├── models/       # Mongoose schemas (Projects, Bookmarks, Settings)
│   │   └── services/     # Vertex AI services & database clients
│   └── scripts/          # Database seeding, verification, and migration scripts
├── docker-compose.yml    # Multi-container orchestration
└── README.md
```

---

## ⚙️ Prerequisites

- **Node.js**: v18.18.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **MongoDB Atlas account** (or local MongoDB instance)
- **Google Cloud Project** with Vertex AI API enabled (optional for local testing with fallbacks)

---

## 🔑 Environment Variables Setup

1. In the `torbidd-app/` directory, copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and configure your credentials:
   ```ini
   # MongoDB Atlas Connection
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/
   MONGODB_DB=torbidd

   # Google Cloud / Vertex AI (Server-side only)
   GOOGLE_CLOUD_PROJECT=your-gcp-project-id
   GOOGLE_CLOUD_LOCATION=asia-southeast1
   VERTEX_AI_MODEL_PRO=gemini-1.5-pro
   VERTEX_AI_MODEL_FLASH=gemini-1.5-flash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

   # App URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

> [!NOTE]
> If `MONGODB_URI` or `GOOGLE_CLOUD_PROJECT` are not configured, the application automatically falls back to the embedded offline dataset and mock AI responses so the entire UI and all interactions work out-of-the-box for development.

---

## 📦 Database Setup & Seeding

To seed your MongoDB Atlas cluster with initial software projects and historical procurement records:

```bash
cd torbidd-app
npm run seed
```

Output:
```
🔌 Connecting to MongoDB Atlas...
✅ Connected to database: torbidd

📦 Seeding projects...
   ✓ Project #1: BMA e-Service Smart Portal Centralized System Development Project...
   ✓ Project #2: BMA Learning Hub Online Classroom System Project...
   ...
📊 Seeding historical data...
   ✓ Inserted 12 historical records

🎉 Seed complete!
```

---

## 💻 Local Development

```bash
# 1. Install dependencies
cd torbidd-app
npm install

# 2. Run the Next.js development server
npm run dev

# 3. Open in browser
open http://localhost:3000
```

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```

Build verification (TypeScript strict check + Next.js App Router static/dynamic analysis):
```bash
npm run build
```

---

## 📡 REST API Documentation

### 1. Projects
- **`GET /api/projects`**
  - Query parameters:
    - `search`: string (keyword in title, department, or category)
    - `department`: string (Government agency or BMA department name)
    - `category`: `Website` | `Mobile App` | `AI` | `Database`
    - `budget`: `under5m` | `5to10` | `10to20` | `above20m`
    - `deadline`: `within7` | `within30` | `moreThan30`
  - Response: `{ data: Project[], total: number }`

- **`GET /api/projects/[id]`**
  - Path parameter: numeric `externalId` (e.g. `1`) or MongoDB `ObjectId`
  - Response: `{ data: Project }`

### 2. Historical Price Analysis & Benchmarks
- **`GET /api/historical`**
  - Query parameters:
    - `category`: `Website` | `Mobile App` | `AI` | `Database`
    - `department`: string (BMA department name)
    - `year`: number (e.g. `2024`, `2025`)
    - `search`: string (full-text search across titles, descriptions, and departments)
    - `stats`: `true` | `false` (computes statistical benchmarks: min, q1, median, mean, q3, max, stdDev, iqr)
    - `agencies`: `true` | `false` (aggregates cross-agency procurement analytics, total spend, and tech category distribution)
  - Response:
    ```json
    {
      "data": [
        {
          "title": { "th": "...", "en": "..." },
          "department": { "th": "...", "en": "..." },
          "year": 2025,
          "category": "Database",
          "budget": 34000000,
          "procurementType": "e-Bidding",
          "awardedVendor": { "th": "...", "en": "..." },
          "scope": { "th": ["..."], "en": ["..."] }
        }
      ],
      "total": 16,
      "stats": { "Website": { "median": 11800000, ... }, "All": { ... } },
      "agencies": [
        {
          "departmentKey": "สำนักการจราจรและขนส่ง",
          "totalBudget": 84500000,
          "projectCount": 4,
          "avgBudget": 21125000,
          "primaryCategory": "AI"
        }
      ]
    }
    ```

### 3. Bookmarks (User Session Scoped)
- **`GET /api/bookmarks`** — List saved project IDs for the session
- **`POST /api/bookmarks`** — Body: `{ "projectId": "<ObjectId>" }`
- **`DELETE /api/bookmarks/[id]`** — Remove bookmark by project ID

### 4. Alert Preferences
- **`GET /api/settings`** — Retrieve user notification settings
- **`PUT /api/settings`** — Update user settings with validation:
  ```json
  {
    "emailNotif": true,
    "dailyDigest": true,
    "closingAlert": true,
    "newProjectAlert": false,
    "interestTags": ["Website", "AI", "Cloud"],
    "budgetMin": 5000000,
    "budgetMax": 20000000,
    "language": "th"
  }
  ```

### 5. Vertex AI Endpoints (Server-Side)
- **`POST /api/ai/classify`** — Classify project text using Gemini Flash:
  - Body: `{ "title": "...", "description": "..." }`
  - Returns: `{ "category": "AI", "confidence": "High", "reasoning": "..." }`
- **`POST /api/ai/extract`** — Extract structured TOR fields from PDF:
  - Body: `{ "documentUrl": "https://..." }` or `{ "documentBase64": "..." }`
  - Returns: `{ "title": {...}, "budget": 12500000, "deadline": "2026-09-30", ... }`

---

## 🔒 Security & Best Practices

- **Zero Client Credential Exposure**: Vertex AI SDK, service account keys, and MongoDB connection strings are strictly confined to the server layer (`services/` and `app/api/`).
- **Input Validation**: All server endpoints enforce schema validation via **Zod** prior to processing.
- **Connection Pooling**: MongoDB connection uses a cached singleton to prevent connection leaks across hot-reloads and serverless invocations.
- **Bilingual Accessibility**: Full Thai (ภาษาไทย) and English support with Buddhist Era date support and accessible WCAG color contrasts in both Light and Dark modes.

---

## 🐳 Docker

### Build Image
```bash
# From torbidd-app/ directory
npm run docker:build
# or directly:
docker build -t torbidd-app ./torbidd-app
```

### Run Container
```bash
npm run docker:run
# or directly:
docker run -p 3000:3000 --env-file .env.local torbidd-app
```

### Docker Compose (recommended for local staging)
```bash
# Copy and fill in .env.local first
cp torbidd-app/.env.example torbidd-app/.env.local

# Start the app (uses MongoDB Atlas via MONGODB_URI)
docker compose up --build

# One-time seeding (run separately after app is healthy)
docker compose --profile seed run seed
```

> **Note**: There is no local MongoDB container — TORBIDD always connects to **MongoDB Atlas**. Set `MONGODB_URI` in `.env.local` to your Atlas connection string.

The multi-stage Dockerfile produces a minimal production image using Next.js `standalone` output:

| Stage | Base | Purpose |
|---|---|---|
| `deps` | `node:22-alpine` | Install `node_modules` via `npm ci` |
| `builder` | `node:22-alpine` | `npm run build` → `.next/standalone` |
| `runner` | `node:22-alpine` | Copy only what's needed, run as non-root `nextjs` user |

---

## 🔄 CI/CD — GitHub Actions

Three workflows live in `.github/workflows/`:

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| **CI** | `ci.yml` | Push / PR to `main` or `implement/**` | Lint → Unit Tests → Build |
| **Docker** | `docker.yml` | Push to `main` | Build image, Trivy CVE scan, push to GHCR |
| **Deploy** | `deploy.yml` | Manual (`workflow_dispatch`) | Placeholder — configure your deploy target |

### Required GitHub Secrets

Configure these in **Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `MONGODB_URI` | Atlas connection string (used at deploy time, not in CI build) |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GCP_SA_KEY` | Service account JSON **base64-encoded** for Vertex AI |
| `SESSION_SECRET` | 32+ char random string (`openssl rand -hex 32`) |
| `GITHUB_TOKEN` | Auto-provided — used for GHCR push |

> **CI build uses stub env vars** — no live Atlas or GCP credentials are needed for `npm run lint`, `npm test`, or `npm run build` in CI. Real secrets are only injected at deploy time.

### Configure Deployment

Edit `.github/workflows/deploy.yml` and replace the placeholder step with your deploy command:

```yaml
# GCP Cloud Run example
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy torbidd-app \
      --image ghcr.io/mtperaya/torbidd-app:latest \
      --region asia-southeast1 \
      --platform managed \
      --set-env-vars MONGODB_URI=${{ secrets.MONGODB_URI }}
```

---

## 🗄️ Database Scripts

In addition to `npm run seed`, two utility scripts are available in `torbidd-app`:

### Health Check
```bash
npm run db:check
```

Connects to Atlas and verifies:
- All required collections exist (`projects`, `historicalprojects`, `bookmarks`, `usersettings`)
- Document counts for each collection
- Critical indexes are in place (exits non-zero on failure — safe to use in CI)

### Migration Runner
```bash
npm run db:migrate
```

Runs pending schema migrations idempotently. Each migration is recorded in a `migrations` collection and never re-applied. To add a migration, append an entry to the `MIGRATIONS` array in `scripts/db-migrate.ts`.

### Recommended workflow for a fresh Atlas cluster:
```bash
# 1. Verify connection
npm run db:check

# 2. Seed initial data
npm run seed

# 3. Apply any pending schema migrations
npm run db:migrate

# 4. Verify again
npm run db:check
```

---

## 📄 License & Attribution

Developed for **Government Software Procurement Intelligence Platform (TORBIDD)** — empowering technology vendors across Thai public sector and municipal procurements.
