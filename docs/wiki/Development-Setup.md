# TORBIDD — Development Setup & Environment Guide

## 1. System Prerequisites

Before running the TORBIDD application, ensure your environment meets the following specifications:
- **Node.js**: v18.18.0 or higher (v20+ recommended LTS)
- **npm**: v9.0.0 or higher
- **MongoDB Atlas** account (or local MongoDB 7.0+ instance)
- **Google Cloud Platform Project** with Vertex AI API enabled *(Optional: offline mock fallbacks provided)*
- **Docker & Docker Compose** *(Optional: for containerized execution)*

---

## 2. Step-by-Step Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/MTPeraya/TORBIDD.git
cd TORBIDD
```

### Step 2: Install Dependencies
Navigate into the Next.js application directory and install packages:
```bash
cd torbidd-app
npm install
```

### Step 3: Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```ini
# -----------------------------------------------------------------------------
# Database Configuration (MongoDB Atlas)
# -----------------------------------------------------------------------------
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/
MONGODB_DB=torbidd

# -----------------------------------------------------------------------------
# Google Cloud Vertex AI (Server-Side Only)
# -----------------------------------------------------------------------------
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=asia-southeast1
VERTEX_AI_MODEL_PRO=gemini-1.5-pro
VERTEX_AI_MODEL_FLASH=gemini-1.5-flash
# Optional: path to service account key file
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# -----------------------------------------------------------------------------
# Application Environment
# -----------------------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

> [!NOTE]
> If `MONGODB_URI` or `GOOGLE_CLOUD_PROJECT` are not supplied, the application automatically falls back to an embedded offline dataset and mock heuristic AI responses so that all UI interactions work out of the box.

---

## 3. Database Seeding

Populate your MongoDB Atlas database with initial government procurement projects and historical benchmark datasets:

```bash
cd torbidd-app
npm run seed
```

Expected output:
```text
🔌 Connecting to MongoDB Atlas...
✅ Connected to database: torbidd
📦 Seeding projects...
   ✓ Inserted active software procurement opportunities
📊 Seeding historical data...
   ✓ Inserted historical benchmark records
🎉 Seed complete!
```

---

## 4. Running the Application

### 4.1 Development Server
```bash
cd torbidd-app
npm run dev
```
Open your browser to: `http://localhost:3000`

### 4.2 Automated Testing
```bash
# Run unit & component tests
npm test

# Run tests with code coverage report
npm test -- --coverage
```

### 4.3 Production Build Verification
```bash
npm run build
```

---

## 5. Docker Orchestration

You can run TORBIDD via Docker containerization:

```bash
# 1. From repository root, prepare environment
cp torbidd-app/.env.example torbidd-app/.env.local

# 2. Build and start application container
docker compose up --build

# 3. Seed database inside container (one-time setup)
docker compose --profile seed run seed
```