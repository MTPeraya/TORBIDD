## FEAT-01: Real-Time Procurement Discovery & Search Feed
[← Back to Feature Details](Feature-Details)

### 1. Overview & Purpose
Serves as the platform's primary discovery feed. It provides technology vendors with a responsive, multifaceted search engine to discover active Thai public and municipal software tenders.

### 2. Architecture & Components
- **UI Component**: `src/components/projects/ProjectFeed.tsx`, `FilterSidebar.tsx`
- **Route Handler**: `GET /api/projects`
- **Backend Services**: `src/services/procurement-search.ts`, `src/services/procurement-filter.ts`
- **Primary Model**: `src/models/ProcurementProject.ts`

### 3. Business Rules & Logic
- **Bilingual Full-Text Search**: Matches search keywords across both Thai (`title.th`, `description.th`) and English (`title.en`, `description.en`) text indices.
- **Dynamic Multi-Faceted Filtering**:
  - `category`: `Website` | `Mobile App` | `AI` | `Database` | `Information Systems` | `Software Maintenance`.
  - `department`: Filter by specific BMA department or central ministry agency.
  - `budget`: Bracketed filtering (`under5m`, `5to10`, `10to20`, `above20m`).
  - `deadline`: Urgency brackets (`within7`, `within30`, `moreThan30`).
- **Urgency Highlighting**: Tenders with closing deadlines 7 days are visually badged as *Closing Soon* with distinct highlight styling.

### 4. API Contract & Parameters
```http
GET /api/projects?search=AI&category=AI&budget=5to10&deadline=within7&page=1&limit=10
```
```json
{
  "data": [
    {
      "_id": "6724a8f9...",
      "externalId": "100234",
      "title": { "th": "โครงการพัฒนาระบบ AI...", "en": "AI-Powered Citizen Portal..." },
      "department": { "th": "สำนักการจราจรและขนส่ง", "en": "Traffic and Transportation Department" },
      "category": "AI",
      "budget": 8500000,
      "submissionDeadline": "2026-11-20T17:00:00.000Z",
      "status": "active"
    }
  ],
  "total": 42,
  "page": 1,
  "totalPages": 5
}
```

---
