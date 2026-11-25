Issue: [#370](https://github.com/users/MTPeraya/projects/2/views/1?filterQuery=API+Route+and+Multi-Service+Integration+Testing&pane=issue&itemId=286027129&issue=MTPeraya%7CTORBIDD%7C370)

### Use Case
**UC-TEST-02: API Route and Multi-Service Integration Testing**

#### Description
The system shall provide automated integration tests that verify interactions between multiple architectural modules operating together.  
This includes Next.js App Router API endpoints communicating with database services, multi-source ingestion pipelines orchestrating data extraction and normalization, and administrative endpoints validating session authentication and database state mutations.

#### Actors
- **Backend / Full-Stack Developer**
- **Integration Test Runner (Jest Node Environment)**
- **Mock Database / Memory Data Layer**

#### Preconditions
- Next.js API route handlers are registered under `src/app/api/`.
- Mongoose schemas and models are defined and compile cleanly.
- Database access helper services (`src/services/database/`) are available.

#### Main Flow
1. The test runner invokes the integration test suite (`npm test src/app/api/ src/services/ingestion/__tests__/api-endpoints.test.ts`).
2. The test setup constructs standard Next.js `NextRequest` objects simulating client HTTP requests (`GET`, `POST`, `PATCH`).
3. For protected routes, the test attaches valid admin session cookies (`torbidd_session`).
4. The API route executes the full internal pipeline: request parameter validation (Zod) -> service layer invocation -> database query execution -> response JSON serialization.
5. The test asserts that the returned `NextResponse` contains the expected HTTP status code (200, 201), valid JSON payload schema, and correct business headers.
6. The test asserts that associated side effects (e.g., sync logs, audit logs, cooldown flags) are accurately persisted in the database model.

#### Alternative / Exception Flows
**A1. Unauthorized Request to Protected Endpoint**
1. An integration test sends a request without a valid session cookie to `/api/admin/ai-provider` or `/api/projects/[id]/classification`.
2. The route middleware intercepts the request.
3. The response asserts status `401 Unauthorized` or `403 Forbidden`, ensuring security boundaries are intact.

**A2. Invalid Request Body / Query Parameters**
1. An integration test submits malformed JSON or unaccepted query parameters.
2. The Zod schema rejects the input.
3. The route handler returns status `400 Bad Request` with structured validation error messages.

#### Postconditions
- End-to-end API contract integrity between clients, backend services, and database schemas is guaranteed.

#### Acceptance Criteria
- [ ] Next.js route handlers (`/api/ai/classify`, `/api/admin/ai-provider`, `/api/projects/[id]/classification`) return correct responses for valid requests.
- [ ] Unauthorized and unauthenticated access returns HTTP 401/403.
- [ ] Multi-source ingestion pipeline tests verify data flow from raw external API ingestion into normalized procurement records.
- [ ] Database deduplication and sync logging correctly handle concurrent and repeated records.

#### Subtasks & Status (Integration Testing)

| Subtask | Scope | Status | Est. Time |
|---|---|:---:|:---:|
| 1. API Route Handler Integration Tests | [`src/app/api/ai/classify/__tests__/route.test.ts`](file:///Users/mintt/Documents/Uni_Project/TORBIDD/torbidd-app/src/app/api/ai/classify/__tests__/route.test.ts), [`src/app/api/projects/[id]/tech-specs/__tests__/route.test.ts`](file:///Users/mintt/Documents/Uni_Project/TORBIDD/torbidd-app/src/app/api/projects/[id]/tech-specs/__tests__/route.test.ts) | **Done** | 4 hrs |
| 2. Ingestion Pipeline & Multi-Source Endpoints | [`src/services/ingestion/__tests__/api-endpoints.test.ts`](file:///Users/mintt/Documents/Uni_Project/TORBIDD/torbidd-app/src/services/ingestion/__tests__/api-endpoints.test.ts), [`ingestion-multi-source.test.ts`](file:///Users/mintt/Documents/Uni_Project/TORBIDD/torbidd-app/src/services/ingestion/__tests__/ingestion-multi-source.test.ts) | **Done** | 4 hrs |
| 3. Database Sync & Deduplication Integration | [`src/services/database/__tests__/procurement-dedup.test.ts`](file:///Users/mintt/Documents/Uni_Project/TORBIDD/torbidd-app/src/services/database/__tests__/procurement-dedup.test.ts), [`sync-logs.test.ts`](file:///Users/mintt/Documents/Uni_Project/TORBIDD/torbidd-app/src/services/database/__tests__/sync-logs.test.ts) | **Done** | 3 hrs |
| 4. In-Memory MongoDB Test Container Integration | Integrate `mongodb-memory-server` for end-to-end transactional database tests in CI | **In Progress** | 4 hrs |

**Total Estimated Time:** 15 hours

#### Technical Details & Commands (Integration Testing)
```bash
# Run existing API and database integration test suites:
cd torbidd-app
npm test src/app/api/ src/services/database/__tests__/ src/services/ingestion/__tests__/api-endpoints.test.ts
```
**Technical Recipe for Testing Next.js Route Handlers:**
```typescript
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/ai-provider/route';

// Simulate authenticated Admin Request:
const req = new NextRequest('http://localhost:3000/api/admin/ai-provider', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    cookie: 'torbidd_session=valid-admin-token',
  },
  body: JSON.stringify({ provider: 'openrouter' }),
});

const response = await POST(req);
const json = await response.json();
expect(response.status).toBe(200);
expect(json.success).toBe(true);
expect(json.data.activeProvider).toBe('openrouter');
```
