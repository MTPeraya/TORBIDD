## 3.4 Smart Search & Filtering

### Description & Priority
Enables users to efficiently search and filter procurement opportunities using keywords and structured criteria.  
**Priority:** `High`

### Functional Requirements
- **SSF-1**: The system shall allow users to search procurement opportunities using keywords.
- **SSF-2**: The system shall allow users to filter opportunities by Issuing Department.
- **SSF-3**: The system shall allow users to filter opportunities by Estimated Budget Range.
- **SSF-4**: The system shall allow users to filter opportunities by Submission Deadline.
- **SSF-5**: The system shall allow users to filter opportunities by Project Category.
- **SSF-6**: The system shall update the dashboard feed dynamically based on applied search and filter criteria.

---

### UC-3: Search and Filter Opportunities

| Item | Details |
|---|---|
| **Use Case ID** | **UC-3** |
| **Use Case Name** | Search and Filter Opportunities |
| **Primary Actors** | Guest, Registered User |

#### Description
The actor searches for software-related government procurement opportunities using keywords and multi-attribute filters.

#### Preconditions
1. The database contains at least one published procurement opportunity.
2. The actor has opened the opportunity dashboard.

#### Main Flow
1. The actor opens the dashboard.
2. The system displays a paginated list of current software opportunities with metadata.
3. The actor enters one or more search keywords.
4. The actor optionally selects filters: **Budget Range**, **Issuing Agency**, **Submission Deadline**, and **Project Category**.
5. The actor optionally chooses a sort order.
6. The system executes the query against the structured database.
7. The system dynamically updates and displays matching opportunities.
8. The actor selects an opportunity to view its details.

#### Alternative Flows
- **A1: No Matching Opportunities**: If no items match, display an empty state suggesting filter relaxation.
- **A2: Search Request Failure**: If an API error occurs, display an error message and allow immediate retry.
- **A3: Approaching Deadline**: If a project deadline is within 7 days, visually highlight the deadline with an alert badge.

#### Postconditions
- Matching opportunities are displayed and filters remain active until reset.
