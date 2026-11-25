## 3.3 Procurement Opportunity Dashboard

### Description & Priority
The dashboard serves as the platform's primary homepage, displaying the latest active software-related procurement opportunities published by BMA and partner agencies.  
**Priority:** `High`

### Functional Requirements
- **POD-1**: The system shall display active software-related procurement opportunities from BMA.
- **POD-2**: The system shall display the following details for each listing: Project Title, Issuing Department, Estimated Budget, and Submission Deadline.
- **POD-3**: The system shall allow users to click on any listing to navigate to its full details page.

---

### UC-2: View Procurement Opportunity Dashboard

| Item | Details |
|---|---|
| **Use Case ID** | **UC-2** |
| **Use Case Name** | View Procurement Opportunity Dashboard |
| **Use Case Type** | Casual |
| **Primary Actor** | User / Visitor |
| **Supporting Actor** | BMA Procurement Database / Internal Store |

#### Description
A user accesses the TORBIDD homepage to view the procurement opportunity dashboard. The dashboard displays the latest active, software-related procurement notices from the Bangkok Metropolitan Administration (BMA). The user reviews project summary cards and selects listings to view complete details.

#### Preconditions
1. The user has accessed the TORBIDD website.
2. The system has active procurement records available in the database.


#### Main Flow
1. The user navigates to the TORBIDD homepage (Opportunity Dashboard).
2. The system retrieves active software-related procurement opportunities.
3. The system displays retrieved listings as summary cards.
4. For each listing, the system displays: **Project Title**, **Issuing Department**, **Estimated Budget**, and **Submission Deadline**.
5. The user reviews the listings.
6. The user selects an opportunity of interest.
7. The system redirects the user to the full details page.

#### Alternative Flows
- **A1: No Active Opportunities**: If no opportunities are active, display a friendly message indicating no opportunities are currently open.
- **A2: Data Retrieval Failure**: If database retrieval fails, display an error banner prompting the user to refresh or try again later.

#### Postconditions
- The user reviews active listings or navigates to the full detail page of a chosen opportunity.

