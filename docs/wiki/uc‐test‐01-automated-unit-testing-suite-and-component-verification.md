Issue: [#372](https://github.com/users/MTPeraya/projects/2/views/1?filterQuery=Automated+Unit+Testing+Suite+and+Component+Verification&pane=issue&itemId=286031482&issue=MTPeraya%7CTORBIDD%7C372)

## Use Case
**UC-TEST-01: Automated Unit Testing Suite and Component Verification**  
*(Directly addresses sub-issue [Unit testing #170](https://github.com/MTPeraya/TORBIDD/issues/170) under parent [Automated Testing #167](https://github.com/MTPeraya/TORBIDD/issues/167))*

### Description
The system shall provide an automated, repeatable unit testing suite that verifies discrete functional units of the TORBIDD application in complete isolation from external networks and databases.  
The unit test suite covers AI adapters (circuit breaker, fallback order, rate-limit key rotation), procurement matching and diff detection algorithms, government data normalizers and parsers, security validation schemas, and React UI components.  
Tests execute deterministically both on local developer machines (`npm test`) and inside the GitHub Actions CI pipeline on every push and pull request.

### Actors
- **Software Developer / Contributor**: Runs unit tests locally (`npm test`) to ensure new code does not introduce regressions.
- **CI/CD Pipeline Runner (GitHub Actions)**: Headless runner executing tests automatically on pushes and pull requests to enforce code quality gates.
- **Test Runner (Jest & React Testing Library)**: Test engine orchestrating Node.js and JSDOM environments, mock dependencies, and assertion evaluation.

### Preconditions
- Project dependencies are installed (`npm ci`).
- Jest configuration (`jest.config.js`) and environment setup (`jest.setup.js`) are configured.
- No live connections to MongoDB, Google Cloud Vertex AI, OpenRouter, or government portals are required (all external dependencies are mocked).

### Main Flow
1. The developer or CI runner triggers test execution using `npm test` (or `npm test -- --coverage --runInBand`).
2. Jest compiles TypeScript code and detects all unit test files matching `**/*.test.ts` and `**/*.test.tsx`.
3. Jest initializes environment isolation:
   - `jest-environment-jsdom` for React components, hooks, and client-side context providers.
   - Node environment for backend business logic, AI adapters, and normalizers.
4. The test engine runs all 49 test suites (372 unit tests) across all functional domains:
   - **AI Classification**: Fallback chain ordering, HTTP 429 handling, multi-key rotation, keyword classifier, and TOR clause extraction.
   - **Notification Subsystem**: Matching engine rules, change diff detection, deadline scanner, email templating, and preferences.
   - **Ingestion & Data Clients**: BMA e-GP, GovSpending, document extractor, and ingestion retry logic.
   - **Transformation & Normalization**: Date normalizers, Thai Baht currency parsers, tech taxonomy mapping, and Dead Letter Queue (DLQ).
   - **Frontend UI & State**: Navigation sidebar, opportunity detail modals, bookmark hooks, filter bars, and admin review tables.
   - **Security & Validation**: Zod request schemas, JWT session validation, and admin RBAC checks.
5. All 372 unit tests pass without unhandled rejections.
6. Jest exports a coverage report to `./coverage/`.
7. The process exits with code `0`.

### Alternative / Exception Flows

**A1. Unit Test Assertion Failure (Regression Detection)**
1. A developer modifies code that breaks an expected formula, category rule, or schema.
2. Jest catches an assertion failure (e.g. `expect(received).toEqual(expected)`).
3. The test runner logs the exact file, line number, and a visual diff of the discrepancy.
4. The test process exits with code `1`.
5. The GitHub Actions CI check fails, blocking the pull request from being merged.

**A2. External Dependency Call Attempted in Unit Test (Isolation Enforcement)**
1. A service under test attempts an outbound HTTP request (e.g., Vertex AI, GovSpending API).
2. The unit test intercepts the call using a Jest mock or spy (`jest.spyOn(global, 'fetch')`).
3. The mock returns a controlled fixture response (e.g., mock JSON, simulated HTTP 429).
4. The unit test verifies behavior deterministically without internet access or API usage costs.

**A3. Asynchronous Timer or Cooldown Delay**
1. A test exercises time-based logic (such as a 60-second provider cooldown).
2. The test uses mock timestamps (`Date.now()`) or fake timers (`jest.useFakeTimers()`).
3. The test verifies state transitions instantly without sleeping or delaying test execution.

### Postconditions
- All 49 test suites and 372 unit tests pass.
- Coverage reports are generated and preserved as CI workflow artifacts.
- The codebase is validated for subsequent integration and E2E stages.

### Related User Stories
- **US-1:** As a software engineer, I want unit tests to run locally with a single command (`npm test`), so that I can catch regressions immediately while coding.
- **US-2:** As a developer, I want all external APIs (AI models, government portals, email servers) mocked in unit tests, so that tests run fast, reliably, and offline without requiring API keys.
- **US-3:** As a frontend developer, I want UI components and custom hooks tested in a simulated DOM environment, so that rendering bugs and broken event handlers are caught before deployment.
- **US-4:** As a DevOps engineer, I want tests and coverage reporting automated in the CI pipeline, so that no pull request with failing tests can be merged into `main`.

### Acceptance Criteria
- [x] Jest test runner is configured with `jest.config.js` and `jest.setup.js` supporting TypeScript, Next.js App Router, and `jest-dom` matchers.
- [x] Unit test suite runs completely offline without live MongoDB, external government APIs, or paid AI credentials.
- [x] All 49 test suites and 372 unit tests across frontend and backend pass without errors (`npm test`).
- [x] Dedicated unit tests cover AI classification fallback, rate limits, multi-key rotation, and keyword classification.
- [x] Dedicated unit tests cover procurement matching, notification diffing, and email delivery services.
- [x] Dedicated unit tests cover Thai Buddhist year conversion, currency normalization, and tech taxonomy mapping.
- [x] Dedicated unit tests cover React UI components, modals, filters, and custom React hooks (`useBookmarks`).
- [x] GitHub Actions CI workflow automatically executes unit tests on every PR and push.
