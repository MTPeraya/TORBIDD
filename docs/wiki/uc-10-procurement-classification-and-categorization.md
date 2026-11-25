## Use Case

**UC-TRANSLATE: Automated Thai–English Content Translation for Procurement Data**

### Description

The system shall automatically translate Thai-language procurement content into English at ingestion time, populating the `{ th, en }` bilingual fields that exist throughout the TORBIDD data model (`title`, `description`, `scope`, `department`, `qualification descriptions`, `timeline events`, and `TOR document sections`).

Currently, all government procurement data (BMA e-GP, e-GP National, GovSpending) arrives in Thai only. The `BilingualText` (`{ th: string; en: string }`) schema is already defined across the entire codebase, but the English fields are either empty or contain a raw copy of the Thai text (e.g., `title: { th: np.projectName, en: np.projectName }` in `procurement.ts:239`). The UI language toggle (TH/EN) in `LanguageContext.tsx` and the `getLocalized()` helper are also already built.

This feature completes the bilingual pipeline end-to-end by adding an `AutoTranslationService` that calls a translation backend (Google Cloud Translation API v3 or Gemini generative translation) to produce real English content for each `{ th, en }` field, caching results to avoid redundant API calls, and exposing admin controls to inspect and override translation quality.

### Actors

- **Data Ingestion Service** — Triggers translation during procurement record ingestion from BMA, e-GP, and GovSpending.
- **Auto Translation Service (`AutoTranslationService`)** — Calls the Google Cloud Translation API or Gemini, caches results, and writes English text into bilingual fields.
- **System Administrator** — Monitors translation job status, triggers re-translation of specific records, and manually corrects low-confidence translations through the Admin Console.
- **End User (Technology Vendor / BMA Officer)** — Switches the UI language to English (EN) and reads translated procurement titles, descriptions, qualifications, and TOR clauses.

### Preconditions

- The `BilingualText` (`{ th: string; en: string }`) interface is already present in the Mongoose schema for all relevant fields in `src/types/project.ts` and `src/models/Project.ts`.
- The `LanguageContext` with `getLocalized()` is already wired into the UI.
- A Google Cloud project with Translation API v3 or a Gemini API key is available in environment variables.
- The ingestion pipeline (`IngestionService`) is functional and accessible for hooking in a post-processing translation step.

### Main Flow

1. The Ingestion Service fetches a new procurement record from a government source (BMA e-GP, GovSpending, e-GP National) — all fields arrive in Thai.
2. The Ingestion Service saves the record with `title: { th: projectName, en: '' }` (and equivalent empty EN fields).
3. The Ingestion Service calls `AutoTranslationService.translateRecord(projectId)` as a post-ingestion step.
4. `AutoTranslationService` checks its Redis / in-memory translation cache using the record's `contentHash` as the key.
5. If no cached translation exists, the service prepares a batch translation request to the Google Cloud Translation API (or Gemini) containing all Thai text fields that require an English equivalent.
6. The translation API returns English translations for each field.
7. The service validates translation quality (non-empty, no Thai characters remain, length sanity check).
8. The service writes the translated English values back into the `Project` document in MongoDB, updating each `{ th, en }` field atomically.
9. The service marks the record with `translationStatus: 'TRANSLATED'` and `translatedAt` timestamp.
10. A user with language set to English (`torbidd_lang = 'en'`) opens the opportunity listing.
11. The `getLocalized({ th: '...', en: '...' })` helper in `LanguageContext.tsx` returns the translated English text.
12. The opportunity card, detail page, TOR qualifications, and timeline events display in English.

### Alternative / Exception Flows

**A1. Translation API Rate Limit or Quota Exceeded**
1. The Translation API returns HTTP 429 or a quota error.
2. `AutoTranslationService` catches the error, logs it, and sets `translationStatus: 'PENDING'` on the record without crashing the ingestion pipeline.
3. A background retry job (cron or queue worker) re-attempts translation for all `PENDING` records after a configurable delay.
4. The UI continues to display Thai text as a fallback (`getLocalized` returns `th` when `en` is empty).

**A2. Translation API Returns Low-Quality or Empty Result**
1. The translation service returns an empty string or text that still contains predominantly Thai characters.
2. The quality validator flags the result.
3. `AutoTranslationService` sets `translationStatus: 'FAILED'` and logs the field and raw API response.
4. The field remains in Thai text as a safe fallback; no corrupt English text is stored.
5. An administrator can view failed translations in the Admin Console and trigger re-translation or provide a manual correction.

**A3. Administrator Manually Corrects a Translation**
1. An administrator navigates to the Admin Console → Classification Review / Translation tab.
2. The admin selects a project and edits the English translation for a specific field (title, description, or scope item).
3. The system saves the override with `translationStatus: 'MANUAL_OVERRIDE'` and `translationReviewedBy` set to the admin's user ID.
4. Manual overrides are excluded from future automatic re-translation runs.

**A4. Record Already Translated (Cache Hit)**
1. A re-ingestion or sync update arrives for a previously translated procurement record.
2. The system compares the current `contentHash` against the cached translation hash.
3. If the content has not changed (hash matches), the service skips the translation API call entirely.
4. If the content has changed (hash differs), the service re-translates only the affected fields.

**A5. Bulk Re-Translation Triggered by Administrator**
1. An administrator posts to `POST /api/admin/translations/retranslate` with `{ scope: 'all' | 'failed' | 'pending' }`.
2. The system queues all matching records for background translation.
3. A progress report is returned showing queued count, and the admin can poll `GET /api/admin/translations/status` for live progress.

### Postconditions

- All newly ingested procurement records have their `{ th, en }` bilingual fields populated with validated English translations.
- Users with their language preference set to English (`torbidd_lang = 'en'`) read project titles, descriptions, scope items, qualifications, and TOR sections in English without layout changes.
- The existing `getLocalized()` helper in `LanguageContext.tsx` requires zero changes — it already returns `en` when available and falls back to `th`.
- Translation metadata (`translationStatus`, `translatedAt`, `translationReviewedBy`) is persisted for audit and observability.

### Related User Stories

- **US-1:** As a BMA officer or international technology vendor, I want to read all procurement announcements in English, so that I can understand the opportunity details without manual translation.
- **US-2:** As a system administrator, I want the ingestion pipeline to automatically translate Thai procurement content into English, so that bilingual data is always available to English-speaking users.
- **US-3:** As a system administrator, I want to inspect translation quality and correct poor translations in the admin console, so that the English content remains accurate and professional.
- **US-4:** As a developer, I want translation results cached by content hash, so that repeated ingestion of the same record does not incur unnecessary translation API costs.
- **US-5:** As a BMA officer, I want the UI to seamlessly switch between Thai and English using the existing language toggle, with no page reload required.

### Acceptance Criteria

- [ ] `AutoTranslationService` translates the following `BilingualText` fields for every ingested project: `title`, `description`, `department`, all `scope` items, all `qualification.description` items, all `timeline.event` and `timeline.description` items.
- [ ] Translated English text is stored in the existing `{ th, en }` MongoDB fields without schema changes.
- [ ] Translation is skipped (cache hit) when the record's `contentHash` has not changed since the last translation.
- [ ] Translation failures set `translationStatus: 'FAILED'` and do not overwrite existing English text with empty or corrupt strings.
- [ ] Admin endpoint `GET /api/admin/translations/status` returns a breakdown of `TRANSLATED`, `PENDING`, `FAILED`, and `MANUAL_OVERRIDE` counts.
- [ ] Admin endpoint `POST /api/admin/translations/retranslate` accepts `scope` parameter and queues matching records.
- [ ] The existing `getLocalized({ th, en })` helper in `LanguageContext.tsx` is the sole UI access point — no new UI display logic is required.
- [ ] Unit tests cover translation service batching, cache-hit skipping, quality validation, and failure handling.

---

## Subtasks & Status

| Subtask | Description | Status | Est. Time |
|---|---|:---:|:---:|
| **1** | `AutoTranslationService` Core & Google Cloud Translation API Integration | **Todo** | 6 hrs |
| **2** | Ingestion Pipeline Hook — Post-Ingestion Translation Step | **Todo** | 3 hrs |
| **3** | Translation Cache (Content-Hash Keyed In-Memory / Redis) | **Todo** | 2.5 hrs |
| **4** | Translation Quality Validator | **Todo** | 2 hrs |
| **5** | `translationStatus` Field & Mongoose Schema Extension | **Todo** | 1.5 hrs |
| **6** | Admin Translation Management Endpoints | **Todo** | 3 hrs |
| **7** | Admin Console UI: Translation Status Tab | **Todo** | 4 hrs |
| **8** | Bulk Re-Translation Background Job | **Todo** | 3 hrs |
| **9** | Unit & Integration Tests for Translation Pipeline | **Todo** | 4 hrs |

**Total Estimated Time: 29 hours**

Issue: [#387](https://github.com/MTPeraya/TORBIDD/issues/387)
