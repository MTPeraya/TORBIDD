## 3.7 Procurement Detail Viewer

### Description & Priority
Displays the complete structured intelligence extracted from the TOR without requiring manual review of 50-page PDF files.  
**Priority:** `High`

### Functional Requirements
- **PDV-1**: The system shall display detailed information for every procurement opportunity.
- **PDV-2**: The system shall display structured data: Title, Budget, Department, Description, Scope, Qualifications, Deadline.
- **PDV-3**: The system shall provide a direct link or embedded viewer for the original government TOR PDF.

---

### UC-5: View Opportunity Details

| Item | Details |
|---|---|
| **Use Case ID** | **UC-5** |
| **Use Case Name** | View Opportunity Details |
| **Primary Actor** | Guest, Registered User |

#### Description
The actor reviews structured procurement intelligence and Bid/No-Bid Decision Gates extracted from the TOR document and accesses the original source PDF.

#### Preconditions
1. The opportunity is published on the dashboard.

#### Main Flow
1. Actor clicks an opportunity card from dashboard or search results.
2. System retrieves the opportunity record.
3. System renders: Title, Department, Budget, Submission Deadline, Scope, Deliverables, Bidder Qualifications, Contact Info, Category, and Extraction Confidence.
4. System displays a direct link to the original TOR PDF document.
5. Actor reviews details.
6. Authenticated users may proceed to bookmark, compare, or configure alerts.

#### Alternative Flows
- **A1: Low Extraction Confidence**: System displays a warning banner that certain fields require manual verification.
- **A2: Unextractable Field**: Field is displayed with an *Unavailable / Pending Document Verification* badge.
- **A3: Original TOR PDF Unavailable**: Source link is disabled with a notice explaining third-party availability status.
- **A4: Expired Opportunity**: System displays a prominent *Closed / Bidding Expired* status banner.

#### Postconditions
- The actor reviews the complete opportunity dossier.
