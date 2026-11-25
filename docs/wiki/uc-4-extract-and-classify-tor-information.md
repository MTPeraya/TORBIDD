## 3.5 TOR Information Extraction & 3.6 Classification

### Description & Priority
Automatically extracts critical procurement fields from dense government TOR PDF documents (~50 pages) and classifies opportunities as software-related across pre-defined categories.  
**Priority:** `High`

### Functional Requirements
- **TIE-1**: The system shall extract Project Title, Department, Budget, Project Scope, Submission Deadline, and Bidder Qualifications from TOR PDFs.
- **TIE-2**: The system shall persist extracted data linked to the procurement record.
- **SPC-1**: The system shall classify whether a project is software-related.
- **SPC-2**: The system shall classify projects matching: Website development, Mobile applications, Information systems, AI solutions, Database systems, or Software maintenance.

---

### UC-4: Extract and Classify TOR Information

| Item | Details |
|---|---|
| **Use Case ID** | **UC-4** |
| **Use Case Name** | Extract and Classify TOR Information |
| **Primary Actor** | Data Collection Service |
| **Supporting Actor** | Third-Party AI Service (Vertex AI / Gemini) |

#### Description
The system ingests a government TOR PDF, extracts structured metadata into the Five Core Business Pillars, determines software relevance with confidence scoring, and publishes qualified records to the public dashboard.

#### Preconditions
1. A new procurement announcement and TOR PDF have been downloaded by the scraper.
2. The AI Service is online and reachable.


#### Main Flow
1. Data Collection Service submits the TOR document to the AI Service.
2. AI Service processes Thai document text and tables.
3. AI Service extracts structured data: Budget, Deadline, Scope, Deliverables, Bidder Qualifications, Contact Info.
4. AI classifies whether the listing is software-related and assigns category + confidence score.
5. System evaluates confidence against configured thresholds.
6. If software-related with acceptable confidence, system assigns project category and records confidence indicators.
7. System validates extracted fields.
8. Structured record is persisted and published to the Opportunity Dashboard.
9. If classified as non-software, listing is excluded from public dashboard.
10. Administrators can inspect potential false positives and confirm exclusion or manually override.

#### Alternative Flows
- **A1: Unreadable PDF**: If corrupted, unreadable, or scanned image-only, queue for admin review.
- **A2: AI Service Unavailable**: Log failure in `SyncError` and queue backoff retry.
- **A3: Mandatory Fields Missing**: Mark fields as incomplete and flag for admin verification.
- **A4: Non-Software Listing**: Suppress from public feed; retain in audit storage.
- **A5: Admin Confirms Non-Software**: Mark as confirmed non-software and purge per retention rules.
- **A6: Duplicate Record**: Link to existing record or reject per deduplication rules.

#### Postconditions
- Validated software opportunity published to dashboard or excluded to audit store.