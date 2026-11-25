## FEAT-03: Procurement Detail Viewer & Bid/No-Bid Decision Sheet
[← Back to Feature Details](Feature-Details)

### 1. Overview & Purpose
Presents the full intelligence dossier for a selected procurement opportunity. Rather than skimming 50-page legal documents, users review an executive **Bid / No-Bid Decision Sheet** summarizing financial attractiveness, technical feasibility, and mandatory qualification gates.

### 2. Architecture & Components
- **UI View**: `src/app/projects/[id]/page.tsx`
- **Sub-Components**:
  - `CommercialProfileCard.tsx`
  - `TechnicalFitTable.tsx`
  - `ComplianceGatesChecklist.tsx`
  - `SubmissionRoadmapTimeline.tsx`
  - `TorDocumentViewer.tsx`
- **Route Handler**: `GET /api/projects/[id]`

### 3. Key Capabilities
- **Gate Evaluation Indicators**: Clear pass/fail/warning indicators against mandatory criteria (e.g., *"Requires CMMI Level 3 certification"*).
- **Direct Source Verification**: Embedded viewer and direct download link to the original government TOR PDF, allowing teams to audit extracted text against the original document.
- **Bilingual Localization**: Instant switching between Thai and English while maintaining Buddhist Era (B.E.) date context.

---
